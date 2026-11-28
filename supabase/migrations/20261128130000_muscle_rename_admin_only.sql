--IDEMPOTENT
-- Renaming a Muscle (name change) requires Admin. Reorder (sort_order) stays
-- open to any signed-in User. DELETE already requires is_admin().

create or replace function public.reject_muscle_name_change_unless_admin()
returns trigger
language plpgsql
as $$
begin
  if new.name is distinct from old.name and not public.is_admin() then
    raise exception 'only an admin can rename a muscle';
  end if;
  return new;
end;
$$;

drop trigger if exists muscles_reject_name_change_unless_admin on public.muscles;
create trigger muscles_reject_name_change_unless_admin
  before update on public.muscles
  for each row
  execute function public.reject_muscle_name_change_unless_admin();
