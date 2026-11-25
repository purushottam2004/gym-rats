--IDEMPOTENT
-- Reactions and comments on posts. Visibility follows can_see_post().

create table if not exists public.post_reactions (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  emoji text not null check (char_length(emoji) between 1 and 8),
  created_at timestamptz not null default now(),
  unique (post_id, user_id)
);

create index if not exists post_reactions_post_id_idx
  on public.post_reactions (post_id);

create table if not exists public.post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  body text not null check (
    char_length(btrim(body)) > 0
    and char_length(body) <= 2000
  ),
  created_at timestamptz not null default now()
);

create index if not exists post_comments_post_id_created_at_idx
  on public.post_comments (post_id, created_at);

alter table public.post_reactions enable row level security;
alter table public.post_comments enable row level security;

drop policy if exists "Read reactions on a visible post" on public.post_reactions;
create policy "Read reactions on a visible post"
  on public.post_reactions
  for select
  to authenticated
  using (public.can_see_post(post_id));

drop policy if exists "React to a visible post" on public.post_reactions;
create policy "React to a visible post"
  on public.post_reactions
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and public.can_see_post(post_id)
  );

drop policy if exists "Change your own reaction" on public.post_reactions;
create policy "Change your own reaction"
  on public.post_reactions
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and public.can_see_post(post_id));

drop policy if exists "Remove your own reaction" on public.post_reactions;
create policy "Remove your own reaction"
  on public.post_reactions
  for delete
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "Read comments on a visible post" on public.post_comments;
create policy "Read comments on a visible post"
  on public.post_comments
  for select
  to authenticated
  using (public.can_see_post(post_id));

drop policy if exists "Comment on a visible post" on public.post_comments;
create policy "Comment on a visible post"
  on public.post_comments
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and public.can_see_post(post_id)
  );

drop policy if exists "Edit your own comment" on public.post_comments;
create policy "Edit your own comment"
  on public.post_comments
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and public.can_see_post(post_id));

drop policy if exists "Delete your own comment" on public.post_comments;
create policy "Delete your own comment"
  on public.post_comments
  for delete
  to authenticated
  using (user_id = auth.uid());
