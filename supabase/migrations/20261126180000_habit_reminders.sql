--IDEMPOTENT
-- Habit local reminders: first notify time + optional repeat while incomplete.
-- completed_at on habit_day_counts: when the Habit first reached its target for
-- that Day's progress window (cleared when progress drops below target).

alter table public.habits
  add column if not exists remind_enabled boolean not null default false;

alter table public.habits
  add column if not exists remind_first_time time;

alter table public.habits
  add column if not exists remind_every_minutes int;

-- Drop then recreate so constraint text stays correct when re-applied.
alter table public.habits
  drop constraint if exists habits_remind_settings_check;

alter table public.habits
  add constraint habits_remind_settings_check check (
    (
      remind_enabled = false
      and remind_first_time is null
      and remind_every_minutes is null
    )
    or (
      remind_enabled = true
      and remind_first_time is not null
      and (
        remind_every_minutes is null
        or remind_every_minutes >= 5
      )
    )
  );

comment on column public.habits.remind_enabled is
  'When true, the owner device schedules local notifications for this Habit.';
comment on column public.habits.remind_first_time is
  'Local wall-clock time of the first reminder on each due Day (no time zone).';
comment on column public.habits.remind_every_minutes is
  'If set, further reminders every N minutes after the first while the Habit is still incomplete that Day (null = first only).';

alter table public.habit_day_counts
  add column if not exists completed_at timestamptz;

comment on column public.habit_day_counts.completed_at is
  'When progress for this Habit first hit the target in the window that includes logged_on; null if incomplete.';

-- Clearing a Habit-linked Intake lowers the count; drop completed_at when incomplete.
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
begin
  if old.source_habit_id is null then
    return old;
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
