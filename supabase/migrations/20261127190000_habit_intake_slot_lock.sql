--IDEMPOTENT
-- Serialize Habit-linked Diet slot allocation under habit_day_counts row locks
-- so concurrent +1 / delete cannot leave gaps like frequency indices [1,3,4].

-- Lock the day-count row before remapping so +1 RPCs queue behind deletes.
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

  -- Take the day-count lock first so slot allocation cannot race remapping.
  select hdc.count
    into current_count
    from public.habit_day_counts hdc
  where hdc.habit_id = old.source_habit_id
    and hdc.logged_on = old.logged_on
  for update;

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

-- Atomic +1 for food-linked Habits: lock day row, pack gaps, insert next slot, sync count.
create or replace function public.bump_habit_linked_intake(
  p_habit_id uuid,
  p_logged_on date
)
returns table (intake_id uuid, frequency_index int, day_count int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_food_id uuid;
  v_food_amount numeric;
  v_frequency int;
  v_recurrence public.habit_recurrence;
  v_owner uuid;
  v_next int;
  v_intake_id uuid;
  v_existing_count int;
  v_completed_at timestamptz;
  v_progress int;
  v_will_complete boolean;
  v_monday date;
  v_sunday date;
begin
  if v_uid is null then
    raise exception 'Not signed in';
  end if;

  select h.user_id, h.food_id, h.food_amount, h.frequency, h.recurrence
    into v_owner, v_food_id, v_food_amount, v_frequency, v_recurrence
  from public.habits h
  where h.id = p_habit_id;

  if v_owner is null or v_owner <> v_uid then
    raise exception 'Habit not found';
  end if;
  if v_food_id is null or v_food_amount is null or v_food_amount <= 0 then
    raise exception 'Habit has no linked food';
  end if;

  -- Ensure a day-count row exists, then lock it for the rest of the allocation.
  insert into public.habit_day_counts (habit_id, user_id, logged_on, count, updated_at)
  values (p_habit_id, v_uid, p_logged_on, 0, now())
  on conflict (habit_id, logged_on) do nothing;

  select hdc.count, hdc.completed_at
    into v_existing_count, v_completed_at
  from public.habit_day_counts hdc
  where hdc.habit_id = p_habit_id
    and hdc.logged_on = p_logged_on
  for update;

  -- Pack any holes (1..n) before allocating the next slot.
  update public.intakes
  set source_habit_frequency_index = source_habit_frequency_index + 1000000
  where source_habit_id = p_habit_id
    and logged_on = p_logged_on;

  with ranked as (
    select id,
           row_number() over (order by source_habit_frequency_index, created_at, id) as rn
    from public.intakes
    where source_habit_id = p_habit_id
      and logged_on = p_logged_on
  )
  update public.intakes i
  set source_habit_frequency_index = ranked.rn
  from ranked
  where i.id = ranked.id;

  select coalesce(max(i.source_habit_frequency_index), 0) + 1
    into v_next
  from public.intakes i
  where i.source_habit_id = p_habit_id
    and i.logged_on = p_logged_on;

  insert into public.intakes (
    user_id, food_id, amount, logged_on, source_habit_id, source_habit_frequency_index
  )
  values (
    v_uid, v_food_id, v_food_amount, p_logged_on, p_habit_id, v_next
  )
  returning id into v_intake_id;

  v_progress := v_next;
  if v_recurrence = 'per_week' then
    v_monday := p_logged_on - ((extract(isodow from p_logged_on)::int) - 1);
    v_sunday := v_monday + 6;
    select coalesce(sum(case when hdc.logged_on = p_logged_on then 0 else hdc.count end), 0) + v_next
      into v_progress
    from public.habit_day_counts hdc
    where hdc.habit_id = p_habit_id
      and hdc.logged_on between v_monday and v_sunday;
  end if;
  v_will_complete := v_progress >= v_frequency;

  update public.habit_day_counts
  set count = v_next,
      updated_at = now(),
      completed_at = case
        when v_will_complete then coalesce(v_completed_at, now())
        else null
      end
  where habit_id = p_habit_id
    and logged_on = p_logged_on;

  intake_id := v_intake_id;
  frequency_index := v_next;
  day_count := v_next;
  return next;
end;
$$;

revoke all on function public.bump_habit_linked_intake(uuid, date) from public;
grant execute on function public.bump_habit_linked_intake(uuid, date) to authenticated;
