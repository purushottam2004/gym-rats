# Gym Rats

People who train each have an account and a profile. They keep a private catalog of foods, share one global catalog of lifts, log what they ate and what they lifted, publish posts, and see each other when they share a group.

## Language

**User**:
A person with an account. A User has exactly one Profile.
_Avoid_: account, member, person

**Profile**:
The single face of a User. It shows a display name, which is required, and a photo, which is optional. User A can see User B's Profile only when A and B share at least one Group. Seeing B this way does not show A the Users who share a Group with B but not with A. Other Users do not see B's other Groups.
_Avoid_: account, settings

**Group**:
A named set of Users. The Creator chooses the name when the Group is created. A User can be in more than one Group. A Group may have a photo; any Member can set or replace that photo.
_Avoid_: club, room, team, circle

**Member**:
A User who currently belongs to a Group.
_Avoid_: participant

**Creator**:
The one Member who manages a Group. They can rename it, replace its Invite code, and remove another Member. When the Creator leaves and other Members remain, the Member who joined earliest becomes Creator. If several joined at the same moment, the one who became a User earliest becomes Creator. If the last Member leaves, the Group is gone.
_Avoid_: admin, owner, host

**Invite code**:
The one short code the system issues for a Group. No two Groups share a code at the same time. Every Member can see the current code. A User who enters it becomes a Member. A User who is already a Member stays one. The Creator can replace the code. Replacing it does not remove Members. An old code joins nobody.
_Avoid_: password, link, pin

**Day**:
The calendar date where the User is. An Intake or a Set belongs to one Day.
_Avoid_: workout, timestamp

**Nutrient**:
A named kind of nutrition on one global list every User shares. It has a unit, such as kcal, g, or mg. The list is maintained outside the app; a User cannot add one. A User may pick it when creating a Food. A Nutrient cannot be removed while a Food still uses it.
_Avoid_: nutrition type, macro, column

**Nutrient goal**:
An optional daily band for one Nutrient that a User sets for themselves, in that Nutrient's unit: a minimum, a maximum, or both. A User may set or clear either bound for any Nutrient; when both are set, the minimum is not greater than the maximum. Another User who shares a Group can see those goals as progress against Intakes they can already see.
_Avoid_: target, allowance, RDA

**Food**:
A nutritional definition created by one User. It has a name, one measure (grams or millilitres), and a base of 100 of that measure, or of 1 kilogram when the measure is grams. The creator may pick any subset of Nutrients, including none, and sets one amount of each, in that Nutrient's unit, for the base. The creator may change the name, measure, base, and nutrient amounts later. The same Nutrient appears at most once on a Food. A User cannot log an Intake of a Food they have not created. Another User who shares a Group with the creator can see that User's full Food catalog. The User may delete a Food only when no Intake uses it; the nutrient amounts on it are removed with the Food.
_Avoid_: diet entry, ingredient, item, product

**Intake**:
One recorded consumption by a User of one of their Foods on a Day: which Food, and how much, as a number greater than zero in the Food's measure. A User may have many Intakes on the same Day, and may change or delete their own. Any User who shares a Group with them can see the Intake.
_Avoid_: diet entry, meal, serving

**Muscle**:
A named body region on one global catalog every User shares. Muscles group Lifts in the Lift catalog the way Habit sections group Habits. Any signed-in User may add a name; names are unique ignoring letter case and outer spaces. Any signed-in User may reorder Muscles. Only an Admin may rename or delete a Muscle; deleting it leaves its Lifts ungrouped under Other lifts.
_Avoid_: muscle group, body part, body region label

**Admin**:
A User flag (`users.is_admin`) for shared-catalog maintenance. An Admin may rename or delete Muscles, and may rename Lifts; other Users still add and reorder Muscles and may change a Lift’s Muscle. The flag is not editable from the app.
_Avoid_: superuser, moderator (for this catalog privilege)

**Lift**:
An exercise on one global catalog every User shares. Any signed-in User may add a name; names are unique ignoring letter case and outer spaces. Only an Admin may rename a Lift after it is created. A Lift may optionally sit under one Muscle; with none it appears under Other lifts, and the Muscle may be changed later. Any User may log a Set of any Lift in the catalog. Any User may delete a Lift only when no Set uses it.
_Avoid_: lift entry, weight, exercise, exercise type

**Set**:
One log line for a Lift on a Day: an attempt (an integer from 1 to 5), reps (an integer of 1 or greater), and a load in kilograms (zero or greater). The attempt does not have to be unique. The author may change or delete their own Set. Any User who shares a Group with them can see the Set.
_Avoid_: workout, set number, weight entry

**Week plan**:
The Lifts a User chooses for each weekday (Sunday through Saturday). On a Day that falls on that weekday, those Lifts appear on Lifts even when the User has logged no Set for them yet, so they can add a Set from the card. Another User who shares a Group can see the plan. The same screen also stores, on the device, which weekday << and >> on Lifts jump to for that weekday (Similar day jumps), so the User can compare related Days quickly.
_Avoid_: workout template, routine, schedule

**Similar day jump**:
A per-weekday pairing the User sets on the Week plan: which weekday << opens (strictly before the current Day) and which weekday >> opens (strictly after). Default is the same weekday last / next week. Stored on the device only.
_Avoid_: last workout, compare day, schedule jump

**Habit**:
A personal recurring completable a User defines for themselves: a name, a recurrence, and a frequency (count target). Recurrence is either per day (due on chosen weekdays, frequency is the target for each due Day) or per week (frequency is the target for the Monday–Sunday week; the Habit appears every Day that week and any Day's counts add toward the week). A Habit may optionally link one of the User's Foods and an amount in that Food's measure; each time the Habit count on a Day goes up by one, one Intake of that Food and amount is logged on that Day and marked as coming from the Habit; undoing a count removes only an Intake that Habit created, never a manually logged Intake. Deleting such an Intake (for example from Diet) also lowers that Habit's count for that Day by one. Clearing the Food link stops future auto-logs; past Intakes stay. If the Food is gone, the count still changes and the User is told the food log failed. Habits are not shared definitions. By default any User who shares a Group with the owner can see that Habit and its Day progress read-only; the owner may instead limit a Habit to specific Groups so only Members of those Groups (while the owner is also a Member) can see it. Archiving hides a Habit going forward without erasing past Day counts. The owner may enable Habit reminders on a Habit.
_Avoid_: routine, streak, task, reminder

**Habit reminder**:
An optional local notification schedule on the Habit owner's device for one Habit: a first wall-clock time on each due Day, and optionally further notifications every N minutes while that Habit's progress for the Day is still below its target. Completing the Habit for the Day stops further notifications that Day. Habit reminders are not shared and are not remote push to other devices.
_Avoid_: alarm, push campaign, streak nudge

**Habit day count**:
The integer number of times a User completed one Habit on one Day (zero or greater). Swiping or voice on that Day changes this number. For a per-day Habit, progress on a Day is this count against the Habit's frequency. For a per-week Habit, progress is the sum of that Habit's Day counts from Monday through Sunday of the week that contains the Day, against the Habit's frequency. When progress first reaches the Habit's target for that window, the Day count records a completion time; dropping back below the target clears it.
_Avoid_: check-in, log, completion event

**Post**:
Text, one photo, or both, published by a User. At least one of text or photo is present. The author may change the text and the photo, and may delete the Post. It has an Audience the author can change later.
_Avoid_: update, status

**Audience**:
The visibility choices on a Post, which the author can change or clear later: their Profile, any number of Groups, or neither. Profile shows the Post to any User who shares a Group with the author; a Group shows it to that Group's Members only while the author is a Member of it, including again if the author rejoins; if no choice still qualifies, only the author can see the Post. When a Group is deleted, it drops out of every Audience and the Posts remain.
_Avoid_: privacy, share setting
