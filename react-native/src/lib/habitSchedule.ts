/** Pure Habit schedule / progress helpers (no cross-module runtime imports — keeps node:test happy). */

export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6

export type HabitRecurrence = 'per_day' | 'per_week'

export type HabitFoodLink = {
  id: string
  name: string
  measure: string
}

export type HabitSection = {
  id: string
  name: string
  sort_order: number
}

export type Habit = {
  id: string
  name: string
  recurrence: HabitRecurrence
  frequency: number
  weekdays: Weekday[]
  sort_order: number
  active: boolean
  /** Optional named group; null → "Other habits". */
  section_id: string | null
  /** Optional Diet link: completing logs this Food. */
  food_id: string | null
  food_amount: number | null
  food: HabitFoodLink | null
  /** Owner-device local reminders. */
  remind_enabled: boolean
  /** First reminder hour/minute (local); null when reminders off. */
  remind_first_time: { hour: number; minute: number } | null
  /** Follow-up interval in minutes while incomplete; null = first only. */
  remind_every_minutes: number | null
}

export type HabitDayCount = {
  habit_id: string
  logged_on: string
  count: number
  /** When this Habit first hit its target for the window including logged_on. */
  completed_at: string | null
}

function localDateFromParts(year: number, monthIndex: number, day: number): string {
  const date = new Date(year, monthIndex, day)
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function shiftDate(iso: string, days: number): string {
  const [year, month, day] = iso.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  date.setDate(date.getDate() + days)
  return localDateFromParts(date.getFullYear(), date.getMonth(), date.getDate())
}

function weekdayFromDay(iso: string): Weekday {
  const [year, month, day] = iso.split('-').map(Number)
  return new Date(year, month - 1, day).getDay() as Weekday
}

/** Monday (local) of the Mon–Sun week that contains `iso` (YYYY-MM-DD). */
export function mondayOfWeek(iso: string): string {
  const weekday = weekdayFromDay(iso) // 0=Sun … 6=Sat
  const daysFromMonday = weekday === 0 ? 6 : weekday - 1
  return shiftDate(iso, -daysFromMonday)
}

/** Inclusive Mon–Sun dates for the week containing `iso`. */
export function weekDates(iso: string): string[] {
  const monday = mondayOfWeek(iso)
  return Array.from({ length: 7 }, (_, i) => shiftDate(monday, i))
}

export function isHabitDueOnDay(habit: Pick<Habit, 'recurrence' | 'weekdays'>, day: string): boolean {
  if (habit.recurrence === 'per_week') return true
  const weekday = weekdayFromDay(day)
  return habit.weekdays.includes(weekday)
}

export function habitTarget(habit: Pick<Habit, 'frequency'>): number {
  return habit.frequency
}

/** Done toward the target shown on `day` (day count or Mon–Sun sum). */
export function habitDoneOnDay(
  habit: Pick<Habit, 'id' | 'recurrence'>,
  counts: HabitDayCount[],
  day: string,
): number {
  if (habit.recurrence === 'per_day') {
    const row = counts.find((c) => c.habit_id === habit.id && c.logged_on === day)
    return row?.count ?? 0
  }
  const days = new Set(weekDates(day))
  let total = 0
  for (const row of counts) {
    if (row.habit_id === habit.id && days.has(row.logged_on)) {
      total += row.count
    }
  }
  return total
}

export function habitComplete(habit: Pick<Habit, 'frequency'>, done: number): boolean {
  return done >= habit.frequency
}

export type HabitDayRow = {
  habit: Habit
  done: number
  target: number
  complete: boolean
  /** ISO timestamp when the Habit reached its target for this Day's window. */
  completed_at: string | null
}

/** Active habits due on `day`, in user sort order, with progress for that day. */
export function habitRowsForDay(
  habits: Habit[],
  counts: HabitDayCount[],
  day: string,
): HabitDayRow[] {
  return habits
    .filter((habit) => habit.active && isHabitDueOnDay(habit, day))
    .slice()
    .sort((a, b) => {
      if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order
      return a.name.localeCompare(b.name)
    })
    .map((habit) => {
      const done = habitDoneOnDay(habit, counts, day)
      const target = habitTarget(habit)
      const complete = habitComplete(habit, done)
      return {
        habit,
        done,
        target,
        complete,
        completed_at: habitCompletedAtStamp(habit, counts, day, complete),
      }
    })
}

function habitCompletedAtStamp(
  habit: Pick<Habit, 'id' | 'recurrence'>,
  counts: HabitDayCount[],
  day: string,
  complete: boolean,
): string | null {
  if (!complete) return null
  if (habit.recurrence === 'per_day') {
    return counts.find((row) => row.habit_id === habit.id && row.logged_on === day)?.completed_at ?? null
  }
  const days = new Set(weekDates(day))
  let latest: string | null = null
  let latestMs = -1
  for (const row of counts) {
    if (row.habit_id !== habit.id || !days.has(row.logged_on) || !row.completed_at) continue
    const ms = new Date(row.completed_at).getTime()
    if (Number.isNaN(ms)) continue
    if (ms >= latestMs) {
      latestMs = ms
      latest = row.completed_at
    }
  }
  return latest
}

export const OTHER_HABITS_SECTION_ID = '__other_habits__'

export type HabitSectionCard = {
  /** Named section id, or `OTHER_HABITS_SECTION_ID` for unsectioned habits. */
  key: string
  title: string
  rows: HabitDayRow[]
}

/**
 * Day view cards: named sections (with due habits) in section order,
 * then an "Other habits" card for unsectioned / orphaned rows.
 */
export function habitSectionCardsForDay(
  habits: Habit[],
  sections: HabitSection[],
  counts: HabitDayCount[],
  day: string,
): HabitSectionCard[] {
  const rows = habitRowsForDay(habits, counts, day)
  const sectionOrder = sections
    .slice()
    .sort((a, b) => {
      if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order
      return a.name.localeCompare(b.name)
    })
  const knownIds = new Set(sectionOrder.map((section) => section.id))
  const cards: HabitSectionCard[] = []

  for (const section of sectionOrder) {
    const sectionRows = rows.filter((row) => row.habit.section_id === section.id)
    if (sectionRows.length === 0) continue
    cards.push({ key: section.id, title: section.name, rows: sectionRows })
  }

  const otherRows = rows.filter(
    (row) => row.habit.section_id == null || !knownIds.has(row.habit.section_id),
  )
  if (otherRows.length > 0) {
    cards.push({
      key: OTHER_HABITS_SECTION_ID,
      title: 'Other habits',
      rows: otherRows,
    })
  }

  return cards
}

/** Manage / edit grouping: every section (even empty), then Other habits. */
export function habitManageGroups(
  habits: Habit[],
  sections: HabitSection[],
): { key: string; title: string; habits: Habit[] }[] {
  const active = habits
    .filter((habit) => habit.active)
    .slice()
    .sort((a, b) => {
      if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order
      return a.name.localeCompare(b.name)
    })
  const sectionOrder = sections
    .slice()
    .sort((a, b) => {
      if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order
      return a.name.localeCompare(b.name)
    })
  const knownIds = new Set(sectionOrder.map((section) => section.id))
  const groups = sectionOrder.map((section) => ({
    key: section.id,
    title: section.name,
    habits: active.filter((habit) => habit.section_id === section.id),
  }))
  groups.push({
    key: OTHER_HABITS_SECTION_ID,
    title: 'Other habits',
    habits: active.filter(
      (habit) => habit.section_id == null || !knownIds.has(habit.section_id),
    ),
  })
  return groups
}
