/** Pure Habit reminder scheduling helpers (no native imports — keeps node:test happy). */

export type ReminderTime = {
  hour: number
  minute: number
}

export type HabitReminderSettings = {
  remind_enabled: boolean
  /** Local wall-clock first reminder; null when reminders are off. */
  remind_first_time: ReminderTime | null
  /** Minutes between follow-ups while incomplete; null = first only. */
  remind_every_minutes: number | null
}

/** Parse "HH:MM" or "HH:MM:SS" (Postgres time) into hour/minute. */
export function parseReminderTime(raw: string | null | undefined): ReminderTime | null {
  if (raw == null) return null
  const trimmed = raw.trim()
  const match = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(trimmed)
  if (!match) return null
  const hour = Number(match[1])
  const minute = Number(match[2])
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) return null
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null
  return { hour, minute }
}

/** Format for inputs and DB (`time` without seconds). */
export function formatReminderTime(time: ReminderTime): string {
  return `${String(time.hour).padStart(2, '0')}:${String(time.minute).padStart(2, '0')}`
}

export function parseReminderEveryMinutes(raw: string): number | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  const value = Number(trimmed)
  if (!Number.isInteger(value) || value < 5) return null
  return value
}

function localDateFromParts(year: number, monthIndex: number, day: number): string {
  const date = new Date(year, monthIndex, day)
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function shiftIsoDate(iso: string, days: number): string {
  const [year, month, day] = iso.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  date.setDate(date.getDate() + days)
  return localDateFromParts(date.getFullYear(), date.getMonth(), date.getDate())
}

function atLocalTime(isoDay: string, time: ReminderTime): Date {
  const [year, month, day] = isoDay.split('-').map(Number)
  return new Date(year, month - 1, day, time.hour, time.minute, 0, 0)
}

function endOfLocalDay(isoDay: string): Date {
  const [year, month, day] = isoDay.split('-').map(Number)
  return new Date(year, month - 1, day, 23, 59, 59, 999)
}

export type HabitReminderFire = {
  /** Stable id for cancel/replace: `habit:{habitId}:{iso}:{index}` */
  identifier: string
  date: Date
  /** 0 = first reminder of the day; >0 = follow-up while incomplete. */
  index: number
  day: string
}

const MAX_FIRES_PER_DAY = 24
const LOOKAHEAD_DAYS = 7

/**
 * Concrete fire times for one Habit.
 * - First reminder on each due Day in the next week (if still in the future).
 * - Follow-ups only for *today*, and only while `completeToday` is false.
 */
export function planHabitReminderFires(input: {
  habitId: string
  settings: HabitReminderSettings
  isDueOnDay: (day: string) => boolean
  now: Date
  today: string
  completeToday: boolean
}): HabitReminderFire[] {
  const { habitId, settings, isDueOnDay, now, today, completeToday } = input
  if (!settings.remind_enabled || !settings.remind_first_time) return []

  const fires: HabitReminderFire[] = []
  const first = settings.remind_first_time
  const every = settings.remind_every_minutes

  for (let offset = 0; offset < LOOKAHEAD_DAYS; offset += 1) {
    const day = shiftIsoDate(today, offset)
    if (!isDueOnDay(day)) continue

    const firstAt = atLocalTime(day, first)
    if (firstAt.getTime() > now.getTime()) {
      fires.push({
        identifier: `habit:${habitId}:${day}:0`,
        date: firstAt,
        index: 0,
        day,
      })
    }

    if (offset !== 0 || completeToday || every == null) continue

    const dayEnd = endOfLocalDay(day)
    let next = new Date(firstAt.getTime() + every * 60_000)
    let index = 1
    while (next.getTime() <= dayEnd.getTime() && index < MAX_FIRES_PER_DAY) {
      if (next.getTime() > now.getTime()) {
        fires.push({
          identifier: `habit:${habitId}:${day}:${index}`,
          date: new Date(next.getTime()),
          index,
          day,
        })
      }
      next = new Date(next.getTime() + every * 60_000)
      index += 1
    }
  }

  return fires
}

/** Human-readable completion clock for a Habit row (device locale). */
export function formatHabitCompletedAt(iso: string | null | undefined): string | null {
  if (!iso) return null
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return null
  try {
    return date.toLocaleTimeString(undefined, {
      hour: 'numeric',
      minute: '2-digit',
    })
  } catch {
    return null
  }
}

/** Pick the completion stamp to show for a Day's Habit progress. */
export function habitCompletedAtForDay(input: {
  habitId: string
  recurrence: 'per_day' | 'per_week'
  complete: boolean
  day: string
  weekDays: string[]
  counts: { habit_id: string; logged_on: string; completed_at: string | null }[]
}): string | null {
  if (!input.complete) return null
  if (input.recurrence === 'per_day') {
    const row = input.counts.find(
      (count) => count.habit_id === input.habitId && count.logged_on === input.day,
    )
    return row?.completed_at ?? null
  }
  const week = new Set(input.weekDays)
  let latest: string | null = null
  let latestMs = -1
  for (const row of input.counts) {
    if (row.habit_id !== input.habitId || !week.has(row.logged_on) || !row.completed_at) continue
    const ms = new Date(row.completed_at).getTime()
    if (Number.isNaN(ms)) continue
    if (ms >= latestMs) {
      latestMs = ms
      latest = row.completed_at
    }
  }
  return latest
}

/** Normalize edit-form reminder fields before create/update. */
export function normalizeHabitReminderInput(input: {
  enabled: boolean
  firstTimeText: string
  everyMinutesText: string
}):
  | { ok: true; remind_enabled: false; remind_first_time: null; remind_every_minutes: null }
  | {
      ok: true
      remind_enabled: true
      remind_first_time: string
      remind_every_minutes: number | null
    }
  | { ok: false; error: string } {
  if (!input.enabled) {
    return {
      ok: true,
      remind_enabled: false,
      remind_first_time: null,
      remind_every_minutes: null,
    }
  }
  const first = parseReminderTime(input.firstTimeText)
  if (!first) {
    return { ok: false, error: 'First reminder time must look like 08:00' }
  }
  const everyText = input.everyMinutesText.trim()
  if (!everyText) {
    return {
      ok: true,
      remind_enabled: true,
      remind_first_time: formatReminderTime(first),
      remind_every_minutes: null,
    }
  }
  const every = parseReminderEveryMinutes(everyText)
  if (every == null) {
    return { ok: false, error: 'Repeat interval must be blank or a whole number of minutes, 5 or more' }
  }
  return {
    ok: true,
    remind_enabled: true,
    remind_first_time: formatReminderTime(first),
    remind_every_minutes: every,
  }
}
