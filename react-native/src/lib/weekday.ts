/** JS Date.getDay(): 0 = Sunday … 6 = Saturday. */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6

export const WEEKDAY_LABELS: readonly { value: Weekday; short: string; long: string }[] = [
  { value: 0, short: 'Sun', long: 'Sunday' },
  { value: 1, short: 'Mon', long: 'Monday' },
  { value: 2, short: 'Tue', long: 'Tuesday' },
  { value: 3, short: 'Wed', long: 'Wednesday' },
  { value: 4, short: 'Thu', long: 'Thursday' },
  { value: 5, short: 'Fri', long: 'Friday' },
  { value: 6, short: 'Sat', long: 'Saturday' },
] as const

/** Weekday for a local calendar Day (YYYY-MM-DD). */
export function weekdayFromDay(iso: string): Weekday {
  const [year, month, day] = iso.split('-').map(Number)
  return new Date(year, month - 1, day).getDay() as Weekday
}

export function weekdayLongName(weekday: Weekday): string {
  return WEEKDAY_LABELS[weekday]?.long ?? 'Day'
}
