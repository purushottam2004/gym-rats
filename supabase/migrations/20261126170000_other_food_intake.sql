--IDEMPOTENT
-- One-off "Other" diet entries: hidden from the food catalog, nutrients are
-- absolute totals for a single logged serving (measure=unit, amount=1).

alter table public.foods
  add column if not exists is_other boolean not null default false;

-- Catalog sharing: mates see real catalog foods only. Own Other rows stay
-- readable; Other foods behind a visible intake stay readable for group views.
drop policy if exists "Read own foods and foods of people you share a group with" on public.foods;
drop policy if exists "Read own foods, shared catalog, or foods behind a visible intake" on public.foods;
create policy "Read own foods, shared catalog, or foods behind a visible intake"
  on public.foods
  for select
  to authenticated
  using (
    user_id = (select auth.uid())
    or (
      not is_other
      and public.shares_group(user_id)
    )
    or exists (
      select 1
      from public.intakes i
      where i.food_id = foods.id
        and (i.user_id = (select auth.uid()) or public.shares_group(i.user_id))
    )
  );

drop policy if exists "Read nutrients of a visible food" on public.food_nutrients;
create policy "Read nutrients of a visible food"
  on public.food_nutrients
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.foods f
      where f.id = food_nutrients.food_id
        and (
          f.user_id = (select auth.uid())
          or (
            not f.is_other
            and public.shares_group(f.user_id)
          )
          or exists (
            select 1
            from public.intakes i
            where i.food_id = f.id
              and (i.user_id = (select auth.uid()) or public.shares_group(i.user_id))
          )
        )
    )
  );

-- Do not flip catalog ↔ Other after create.
create or replace function public.foods_reject_is_other_change()
returns trigger
language plpgsql
as $$
begin
  if old.is_other is distinct from new.is_other then
    raise exception 'is_other cannot be changed after the food is created';
  end if;
  return new;
end;
$$;

drop trigger if exists foods_reject_is_other_change on public.foods;
create trigger foods_reject_is_other_change
  before update on public.foods
  for each row
  execute function public.foods_reject_is_other_change();

create or replace function public.log_other_intake(
  p_name text,
  p_logged_on date,
  p_nutrients jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_food_id uuid;
  v_intake_id uuid;
  v_name text;
  v_count int := 0;
  item record;
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  if p_logged_on is null then
    raise exception 'a day is required';
  end if;

  v_name := nullif(btrim(coalesce(p_name, '')), '');
  if v_name is null then
    v_name := 'Other';
  end if;

  insert into public.foods (user_id, name, measure, basis, is_other)
  values (auth.uid(), v_name, 'unit', 'per_100', true)
  returning id into v_food_id;

  for item in
    select nutrient_id, amount
    from jsonb_to_recordset(coalesce(p_nutrients, '[]'::jsonb))
      as x(nutrient_id uuid, amount numeric)
  loop
    if item.nutrient_id is null then
      raise exception 'a nutrient id is required';
    end if;
    if item.amount is null or item.amount < 0 then
      raise exception 'a nutrient amount cannot be negative';
    end if;
    if item.amount = 0 then
      continue;
    end if;
    insert into public.food_nutrients (food_id, nutrient_id, amount)
    values (v_food_id, item.nutrient_id, item.amount);
    v_count := v_count + 1;
  end loop;

  if v_count = 0 then
    raise exception 'add at least one nutrient amount';
  end if;

  insert into public.intakes (user_id, food_id, amount, logged_on)
  values (auth.uid(), v_food_id, 1, p_logged_on)
  returning id into v_intake_id;

  return v_intake_id;
end;
$$;

revoke all on function public.log_other_intake(text, date, jsonb) from public;
grant execute on function public.log_other_intake(text, date, jsonb) to authenticated;

-- Drop the one-shot food when its only intake is deleted.
create or replace function public.delete_orphan_other_food()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1
    from public.foods f
    where f.id = old.food_id
      and f.is_other
  ) and not exists (
    select 1
    from public.intakes i
    where i.food_id = old.food_id
  ) then
    delete from public.foods where id = old.food_id;
  end if;
  return old;
end;
$$;

drop trigger if exists intakes_delete_orphan_other_food on public.intakes;
create trigger intakes_delete_orphan_other_food
  after delete on public.intakes
  for each row
  execute function public.delete_orphan_other_food();
