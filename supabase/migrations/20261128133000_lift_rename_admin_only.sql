--IDEMPOTENT
-- Renaming a Lift requires Admin. Muscle / photo updates stay open to any
-- signed-in User. id and created_at remain immutable for everyone.

create or replace function public.reject_lift_immutable_fields()
returns trigger
language plpgsql
as $$
begin
  if new.id is distinct from old.id
     or new.created_at is distinct from old.created_at then
    raise exception 'this cannot be changed after it is created';
  end if;
  if new.name is distinct from old.name and not public.is_admin() then
    raise exception 'only an admin can rename a lift';
  end if;
  return new;
end;
$$;

drop trigger if exists lifts_reject_update on public.lifts;
create trigger lifts_reject_update
  before update on public.lifts
  for each row
  execute function public.reject_lift_immutable_fields();
