--IDEMPOTENT
-- INSERT … RETURNING re-checks SELECT policies on the new row. can_see_post() is
-- STABLE and re-queries public.posts, so it cannot see the row being inserted and
-- every createPost(.insert().select()) failed with RLS. Allow the author via a
-- direct column check that evaluates against the new row itself.

drop policy if exists "Read a post you are allowed to see" on public.posts;
create policy "Read a post you are allowed to see"
  on public.posts
  for select
  to authenticated
  using (user_id = auth.uid() or public.can_see_post(id));
