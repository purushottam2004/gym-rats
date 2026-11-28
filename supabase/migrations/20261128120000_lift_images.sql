--IDEMPOTENT
-- Optional photo per Lift in the shared catalog. Stored under public bucket
-- lift-images at {lift_id}/{file}.jpg. Name stays immutable; image_path may change.

alter table public.lifts
  add column if not exists image_path text;

comment on column public.lifts.image_path is
  'Storage path in the lift-images bucket ({lift_id}/{file}.jpg); null = no photo.';

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('lift-images', 'lift-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public read lift images" on storage.objects;
create policy "Public read lift images"
  on storage.objects
  for select
  to public
  using (bucket_id = 'lift-images');

drop policy if exists "Authenticated upload lift images" on storage.objects;
create policy "Authenticated upload lift images"
  on storage.objects
  for insert
  to authenticated
  with check (bucket_id = 'lift-images');

drop policy if exists "Authenticated update lift images" on storage.objects;
create policy "Authenticated update lift images"
  on storage.objects
  for update
  to authenticated
  using (bucket_id = 'lift-images')
  with check (bucket_id = 'lift-images');

drop policy if exists "Authenticated delete lift images" on storage.objects;
create policy "Authenticated delete lift images"
  on storage.objects
  for delete
  to authenticated
  using (bucket_id = 'lift-images');

insert into public.features (id, tab, title, summary, body, sort_order, published_at)
values
  (
    'a1000001-0001-4000-8000-000000000013',
    'lifts',
    'Photos on lifts',
    'Attach a photo to each exercise in the catalog.',
    'Open Lift catalog — each lift can show a circular photo beside its name (tap to enlarge). In Edit Lift, change the photo and pick a muscle from the two-column grid.',
    30,
    '2026-11-28T05:30:00Z'
  )
on conflict (id) do nothing;
