-- Local muscle list for Lift catalog sections.
-- Production rows are inserted by hand or via the app, not by this file.
-- Stable ids so later seeds can reference them.

insert into public.muscles (id, name, sort_order)
values
  ('a1b2c3d4-e5f6-4701-8901-000000000001', 'Chest', 0),
  ('a1b2c3d4-e5f6-4701-8901-000000000002', 'Back', 1),
  ('a1b2c3d4-e5f6-4701-8901-000000000003', 'Shoulders', 2),
  ('a1b2c3d4-e5f6-4701-8901-000000000004', 'Arms', 3),
  ('a1b2c3d4-e5f6-4701-8901-000000000005', 'Legs', 4),
  ('a1b2c3d4-e5f6-4701-8901-000000000006', 'Core', 5)
on conflict (id) do nothing;
