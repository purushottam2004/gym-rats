/** Calendar date where the device is, as YYYY-MM-DD. */
export function localDate(now = new Date()): string {
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function shiftDate(iso: string, days: number): string {
  const [year, month, day] = iso.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  date.setDate(date.getDate() + days)
  return localDate(date)
}

export function formatDay(iso: string, now = new Date()): string {
  if (iso === localDate(now)) return 'Today'
  const [year, month, day] = iso.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  })
}

/** Inclusive start / exclusive end of a local calendar day, as UTC ISO strings. */
export function dayBoundsIso(iso: string): { start: string; end: string } {
  const [year, month, day] = iso.split('-').map(Number)
  const start = new Date(year, month - 1, day)
  const end = new Date(year, month - 1, day + 1)
  return { start: start.toISOString(), end: end.toISOString() }
}
