--IDEMPOTENT
-- Convert legacy remind_first_time full-target reminders into a complete-intake
-- checkpoint so devices keep firing after First at was removed from the model.

insert into public.nutrient_goal_milestones (
  user_id,
  nutrient_id,
  remind_at,
  threshold_amount,
  sort_order
)
select
  ng.user_id,
  ng.nutrient_id,
  ng.remind_first_time,
  ng.min_amount,
  0
from public.nutrient_goals ng
where ng.remind_enabled = true
  and ng.remind_first_time is not null
  and ng.min_amount is not null
  and not exists (
    select 1
    from public.nutrient_goal_milestones m
    where m.user_id = ng.user_id
      and m.nutrient_id = ng.nutrient_id
  )
on conflict (user_id, nutrient_id, remind_at) do nothing;

update public.nutrient_goals
set remind_first_time = null
where remind_first_time is not null;
