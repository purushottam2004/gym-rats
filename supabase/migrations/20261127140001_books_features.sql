--IDEMPOTENT
-- Books tab what's-new rows (separate from books schema so the new
-- feature_tab enum value is committed before use).

insert into public.features (id, tab, title, summary, body, sort_order, published_at)
values
  (
    'a1000001-0001-4000-8000-000000000061',
    'books',
    'Track books by chapter',
    'Add a book, build its TOC, schedule chapters onto days.',
    'Open Books to see chapters due today (including overdue). Add a book manually or snap cover/TOC photos — the app prefills title, author, and chapters for you to edit before saving. Swipe a chapter right to mark it done.',
    10,
    '2026-11-27T12:00:00Z'
  ),
  (
    'a1000001-0001-4000-8000-000000000062',
    'books',
    'Reminders and sharing',
    'Due-time reminders and optional Group/Profile share.',
    'Enable reminders on a book to get notified at each chapter’s due time (with optional repeats while incomplete). Share a book with Profile or specific Groups so friends can see your reading progress in member view — private by default.',
    20,
    '2026-11-27T12:00:00Z'
  )
on conflict (id) do nothing;
