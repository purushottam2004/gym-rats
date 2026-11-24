--IDEMPOTENT
-- Nutrient goals become optional min and/or max (either or both).

alter table public.nutrient_goals
  add column if not exists min_amount numeric;

alter table public.nutrient_goals
  add column if not exists max_amount numeric;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'nutrient_goals'
      and column_name = 'amount'
  ) then
    update public.nutrient_goals
    set min_amount = amount
    where min_amount is null
      and amount is not null;
    alter table public.nutrient_goals drop column amount;
  end if;
end $$;

alter table public.nutrient_goals drop constraint if exists nutrient_goals_min_amount_check;
alter table public.nutrient_goals
  add constraint nutrient_goals_min_amount_check
  check (min_amount is null or min_amount > 0);

alter table public.nutrient_goals drop constraint if exists nutrient_goals_max_amount_check;
alter table public.nutrient_goals
  add constraint nutrient_goals_max_amount_check
  check (max_amount is null or max_amount > 0);

alter table public.nutrient_goals drop constraint if exists nutrient_goals_band_check;
alter table public.nutrient_goals
  add constraint nutrient_goals_band_check
  check (
    min_amount is not null
    or max_amount is not null
  );

alter table public.nutrient_goals drop constraint if exists nutrient_goals_min_le_max_check;
alter table public.nutrient_goals
  add constraint nutrient_goals_min_le_max_check
  check (
    min_amount is null
    or max_amount is null
    or min_amount <= max_amount
  );
