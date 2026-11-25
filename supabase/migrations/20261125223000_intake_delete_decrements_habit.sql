--IDEMPOTENT
-- Deleting an Intake created by a Habit (source_habit_id set) decrements that
-- Habit's day count. Habit swipe −1 should delete the Intake and rely on this
-- trigger so Diet deletes and Habit undos stay in sync without double-counting.

create or replace function public.decrement_habit_on_intake_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  current_count int;
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
        updated_at = now()
    where habit_id = old.source_habit_id
      and logged_on = old.logged_on;
  end if;

  return old;
end;
$$;

drop trigger if exists intakes_decrement_habit_on_delete on public.intakes;
create trigger intakes_decrement_habit_on_delete
  after delete on public.intakes
  for each row
  execute function public.decrement_habit_on_intake_delete();
