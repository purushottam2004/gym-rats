--IDEMPOTENT
-- Habit-linked intakes track which frequency slot (1..n) they fill.
-- Additions always take the next index. Deletes remapping remaining rows so
-- indices stay contiguous 1..n and match habit_day_counts.count.

alter table public.intakes
  add column if not exists source_habit_frequency_index int;

-- Backfill before enforcing the check (existing rows have source_habit_id set).
with ranked as (
  select
    id,
    row_number() over (
      partition by source_habit_id, logged_on
      order by created_at asc, id asc
    ) as rn
  from public.intakes
  where source_habit_id is not null
)
update public.intakes i
set source_habit_frequency_index = ranked.rn
from ranked
where i.id = ranked.id
  and i.source_habit_frequency_index is distinct from ranked.rn;

alter table public.intakes drop constraint if exists intakes_habit_frequency_index_check;
alter table public.intakes
  add constraint intakes_habit_frequency_index_check check (
    (source_habit_id is null and source_habit_frequency_index is null)
    or (
      source_habit_id is not null
      and source_habit_frequency_index is not null
      and source_habit_frequency_index >= 1
    )
  );

-- Repair day counts so they match linked intake rows (food-linked Habits).
with linked as (
  select
    i.source_habit_id as habit_id,
    i.logged_on,
    count(*)::int as intake_count,
    h.user_id
  from public.intakes i
  join public.habits h on h.id = i.source_habit_id
  where i.source_habit_id is not null
  group by i.source_habit_id, i.logged_on, h.user_id
)
insert into public.habit_day_counts (habit_id, user_id, logged_on, count, updated_at)
select linked.habit_id, linked.user_id, linked.logged_on, linked.intake_count, now()
from linked
on conflict (habit_id, logged_on) do update
set
  count = excluded.count,
  updated_at = now();

create unique index if not exists intakes_source_habit_day_frequency_uidx
  on public.intakes (source_habit_id, logged_on, source_habit_frequency_index)
  where source_habit_id is not null;

comment on column public.intakes.source_habit_frequency_index is
  'For Habit-linked intakes: which frequency slot (1..n) this row fills for that day. Always contiguous.';

-- If Habit link is cleared (e.g. Habit deleted → SET NULL), drop the index too.
create or replace function public.clear_intake_habit_frequency_when_unlinked()
returns trigger
language plpgsql
as $$
begin
  if new.source_habit_id is null then
    new.source_habit_frequency_index := null;
  end if;
  return new;
end;
$$;

drop trigger if exists intakes_clear_habit_frequency_on_unlink on public.intakes;
create trigger intakes_clear_habit_frequency_on_unlink
  before update of source_habit_id on public.intakes
  for each row
  execute function public.clear_intake_habit_frequency_when_unlinked();

-- Decrement Habit count and remapping higher frequency indices down so 1..n stays packed.
create or replace function public.decrement_habit_on_intake_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  current_count int;
  habit_frequency int;
  habit_recurrence public.habit_recurrence;
  week_total int;
  monday date;
  sunday date;
  deleted_index int;
begin
  if old.source_habit_id is null then
    return old;
  end if;

  deleted_index := old.source_habit_frequency_index;

  -- Remapping remaining slots above the deleted index down by 1.
  -- Two-phase shift avoids unique (habit, day, index) collisions mid-update.
  if deleted_index is not null then
    update public.intakes
    set source_habit_frequency_index = source_habit_frequency_index + 1000000
    where source_habit_id = old.source_habit_id
      and logged_on = old.logged_on
      and source_habit_frequency_index > deleted_index;

    update public.intakes
    set source_habit_frequency_index = source_habit_frequency_index - 1000000 - 1
    where source_habit_id = old.source_habit_id
      and logged_on = old.logged_on
      and source_habit_frequency_index > 1000000;
  end if;

  select hdc.count
    into current_count
    from public.habit_day_counts hdc
  where hdc.habit_id = old.source_habit_id
    and hdc.logged_on = old.logged_on
  for update;

  if current_count is null then
    return old;
  end if;

  if current_count <= 1 then
    delete from public.habit_day_counts
    where habit_id = old.source_habit_id
      and logged_on = old.logged_on;
  else
    update public.habit_day_counts
    set count = current_count - 1,
        updated_at = now(),
        completed_at = null
    where habit_id = old.source_habit_id
      and logged_on = old.logged_on;
  end if;

  -- For per_week Habits, also clear any week stamps if the week is incomplete.
  select h.frequency, h.recurrence
    into habit_frequency, habit_recurrence
  from public.habits h
  where h.id = old.source_habit_id;

  if habit_recurrence = 'per_week' and habit_frequency is not null then
    monday := old.logged_on - ((extract(isodow from old.logged_on)::int) - 1);
    sunday := monday + 6;
    select coalesce(sum(hdc.count), 0)
      into week_total
    from public.habit_day_counts hdc
    where hdc.habit_id = old.source_habit_id
      and hdc.logged_on between monday and sunday;
    if week_total < habit_frequency then
      update public.habit_day_counts
      set completed_at = null
      where habit_id = old.source_habit_id
        and logged_on between monday and sunday;
    end if;
  end if;

  return old;
end;
$$;
