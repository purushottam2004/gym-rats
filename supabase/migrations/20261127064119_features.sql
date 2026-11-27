--IDEMPOTENT
-- Per-tab product features / what's-new catalog, plus per-user read receipts.
-- Features are global (nutrients-style). Clients mark rows read in feature_reads.

do $$
begin
  create type public.feature_tab as enum (
    'diet',
    'lifts',
    'habits',
    'groups',
    'posts',
    'profile'
  );
exception
  when duplicate_object then null;
end $$;

create table if not exists public.features (
  id uuid primary key,
  tab public.feature_tab not null,
  title text not null,
  summary text not null,
  body text not null,
  sort_order integer not null default 0 check (sort_order >= 0),
  published_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists features_tab_sort_idx
  on public.features (tab, sort_order, published_at desc);

alter table public.features enable row level security;

drop policy if exists "Signed-in users can read features" on public.features;
create policy "Signed-in users can read features"
  on public.features
  for select
  to authenticated
  using (true);

grant select on table public.features to authenticated;

create table if not exists public.feature_reads (
  user_id uuid not null references public.users (id) on delete cascade,
  feature_id uuid not null references public.features (id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (user_id, feature_id)
);

create index if not exists feature_reads_feature_idx
  on public.feature_reads (feature_id);

alter table public.feature_reads enable row level security;

drop policy if exists "Users read own feature reads" on public.feature_reads;
create policy "Users read own feature reads"
  on public.feature_reads
  for select
  to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "Users insert own feature reads" on public.feature_reads;
create policy "Users insert own feature reads"
  on public.feature_reads
  for insert
  to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists "Users delete own feature reads" on public.feature_reads;
create policy "Users delete own feature reads"
  on public.feature_reads
  for delete
  to authenticated
  using (user_id = (select auth.uid()));

grant select, insert, delete on table public.feature_reads to authenticated;

-- Initial catalog (also in seeds/003_features.sql for local reset).
-- Production picks these up via db push on main.
insert into public.features (id, tab, title, summary, body, sort_order, published_at)
values
  (
    'a1000001-0001-4000-8000-000000000001',
    'diet',
    'Log food by day',
    'Track intakes against your nutrient goals.',
    'Open Diet, pick a day with the calendar controls, then add foods from your catalog or log an Other amount. Progress bars show how far you are toward each nutrient goal for that day.',
    10,
    '2026-11-27T00:00:00Z'
  ),
  (
    'a1000001-0001-4000-8000-000000000002',
    'diet',
    'Voice and photo logging',
    'Speak or snap a meal to log faster.',
    'Use the mic to describe what you ate, or estimate a food from a photo. Linked habit completions can also auto-log a Diet intake when a habit is tied to a food.',
    20,
    '2026-11-27T00:00:00Z'
  ),
  (
    'a1000001-0001-4000-8000-000000000011',
    'lifts',
    'Sets by day',
    'Log attempts for each lift on a day.',
    'Pick a day, add sets for your lifts, and keep attempts ordered. Week plan and catalog tools live under the action row so you can keep training notes consistent across the week.',
    10,
    '2026-11-27T00:00:00Z'
  ),
  (
    'a1000001-0001-4000-8000-000000000012',
    'lifts',
    'Week plan from catalog',
    'Schedule lifts onto weekdays from your catalog.',
    'Use Week plan to assign catalog lifts to weekdays, then jump into Add from catalog when you want to expand what you train that day.',
    20,
    '2026-11-27T00:00:00Z'
  ),
  (
    'a1000001-0001-4000-8000-000000000021',
    'habits',
    'Swipe to complete',
    'Swipe right to add progress, left to undo.',
    'Each habit row fills as you swipe. Progress updates on screen immediately, then syncs to the server. If the save fails, the row snaps back and shows an error toast.',
    10,
    '2026-11-27T00:00:00Z'
  ),
  (
    'a1000001-0001-4000-8000-000000000022',
    'habits',
    'Reminders and voice',
    'Local reminders while a habit is still incomplete.',
    'Turn on reminders when editing a habit. Gym Rats schedules local notifications on this device. You can also use the mic on Habits to mark due habits complete from speech.',
    20,
    '2026-11-27T00:00:00Z'
  ),
  (
    'a1000001-0001-4000-8000-000000000031',
    'groups',
    'Join or create a group',
    'Share progress with people you train with.',
    'Tap New to create a group, or Join with an invite code. Group members can see shared lifts, habits, and posts according to each feature''s sharing rules.',
    10,
    '2026-11-27T00:00:00Z'
  ),
  (
    'a1000001-0001-4000-8000-000000000041',
    'posts',
    'Day posts and reactions',
    'Share photos and react with emoji.',
    'Posts are filtered by day. Create a post from the plus action, then double-tap or open reactions to leave an emoji. Comments stay on the post thread.',
    10,
    '2026-11-27T00:00:00Z'
  ),
  (
    'a1000001-0001-4000-8000-000000000051',
    'profile',
    'Your profile and appearance',
    'Name, photo, and light/dark preference.',
    'Edit your display name and photo from Profile. Appearance can follow the system or stay locked to light or dark. Sign-out is also here when you need to switch accounts.',
    10,
    '2026-11-27T00:00:00Z'
  )
on conflict (id) do nothing;
