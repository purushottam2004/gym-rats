--IDEMPOTENT
-- Group mates can read each other's full food catalogs (not only foods behind an intake).

drop policy if exists "Read own foods and foods behind a visible intake" on public.foods;
drop policy if exists "Read own foods and foods of people you share a group with" on public.foods;
create policy "Read own foods and foods of people you share a group with"
  on public.foods
  for select
  to authenticated
  using (user_id = auth.uid() or public.shares_group(user_id));

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
        and (f.user_id = auth.uid() or public.shares_group(f.user_id))
    )
  );
