-- Local feature catalog. Production rows also ship in the features migration.
-- Stable ids so clients and tests can reference them.

insert into public.features (id, tab, title, summary, body, sort_order, published_at)
values
  (
    'a1000001-0001-4000-8000-000000000001',
    'diet',
    'Log food by day',
    'Track intakes against your nutrient goals.',
    'Open Diet, pick a day with the calendar controls, then add foods from your catalog or log an Other amount. Progress bars show how far you are toward each nutrient goal for that day.',
    10,
    '2026-11-27T00:00:00Z'
  ),
  (
    'a1000001-0001-4000-8000-000000000002',
    'diet',
    'Voice and photo logging',
    'Speak or snap a meal to log faster.',
    'Use the mic to describe what you ate, or estimate a food from a photo. Linked habit completions can also auto-log a Diet intake when a habit is tied to a food.',
    20,
    '2026-11-27T00:00:00Z'
  ),
  (
    'a1000001-0001-4000-8000-000000000011',
    'lifts',
    'Sets by day',
    'Log attempts for each lift on a day.',
    'Pick a day, add sets for your lifts, and keep attempts ordered. Week plan and catalog tools live under the action row so you can keep training notes consistent across the week.',
    10,
    '2026-11-27T00:00:00Z'
  ),
  (
    'a1000001-0001-4000-8000-000000000012',
    'lifts',
    'Week plan from catalog',
    'Schedule lifts onto weekdays from your catalog.',
    'Use Week plan to assign catalog lifts to weekdays, then jump into Add from catalog when you want to expand what you train that day.',
    20,
    '2026-11-27T00:00:00Z'
  ),
  (
    'a1000001-0001-4000-8000-000000000021',
    'habits',
    'Swipe to complete',
    'Swipe right to add progress, left to undo.',
    'Each habit row fills as you swipe. Progress updates on screen immediately, then syncs to the server. If the save fails, the row snaps back and shows an error toast.',
    10,
    '2026-11-27T00:00:00Z'
  ),
  (
    'a1000001-0001-4000-8000-000000000022',
    'habits',
    'Reminders and voice',
    'Local reminders while a habit is still incomplete.',
    'Turn on reminders when editing a habit. Gym Rats schedules local notifications on this device. You can also use the mic on Habits to mark due habits complete from speech.',
    20,
    '2026-11-27T00:00:00Z'
  ),
  (
    'a1000001-0001-4000-8000-000000000031',
    'groups',
    'Join or create a group',
    'Share progress with people you train with.',
    'Tap New to create a group, or Join with an invite code. Group members can see shared lifts, habits, and posts according to each feature''s sharing rules.',
    10,
    '2026-11-27T00:00:00Z'
  ),
  (
    'a1000001-0001-4000-8000-000000000041',
    'posts',
    'Day posts and reactions',
    'Share photos and react with emoji.',
    'Posts are filtered by day. Create a post from the plus action, then double-tap or open reactions to leave an emoji. Comments stay on the post thread.',
    10,
    '2026-11-27T00:00:00Z'
  ),
  (
    'a1000001-0001-4000-8000-000000000051',
    'profile',
    'Your profile and appearance',
    'Name, photo, and light/dark preference.',
    'Edit your display name and photo from Profile. Appearance can follow the system or stay locked to light or dark. Sign-out is also here when you need to switch accounts.',
    10,
    '2026-11-27T00:00:00Z'
  ),
  (
    'a1000001-0001-4000-8000-000000000003',
    'diet',
    'Nutrient target reminders',
    'Get nudged at checkpoints toward min goals, with optional repeats.',
    'On Nutrient goals, turn on reminders for any nutrient with a min. That adds a 10:00 PM checkpoint for the full min target (or add your own). Optional “every N minutes” repeats after each unmet checkpoint while you are still short. Notifications are local on this device.',
    30,
    '2026-11-27T12:00:00Z'
  ),
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
