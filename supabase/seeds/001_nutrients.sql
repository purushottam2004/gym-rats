-- Local nutrient list. Production rows are inserted by hand, not by this file.
-- Stable ids so later seeds can reference them.

insert into public.nutrients (id, name, unit)
values
  ('3f1a7c2e-8b44-4d1a-9e20-6c5b0a1d1001', 'Energy', 'kcal'),
  ('3f1a7c2e-8b44-4d1a-9e20-6c5b0a1d1002', 'Protein', 'g'),
  ('3f1a7c2e-8b44-4d1a-9e20-6c5b0a1d1003', 'Carbohydrate', 'g'),
  ('3f1a7c2e-8b44-4d1a-9e20-6c5b0a1d1004', 'Fat', 'g'),
  ('3f1a7c2e-8b44-4d1a-9e20-6c5b0a1d1005', 'Calcium', 'mg'),
  ('3f1a7c2e-8b44-4d1a-9e20-6c5b0a1d1006', 'Fibre', 'g'),
  ('3f1a7c2e-8b44-4d1a-9e20-6c5b0a1d1007', 'Vitamin C', 'mg'),
  ('3f1a7c2e-8b44-4d1a-9e20-6c5b0a1d1008', 'Creatine', 'g')
on conflict (id) do nothing;
