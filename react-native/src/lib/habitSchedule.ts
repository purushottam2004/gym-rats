/** Pure Habit schedule / progress helpers (no cross-module runtime imports — keeps node:test happy). */

export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6

export type HabitRecurrence = 'per_day' | 'per_week'

export type HabitFoodLink = {
  id: string
  name: string
  measure: string
}

export type Habit = {
  id: string
  name: string
  recurrence: HabitRecurrence
  frequency: number
  weekdays: Weekday[]
  sort_order: number
  active: boolean
  /** Optional Diet link: completing logs this Food. */
  food_id: string | null
  food_amount: number | null
  food: HabitFoodLink | null
}

export type HabitDayCount = {
  habit_id: string
  logged_on: string
  count: number
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
      return {
        habit,
        done,
        target,
        complete: habitComplete(habit, done),
      }
    })
}
