--IDEMPOTENT
-- Foods can be counted as a unit (an egg, a slice) as well as weighed or poured.

do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select con.conname
    from pg_constraint con
    where con.conrelid = 'public.foods'::regclass
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ilike '%measure%'
      and pg_get_constraintdef(con.oid) ilike '%''ml''%'
      and pg_get_constraintdef(con.oid) not ilike '%''unit''%'
  loop
    execute format('alter table public.foods drop constraint %I', constraint_name);
  end loop;

  if not exists (
    select 1
    from pg_constraint con
    where con.conrelid = 'public.foods'::regclass
      and con.conname = 'foods_measure_check'
  ) then
    alter table public.foods
      add constraint foods_measure_check check (measure in ('g', 'ml', 'unit'));
  end if;
end $$;

create or replace function public.create_food(
  p_name text,
  p_measure text,
  p_basis text,
  p_nutrients jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  food_id uuid;
  item record;
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  if p_measure not in ('g', 'ml', 'unit') or p_basis not in ('per_100', 'per_kg') then
    raise exception 'measure or basis is not valid';
  end if;
  if p_basis = 'per_kg' and p_measure <> 'g' then
    raise exception 'per kilogram is only for grams';
  end if;
  if char_length(btrim(p_name)) = 0 then
    raise exception 'a food needs a name';
  end if;

  insert into public.foods (user_id, name, measure, basis)
  values (auth.uid(), btrim(p_name), p_measure, p_basis)
  returning id into food_id;

  for item in
    select nutrient_id, amount
    from jsonb_to_recordset(coalesce(p_nutrients, '[]'::jsonb))
      as x(nutrient_id uuid, amount numeric)
  loop
    if item.amount is null or item.amount < 0 then
      raise exception 'a nutrient amount cannot be negative';
    end if;
    insert into public.food_nutrients (food_id, nutrient_id, amount)
    values (food_id, item.nutrient_id, item.amount);
  end loop;

  return food_id;
end;
$$;
