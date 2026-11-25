--IDEMPOTENT
-- Optional Food link on a Habit: each +1 completion logs an Intake; −1 removes
-- only an Intake created by that Habit (source_habit_id).

alter table public.habits
  add column if not exists food_id uuid references public.foods (id) on delete set null;

alter table public.habits
  add column if not exists food_amount numeric;

alter table public.habits drop constraint if exists habits_food_link_check;
alter table public.habits
  add constraint habits_food_link_check check (
    (food_id is null and food_amount is null)
    or (food_id is not null and food_amount is not null and food_amount > 0)
  );

alter table public.intakes
  add column if not exists source_habit_id uuid references public.habits (id) on delete set null;

create index if not exists intakes_source_habit_day_idx
  on public.intakes (source_habit_id, logged_on, created_at desc)
  where source_habit_id is not null;
