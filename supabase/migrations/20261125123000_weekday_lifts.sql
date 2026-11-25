--IDEMPOTENT
-- Per-user planned Lifts for each weekday (0=Sunday … 6=Saturday, JS getDay).
-- Planned slots are not Sets; deleting a Lift drops its plan rows (cascade).

create table if not exists public.weekday_lifts (
  user_id uuid not null references public.users (id) on delete cascade,
  weekday smallint not null check (weekday >= 0 and weekday <= 6),
  lift_id uuid not null references public.lifts (id) on delete cascade,
  position int not null default 0 check (position >= 0),
  created_at timestamptz not null default now(),
  primary key (user_id, weekday, lift_id)
);

create index if not exists weekday_lifts_user_weekday_position_idx
  on public.weekday_lifts (user_id, weekday, position, created_at);

alter table public.weekday_lifts enable row level security;

drop policy if exists "Users read own weekday lifts" on public.weekday_lifts;
create policy "Users read own weekday lifts"
  on public.weekday_lifts
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "Shared users read weekday lifts" on public.weekday_lifts;
create policy "Shared users read weekday lifts"
  on public.weekday_lifts
  for select
  to authenticated
  using (public.shares_group(user_id));

drop policy if exists "Users insert own weekday lifts" on public.weekday_lifts;
create policy "Users insert own weekday lifts"
  on public.weekday_lifts
  for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "Users update own weekday lifts" on public.weekday_lifts;
create policy "Users update own weekday lifts"
  on public.weekday_lifts
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "Users delete own weekday lifts" on public.weekday_lifts;
create policy "Users delete own weekday lifts"
  on public.weekday_lifts
  for delete
  to authenticated
  using (user_id = auth.uid());
