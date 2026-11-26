--IDEMPOTENT
-- INSERT … RETURNING re-checks SELECT policies on the new row.
-- habit_visible_to_viewer() is STABLE and re-queries public.habits, so it
-- cannot see the row being inserted and createHabit(.insert().select()) fails
-- with RLS (42501). Allow the owner via a direct column check that evaluates
-- against the new row itself (same pattern as posts_select_own_on_insert).

drop policy if exists "Users read visible habits" on public.habits;
create policy "Users read visible habits"
  on public.habits
  for select
  to authenticated
  using (
    user_id = (select auth.uid())
    or public.habit_visible_to_viewer(id)
  );
