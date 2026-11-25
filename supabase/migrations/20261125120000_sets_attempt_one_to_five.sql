--IDEMPOTENT
-- Restrict set attempt numbers to 1–5 only (no uniqueness; duplicates allowed).

alter table public.sets drop constraint if exists sets_attempt_check;

alter table public.sets
  add constraint sets_attempt_check
  check (attempt >= 1 and attempt <= 5);
