--IDEMPOTENT
-- Books reading tracker: books, chapters (TOC + day/time schedule), audiences,
-- and feature_tab value for the Books tab what's-new catalog.

alter type public.feature_tab add value if not exists 'books';

create table if not exists public.books (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  title text not null check (char_length(btrim(title)) > 0),
  author text,
  remind_enabled boolean not null default false,
  remind_every_minutes int,
  active boolean not null default true,
  sort_order int not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default now(),
  constraint books_remind_settings_check check (
    (
      remind_enabled = false
      and remind_every_minutes is null
    )
    or (
      remind_enabled = true
      and (
        remind_every_minutes is null
        or remind_every_minutes >= 5
      )
    )
  )
);

create index if not exists books_user_active_sort_idx
  on public.books (user_id, active, sort_order, created_at);

create table if not exists public.book_chapters (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.books (id) on delete cascade,
  title text not null check (char_length(btrim(title)) > 0),
  sort_order int not null default 0 check (sort_order >= 0),
  page_start int check (page_start is null or page_start >= 1),
  page_end int check (page_end is null or page_end >= 1),
  scheduled_on date,
  due_time time,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint book_chapters_pages_order check (
    page_start is null
    or page_end is null
    or page_end >= page_start
  ),
  constraint book_chapters_schedule_check check (
    (scheduled_on is null and due_time is null)
    or (scheduled_on is not null and due_time is not null)
  )
);

create index if not exists book_chapters_book_sort_idx
  on public.book_chapters (book_id, sort_order, created_at);

create index if not exists book_chapters_schedule_idx
  on public.book_chapters (scheduled_on, completed_at)
  where scheduled_on is not null;

create table if not exists public.book_audiences (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.books (id) on delete cascade,
  kind text not null check (kind in ('profile', 'group')),
  group_id uuid references public.groups (id) on delete cascade,
  check (
    (kind = 'profile' and group_id is null)
    or (kind = 'group' and group_id is not null)
  )
);

create unique index if not exists book_audiences_one_profile
  on public.book_audiences (book_id)
  where kind = 'profile';

create unique index if not exists book_audiences_one_group
  on public.book_audiences (book_id, group_id)
  where kind = 'group';

alter table public.books enable row level security;
alter table public.book_chapters enable row level security;
alter table public.book_audiences enable row level security;

create or replace function public.can_see_book(p_book_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.books b
    where b.id = p_book_id
      and (
        b.user_id = (select auth.uid())
        or (
          exists (
            select 1 from public.book_audiences a
            where a.book_id = b.id and a.kind = 'profile'
          )
          and public.shares_group(b.user_id)
        )
        or exists (
          select 1
          from public.book_audiences a
          join public.group_members author_member
            on author_member.group_id = a.group_id
           and author_member.user_id = b.user_id
          where a.book_id = b.id
            and a.kind = 'group'
            and public.is_group_member(a.group_id)
        )
      )
  );
$$;

revoke all on function public.can_see_book(uuid) from public;
grant execute on function public.can_see_book(uuid) to authenticated;

drop policy if exists "Read a book you are allowed to see" on public.books;
create policy "Read a book you are allowed to see"
  on public.books
  for select
  to authenticated
  using (user_id = (select auth.uid()) or public.can_see_book(id));

drop policy if exists "Insert own books" on public.books;
create policy "Insert own books"
  on public.books
  for insert
  to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists "Update own books" on public.books;
create policy "Update own books"
  on public.books
  for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "Delete own books" on public.books;
create policy "Delete own books"
  on public.books
  for delete
  to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "Read chapters of a visible book" on public.book_chapters;
create policy "Read chapters of a visible book"
  on public.book_chapters
  for select
  to authenticated
  using (public.can_see_book(book_id));

drop policy if exists "Owner inserts chapters" on public.book_chapters;
create policy "Owner inserts chapters"
  on public.book_chapters
  for insert
  to authenticated
  with check (
    exists (
      select 1 from public.books b
      where b.id = book_id and b.user_id = (select auth.uid())
    )
  );

drop policy if exists "Owner updates chapters" on public.book_chapters;
create policy "Owner updates chapters"
  on public.book_chapters
  for update
  to authenticated
  using (
    exists (
      select 1 from public.books b
      where b.id = book_id and b.user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.books b
      where b.id = book_id and b.user_id = (select auth.uid())
    )
  );

drop policy if exists "Owner deletes chapters" on public.book_chapters;
create policy "Owner deletes chapters"
  on public.book_chapters
  for delete
  to authenticated
  using (
    exists (
      select 1 from public.books b
      where b.id = book_id and b.user_id = (select auth.uid())
    )
  );

drop policy if exists "Read audiences of a visible book" on public.book_audiences;
create policy "Read audiences of a visible book"
  on public.book_audiences
  for select
  to authenticated
  using (public.can_see_book(book_id));

drop policy if exists "Owner adds book audiences" on public.book_audiences;
create policy "Owner adds book audiences"
  on public.book_audiences
  for insert
  to authenticated
  with check (
    exists (
      select 1 from public.books b
      where b.id = book_id and b.user_id = (select auth.uid())
    )
    and (
      kind = 'profile'
      or (kind = 'group' and group_id is not null and public.is_group_member(group_id))
    )
  );

drop policy if exists "Owner removes book audiences" on public.book_audiences;
create policy "Owner removes book audiences"
  on public.book_audiences
  for delete
  to authenticated
  using (
    exists (
      select 1 from public.books b
      where b.id = book_id and b.user_id = (select auth.uid())
    )
  );

grant select, insert, update, delete on table public.books to authenticated;
grant select, insert, update, delete on table public.book_chapters to authenticated;
grant select, insert, delete on table public.book_audiences to authenticated;
