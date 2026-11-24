--IDEMPOTENT
-- Extend the global nutrient list. App UIs load nutrients from this table.

insert into public.nutrients (id, name, unit)
values
  ('3f1a7c2e-8b44-4d1a-9e20-6c5b0a1d1006', 'Fibre', 'g'),
  ('3f1a7c2e-8b44-4d1a-9e20-6c5b0a1d1007', 'Vitamin C', 'mg'),
  ('3f1a7c2e-8b44-4d1a-9e20-6c5b0a1d1008', 'Creatine', 'g')
on conflict (id) do nothing;
