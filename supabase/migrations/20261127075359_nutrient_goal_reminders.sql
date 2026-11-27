--IDEMPOTENT
-- Nutrient goal local reminders (habit-style first + optional repeat while the
-- day's min target is unmet) plus optional time checkpoints for partial progress
-- (e.g. by 15:00 meet 1200 kcal of a 2000 kcal min).

alter table public.nutrient_goals
  add column if not exists remind_enabled boolean not null default false;

alter table public.nutrient_goals
  add column if not exists remind_first_time time;

alter table public.nutrient_goals
  add column if not exists remind_every_minutes int;

alter table public.nutrient_goals
  drop constraint if exists nutrient_goals_remind_settings_check;

alter table public.nutrient_goals
  add constraint nutrient_goals_remind_settings_check check (
    (
      remind_enabled = false
      and remind_first_time is null
      and remind_every_minutes is null
    )
    or (
      remind_enabled = true
      and remind_first_time is not null
      and min_amount is not null
      and (
        remind_every_minutes is null
        or remind_every_minutes >= 5
      )
    )
  );

comment on column public.nutrient_goals.remind_enabled is
  'When true, the owner device schedules local notifications for this nutrient min target.';
comment on column public.nutrient_goals.remind_first_time is
  'Local wall-clock time of the first full-target reminder each Day (no time zone).';
comment on column public.nutrient_goals.remind_every_minutes is
  'If set, further reminders every N minutes after the first while today''s intake is still below min_amount (null = first only).';

create table if not exists public.nutrient_goal_milestones (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  nutrient_id uuid not null references public.nutrients (id) on delete cascade,
  remind_at time not null,
  threshold_amount numeric not null check (threshold_amount > 0),
  sort_order integer not null default 0 check (sort_order >= 0),
  updated_at timestamptz not null default now(),
  constraint nutrient_goal_milestones_unique unique (user_id, nutrient_id, remind_at)
);

create index if not exists nutrient_goal_milestones_user_nutrient_idx
  on public.nutrient_goal_milestones (user_id, nutrient_id, sort_order, remind_at);

comment on table public.nutrient_goal_milestones is
  'Partial progress checkpoints: at remind_at local time, expect intake ≥ threshold_amount for that nutrient.';

alter table public.nutrient_goal_milestones enable row level security;

drop policy if exists "Users read own nutrient goal milestones" on public.nutrient_goal_milestones;
create policy "Users read own nutrient goal milestones"
  on public.nutrient_goal_milestones
  for select
  to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "Users insert own nutrient goal milestones" on public.nutrient_goal_milestones;
create policy "Users insert own nutrient goal milestones"
  on public.nutrient_goal_milestones
  for insert
  to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists "Users update own nutrient goal milestones" on public.nutrient_goal_milestones;
create policy "Users update own nutrient goal milestones"
  on public.nutrient_goal_milestones
  for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "Users delete own nutrient goal milestones" on public.nutrient_goal_milestones;
create policy "Users delete own nutrient goal milestones"
  on public.nutrient_goal_milestones
  for delete
  to authenticated
  using (user_id = (select auth.uid()));

grant select, insert, update, delete on table public.nutrient_goal_milestones to authenticated;

-- Diet tab feature blurb for the what's-new catalog.
insert into public.features (id, tab, title, summary, body, sort_order, published_at)
values (
  'a1000001-0001-4000-8000-000000000003',
  'diet',
  'Nutrient target reminders',
  'Get nudged toward min goals, including mid-day checkpoints.',
  'On Nutrient goals, turn on reminders for any nutrient with a min. Set a first notification and optional repeats while you are still short of the day''s target. Add checkpoints such as “by 3:00 PM meet 1200 kcal” so progress is paced through the day. Notifications are local on this device.',
  30,
  '2026-11-27T12:00:00Z'
)
on conflict (id) do nothing;
