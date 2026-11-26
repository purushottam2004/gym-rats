--IDEMPOTENT
-- Muscles: global named groups for Lifts in the catalog (like Habit sections for Habits).
-- A Lift may optionally reference one Muscle; null means "Other lifts".

create table if not exists public.muscles (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) > 0),
  sort_order int not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default now()
);

create unique index if not exists muscles_name_unique
  on public.muscles (lower(btrim(name)));

create index if not exists muscles_sort_idx
  on public.muscles (sort_order, created_at);

alter table public.lifts
  add column if not exists muscle_id uuid references public.muscles (id) on delete set null;

create index if not exists lifts_muscle_name_idx
  on public.lifts (muscle_id, name);

alter table public.muscles enable row level security;

drop policy if exists "Read all muscles" on public.muscles;
create policy "Read all muscles"
  on public.muscles
  for select
  to authenticated
  using (true);

drop policy if exists "Add a muscle to the catalog" on public.muscles;
create policy "Add a muscle to the catalog"
  on public.muscles
  for insert
  to authenticated
  with check (true);

drop policy if exists "Update a muscle" on public.muscles;
create policy "Update a muscle"
  on public.muscles
  for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "Delete a muscle" on public.muscles;
create policy "Delete a muscle"
  on public.muscles
  for delete
  to authenticated
  using (true);

-- Lifts stay name-immutable; only muscle_id may change after create.
create or replace function public.reject_lift_immutable_fields()
returns trigger
language plpgsql
as $$
begin
  if new.id is distinct from old.id
     or new.name is distinct from old.name
     or new.created_at is distinct from old.created_at then
    raise exception 'this cannot be changed after it is created';
  end if;
  return new;
end;
$$;

drop trigger if exists lifts_reject_update on public.lifts;
create trigger lifts_reject_update
  before update on public.lifts
  for each row
  execute function public.reject_lift_immutable_fields();

drop policy if exists "Update a lift muscle" on public.lifts;
create policy "Update a lift muscle"
  on public.lifts
  for update
  to authenticated
  using (true)
  with check (true);
