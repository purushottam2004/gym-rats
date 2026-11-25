--IDEMPOTENT
-- Foods and their nutrient amounts may be updated after create.
-- Lifts stay immutable via lifts_reject_update + reject_catalog_update().
-- No app edit UI yet; this only opens the database path for the food owner.

drop trigger if exists foods_reject_update on public.foods;
drop trigger if exists food_nutrients_reject_update on public.food_nutrients;

drop policy if exists "Update your own foods" on public.foods;
create policy "Update your own foods"
  on public.foods
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Insert nutrients on your own foods" on public.food_nutrients;
create policy "Insert nutrients on your own foods"
  on public.food_nutrients
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.foods f
      where f.id = food_nutrients.food_id
        and f.user_id = (select auth.uid())
    )
  );

drop policy if exists "Update nutrients on your own foods" on public.food_nutrients;
create policy "Update nutrients on your own foods"
  on public.food_nutrients
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.foods f
      where f.id = food_nutrients.food_id
        and f.user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1
      from public.foods f
      where f.id = food_nutrients.food_id
        and f.user_id = (select auth.uid())
    )
  );

drop policy if exists "Delete nutrients on your own foods" on public.food_nutrients;
create policy "Delete nutrients on your own foods"
  on public.food_nutrients
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.foods f
      where f.id = food_nutrients.food_id
        and f.user_id = (select auth.uid())
    )
  );
