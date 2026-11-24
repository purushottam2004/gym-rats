--IDEMPOTENT
-- Per-user daily nutrient goals. Owners manage their own; Users who share a
-- Group can read another User's goals (for progress on shared logs).

create table if not exists public.nutrient_goals (
  user_id uuid not null references public.users (id) on delete cascade,
  nutrient_id uuid not null references public.nutrients (id) on delete cascade,
  amount numeric not null check (amount > 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, nutrient_id)
);

alter table public.nutrient_goals enable row level security;

drop policy if exists "Users read own nutrient goals" on public.nutrient_goals;
create policy "Users read own nutrient goals"
  on public.nutrient_goals
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "Shared users read nutrient goals" on public.nutrient_goals;
create policy "Shared users read nutrient goals"
  on public.nutrient_goals
  for select
  to authenticated
  using (public.shares_group(user_id));

drop policy if exists "Users insert own nutrient goals" on public.nutrient_goals;
create policy "Users insert own nutrient goals"
  on public.nutrient_goals
  for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "Users update own nutrient goals" on public.nutrient_goals;
create policy "Users update own nutrient goals"
  on public.nutrient_goals
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "Users delete own nutrient goals" on public.nutrient_goals;
create policy "Users delete own nutrient goals"
  on public.nutrient_goals
  for delete
  to authenticated
  using (user_id = auth.uid());
