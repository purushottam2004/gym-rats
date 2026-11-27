--IDEMPOTENT
-- Nutrient reminders are checkpoint-driven: no separate "first at" wall clock.
-- remind_enabled + optional remind_every_minutes; checkpoints supply fire times.
-- Every-N repeats apply after each unmet checkpoint while intake is still short.

alter table public.nutrient_goals
  drop constraint if exists nutrient_goals_remind_settings_check;

alter table public.nutrient_goals
  add constraint nutrient_goals_remind_settings_check check (
    (
      remind_enabled = false
      and remind_first_time is null
      and remind_every_minutes is null
    )
    or (
      remind_enabled = true
      and min_amount is not null
      and (
        remind_every_minutes is null
        or remind_every_minutes >= 5
      )
    )
  );

comment on column public.nutrient_goals.remind_first_time is
  'Deprecated for nutrient goals. Checkpoints supply fire times; column kept nullable for older rows.';
comment on column public.nutrient_goals.remind_every_minutes is
  'If set, further reminders every N minutes after each unmet checkpoint while today''s intake is still below that checkpoint threshold (null = checkpoint time only).';

update public.features
set
  summary = 'Get nudged at checkpoints toward min goals, with optional repeats.',
  body = 'On Nutrient goals, turn on reminders for any nutrient with a min. That adds a 10:00 PM checkpoint for the full min target (or add your own). Optional “every N minutes” repeats after each unmet checkpoint while you are still short. Notifications are local on this device.'
where id = 'a1000001-0001-4000-8000-000000000003';
