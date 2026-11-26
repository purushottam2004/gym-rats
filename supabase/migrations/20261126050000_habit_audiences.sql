--IDEMPOTENT
-- Per-habit Group sharing. No rows → visible to anyone who shares any Group
-- with the owner (legacy default). Rows → visible only to Members of those
-- Groups (while the owner is also a Member of them).

create table if not exists public.habit_audiences (
  id uuid primary key default gen_random_uuid(),
  habit_id uuid not null references public.habits (id) on delete cascade,
  group_id uuid not null references public.groups (id) on delete cascade,
  constraint habit_audiences_unique unique (habit_id, group_id)
);

create index if not exists habit_audiences_habit_idx
  on public.habit_audiences (habit_id);

create index if not exists habit_audiences_group_idx
  on public.habit_audiences (group_id);

alter table public.habit_audiences enable row level security;

create or replace function public.habit_visible_to_viewer(p_habit_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.habits h
    where h.id = p_habit_id
      and (
        h.user_id = (select auth.uid())
        or (
          public.shares_group(h.user_id)
          and (
            not exists (
              select 1
              from public.habit_audiences a
              where a.habit_id = h.id
            )
            or exists (
              select 1
              from public.habit_audiences a
              join public.group_members author
                on author.group_id = a.group_id
               and author.user_id = h.user_id
              where a.habit_id = h.id
                and public.is_group_member(a.group_id)
            )
          )
        )
      )
  );
$$;

revoke all on function public.habit_visible_to_viewer(uuid) from public;
grant execute on function public.habit_visible_to_viewer(uuid) to authenticated;

drop policy if exists "Users read own habits" on public.habits;
drop policy if exists "Shared users read habits" on public.habits;
create policy "Users read visible habits"
  on public.habits
  for select
  to authenticated
  using (public.habit_visible_to_viewer(id));

drop policy if exists "Users read own habit day counts" on public.habit_day_counts;
drop policy if exists "Shared users read habit day counts" on public.habit_day_counts;
create policy "Users read visible habit day counts"
  on public.habit_day_counts
  for select
  to authenticated
  using (public.habit_visible_to_viewer(habit_id));

drop policy if exists "Owner reads habit audiences" on public.habit_audiences;
create policy "Owner reads habit audiences"
  on public.habit_audiences
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.habits h
      where h.id = habit_id
        and h.user_id = (select auth.uid())
    )
  );

drop policy if exists "Owner inserts habit audiences" on public.habit_audiences;
create policy "Owner inserts habit audiences"
  on public.habit_audiences
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.habits h
      where h.id = habit_id
        and h.user_id = (select auth.uid())
    )
    and public.is_group_member(group_id)
  );

drop policy if exists "Owner deletes habit audiences" on public.habit_audiences;
create policy "Owner deletes habit audiences"
  on public.habit_audiences
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.habits h
      where h.id = habit_id
        and h.user_id = (select auth.uid())
    )
  );

grant select, insert, delete on table public.habit_audiences to authenticated;
