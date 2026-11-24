--IDEMPOTENT
-- Group photos: any member can set the group's avatar_path; images live in
-- the public group-avatars bucket under {group_id}/{file}.

alter table public.groups
  add column if not exists avatar_path text;

create or replace function public.set_group_avatar(p_group_id uuid, p_path text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  if not public.is_group_member(p_group_id) then
    raise exception 'only members can update the group photo';
  end if;
  if p_path is null or char_length(btrim(p_path)) = 0 then
    raise exception 'a photo path is required';
  end if;
  update public.groups
  set avatar_path = btrim(p_path)
  where id = p_group_id;
end;
$$;

revoke all on function public.set_group_avatar(uuid, text) from public;
grant execute on function public.set_group_avatar(uuid, text) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('group-avatars', 'group-avatars', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public read group avatars" on storage.objects;
create policy "Public read group avatars"
  on storage.objects
  for select
  to public
  using (bucket_id = 'group-avatars');

drop policy if exists "Members upload group avatars" on storage.objects;
create policy "Members upload group avatars"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'group-avatars'
    and public.is_group_member(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists "Members update group avatars" on storage.objects;
create policy "Members update group avatars"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'group-avatars'
    and public.is_group_member(((storage.foldername(name))[1])::uuid)
  )
  with check (
    bucket_id = 'group-avatars'
    and public.is_group_member(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists "Members delete group avatars" on storage.objects;
create policy "Members delete group avatars"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'group-avatars'
    and public.is_group_member(((storage.foldername(name))[1])::uuid)
  );

