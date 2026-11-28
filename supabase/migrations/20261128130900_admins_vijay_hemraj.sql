--IDEMPOTENT
-- Catalog Admins: Vijay, Purushottam, Hemraj (production user ids).
-- Purushottam was already set in 20261128123000; included here for clarity.

update public.users
set is_admin = true
where id in (
  'd6b793fa-557e-4ce4-8713-85d8a979b482', -- Vijay
  '0f114714-4c98-451d-b065-3f1afe5a4a4d', -- Purushottam
  'ad7971a8-0dd8-4196-bc5c-008fb42f5fa6'  -- Hemraj
);
