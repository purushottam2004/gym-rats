--IDEMPOTENT
-- Personal Habits: recurring completables with per-day counts.
-- per_day: due on selected weekdays with a per-due-day frequency.
-- per_week: weekly frequency (Mon–Sun); appears every day; any day counts.

do $$ begin
  create type public.habit_recurrence as enum ('per_day', 'per_week');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) > 0),
  recurrence public.habit_recurrence not null,
  frequency int not null check (frequency >= 1),
  -- JS getDay() values 0=Sun … 6=Sat. Required meaningful for per_day; ignored for per_week.
  weekdays smallint[] not null default '{0,1,2,3,4,5,6}',
  sort_order int not null default 0 check (sort_order >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint habits_weekdays_valid check (
    recurrence = 'per_week'
    or (
      coalesce(array_length(weekdays, 1), 0) >= 1
      and weekdays <@ array[0,1,2,3,4,5,6]::smallint[]
    )
  )
);

create index if not exists habits_user_active_sort_idx
  on public.habits (user_id, active, sort_order, created_at);

create table if not exists public.habit_day_counts (
  habit_id uuid not null references public.habits (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  logged_on date not null,
  count int not null default 0 check (count >= 0),
  updated_at timestamptz not null default now(),
  primary key (habit_id, logged_on)
);

create index if not exists habit_day_counts_user_day_idx
  on public.habit_day_counts (user_id, logged_on);

alter table public.habits enable row level security;
alter table public.habit_day_counts enable row level security;

drop policy if exists "Users read own habits" on public.habits;
create policy "Users read own habits"
  on public.habits
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "Shared users read habits" on public.habits;
create policy "Shared users read habits"
  on public.habits
  for select
  to authenticated
  using (public.shares_group(user_id));

drop policy if exists "Users insert own habits" on public.habits;
create policy "Users insert own habits"
  on public.habits
  for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "Users update own habits" on public.habits;
create policy "Users update own habits"
  on public.habits
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "Users delete own habits" on public.habits;
create policy "Users delete own habits"
  on public.habits
  for delete
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "Users read own habit day counts" on public.habit_day_counts;
create policy "Users read own habit day counts"
  on public.habit_day_counts
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "Shared users read habit day counts" on public.habit_day_counts;
create policy "Shared users read habit day counts"
  on public.habit_day_counts
  for select
  to authenticated
  using (public.shares_group(user_id));

drop policy if exists "Users insert own habit day counts" on public.habit_day_counts;
create policy "Users insert own habit day counts"
  on public.habit_day_counts
  for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "Users update own habit day counts" on public.habit_day_counts;
create policy "Users update own habit day counts"
  on public.habit_day_counts
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "Users delete own habit day counts" on public.habit_day_counts;
create policy "Users delete own habit day counts"
  on public.habit_day_counts
  for delete
  to authenticated
  using (user_id = auth.uid());
