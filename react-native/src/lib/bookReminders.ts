/** Pure Books reminder scheduling helpers (no cross-module imports — keeps node:test happy). */

export type ReminderTime = {
  hour: number
  minute: number
}

export type BookReminderSettings = {
  remind_enabled: boolean
  remind_every_minutes: number | null
}

export type BookReminderFire = {
  identifier: string
  date: Date
  index: number
  chapterId: string
  day: string
}

const MAX_FIRES_PER_CHAPTER = 24

/** Same rules as habitReminders.parseReminderTime — kept local for node:test. */
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

function reminderTimeToDate(time: ReminderTime, base = new Date()): Date {
  const next = new Date(base)
  next.setHours(time.hour, time.minute, 0, 0)
  return next
}

export function formatReminderTimeDisplay(time: ReminderTime, locale?: string): string {
  return reminderTimeToDate(time).toLocaleTimeString(locale, {
    hour: 'numeric',
    minute: '2-digit',
  })
}

function atLocalTime(isoDay: string, time: ReminderTime): Date {
  const [year, month, day] = isoDay.split('-').map(Number)
  return new Date(year, month - 1, day, time.hour, time.minute, 0, 0)
}

function endOfLocalDay(isoDay: string): Date {
  const [year, month, day] = isoDay.split('-').map(Number)
  return new Date(year, month - 1, day, 23, 59, 59, 999)
}

/**
 * Fire times for one scheduled incomplete chapter.
 * Uses scheduled_on + due_time; if overdue relative to today, reminds on today
 * at due_time (or follow-ups after now when every-N is set).
 */
export function planBookChapterReminderFires(input: {
  chapterId: string
  settings: BookReminderSettings
  scheduledOn: string
  dueTime: string
  completed: boolean
  now: Date
  today: string
}): BookReminderFire[] {
  const { chapterId, settings, scheduledOn, dueTime, completed, now, today } = input
  if (!settings.remind_enabled || completed) return []
  const time = parseReminderTime(dueTime)
  if (!time) return []

  const fireDay = scheduledOn < today ? today : scheduledOn
  if (fireDay < today) return []

  const fires: BookReminderFire[] = []
  const firstAt = atLocalTime(fireDay, time)
  const every = settings.remind_every_minutes

  if (firstAt.getTime() > now.getTime()) {
    fires.push({
      identifier: `book:${chapterId}:${fireDay}:0`,
      date: firstAt,
      index: 0,
      chapterId,
      day: fireDay,
    })
  }

  if (fireDay !== today || every == null) return fires

  const dayEnd = endOfLocalDay(fireDay)
  let next =
    firstAt.getTime() > now.getTime()
      ? new Date(firstAt.getTime() + every * 60_000)
      : new Date(now.getTime() + every * 60_000)
  let index = firstAt.getTime() > now.getTime() ? 1 : 0
  while (next.getTime() <= dayEnd.getTime() && index < MAX_FIRES_PER_CHAPTER) {
    if (next.getTime() > now.getTime()) {
      fires.push({
        identifier: `book:${chapterId}:${fireDay}:${index}`,
        date: new Date(next.getTime()),
        index,
        chapterId,
        day: fireDay,
      })
      index += 1
    }
    next = new Date(next.getTime() + every * 60_000)
  }

  return fires
}

export function formatChapterDueLabel(dueTime: string | null | undefined): string | null {
  const time = parseReminderTime(dueTime)
  if (!time) return null
  return formatReminderTimeDisplay(time)
}

/** Chip label: "Schedule" when unset, otherwise compact date · time. */
export function formatChapterScheduleChip(
  scheduledOn: string | null | undefined,
  dueTime: string | null | undefined,
  locale?: string,
): string {
  if (!scheduledOn) return 'Schedule'
  const [year, month, day] = scheduledOn.split('-').map(Number)
  if (!year || !month || !day) return 'Schedule'
  const dateLabel = new Date(year, month - 1, day).toLocaleDateString(locale, {
    month: 'short',
    day: 'numeric',
  })
  const dueLabel = formatChapterDueLabel(dueTime)
  return dueLabel ? `${dateLabel} · ${dueLabel}` : dateLabel
}
