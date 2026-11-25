--IDEMPOTENT
-- Habit sections: named groups for personal Habits (like Lifts grouping Sets).
-- Habits.section_id is optional; null means "Other habits".

create table if not exists public.habit_sections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) > 0),
  sort_order int not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default now()
);

create index if not exists habit_sections_user_sort_idx
  on public.habit_sections (user_id, sort_order, created_at);

alter table public.habits
  add column if not exists section_id uuid references public.habit_sections (id) on delete set null;

create index if not exists habits_user_section_sort_idx
  on public.habits (user_id, section_id, sort_order, created_at);

alter table public.habit_sections enable row level security;

drop policy if exists "Users read own habit sections" on public.habit_sections;
create policy "Users read own habit sections"
  on public.habit_sections
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "Shared users read habit sections" on public.habit_sections;
create policy "Shared users read habit sections"
  on public.habit_sections
  for select
  to authenticated
  using (public.shares_group(user_id));

drop policy if exists "Users insert own habit sections" on public.habit_sections;
create policy "Users insert own habit sections"
  on public.habit_sections
  for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "Users update own habit sections" on public.habit_sections;
create policy "Users update own habit sections"
  on public.habit_sections
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "Users delete own habit sections" on public.habit_sections;
create policy "Users delete own habit sections"
  on public.habit_sections
  for delete
  to authenticated
  using (user_id = auth.uid());
