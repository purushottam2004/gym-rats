--IDEMPOTENT
-- Catalog Admin: users.is_admin gates deleting Muscles from the shared catalog.
-- Anyone signed in may still add / rename / reorder Muscles. Clients hide the
-- trash control when is_admin is false; RLS enforces the same server-side.

alter table public.users
  add column if not exists is_admin boolean not null default false;

comment on column public.users.is_admin is
  'When true, this User may delete rows from shared catalogs that require Admin (e.g. Muscles).';

-- Block clients from flipping is_admin on their own profile update.
-- Migrations / service role typically have auth.uid() null and may change it.
create or replace function public.reject_users_admin_self_change()
returns trigger
language plpgsql
as $$
begin
  if new.is_admin is distinct from old.is_admin and auth.uid() is not null then
    raise exception 'admin status cannot be changed from the app';
  end if;
  return new;
end;
$$;

drop trigger if exists users_reject_admin_self_change on public.users;
create trigger users_reject_admin_self_change
  before update on public.users
  for each row
  execute function public.reject_users_admin_self_change();

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.users u
    where u.id = auth.uid()
      and u.is_admin = true
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

drop policy if exists "Delete a muscle" on public.muscles;
create policy "Delete a muscle"
  on public.muscles
  for delete
  to authenticated
  using (public.is_admin());

-- App owner for this project; safe no-op if the row is missing.
update public.users
set is_admin = true
where id = '0f114714-4c98-451d-b065-3f1afe5a4a4d';
