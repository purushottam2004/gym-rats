--IDEMPOTENT
-- Lifts become a shared catalog: any authenticated user can read, add, and
-- delete unused names. Sets may reference any lift (not only one the logger defined).

-- Merge duplicate names (case/spacing-insensitive) onto the oldest row.
do $$
declare
  r record;
  keep_id uuid;
  drop_id uuid;
begin
  for r in
    select lower(btrim(name)) as key
    from public.lifts
    group by 1
    having count(*) > 1
  loop
    select id into keep_id
    from public.lifts
    where lower(btrim(name)) = r.key
    order by created_at, id
    limit 1;

    for drop_id in
      select id
      from public.lifts
      where lower(btrim(name)) = r.key
        and id <> keep_id
    loop
      update public.sets set lift_id = keep_id where lift_id = drop_id;
      delete from public.lifts where id = drop_id;
    end loop;
  end loop;
end;
$$;

drop policy if exists "Read own lifts and lifts behind a visible set" on public.lifts;
drop policy if exists "Read all lifts" on public.lifts;
drop policy if exists "Define your own lift" on public.lifts;
drop policy if exists "Add a lift to the catalog" on public.lifts;
drop policy if exists "Delete an unused lift" on public.lifts;

alter table public.lifts drop column if exists user_id;

create unique index if not exists lifts_name_unique
  on public.lifts (lower(btrim(name)));

create policy "Read all lifts"
  on public.lifts
  for select
  to authenticated
  using (true);

create policy "Add a lift to the catalog"
  on public.lifts
  for insert
  to authenticated
  with check (true);

create policy "Delete an unused lift"
  on public.lifts
  for delete
  to authenticated
  using (true);

drop policy if exists "Log your own set" on public.sets;
create policy "Log your own set"
  on public.sets
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.lifts l
      where l.id = lift_id
    )
  );

drop policy if exists "Change your own set" on public.sets;
create policy "Change your own set"
  on public.sets
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.lifts l
      where l.id = lift_id
    )
  );
