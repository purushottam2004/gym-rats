/** Pure nutrient-target reminder planners (no cross-module imports — keeps node:test happy). */

export type ReminderTime = {
  hour: number
  minute: number
}

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

export type NutrientGoalReminderSettings = {
  remind_enabled: boolean
  remind_first_time: ReminderTime | null
  remind_every_minutes: number | null
  /** Day min target used for full-goal reminders; null disables full-goal fires. */
  min_amount: number | null
}

export type NutrientGoalMilestone = {
  id: string
  nutrient_id: string
  remind_at: ReminderTime
  threshold_amount: number
  sort_order: number
}

export type NutrientReminderFire = {
  /** `nutrient:{nutrientId}:{iso}:{kind}:{key}` */
  identifier: string
  date: Date
  day: string
  kind: 'full' | 'milestone'
  /** Full-goal index (0 = first) or milestone sort key. */
  index: number
  threshold_amount: number
}

const MAX_FIRES_PER_DAY = 24
const LOOKAHEAD_DAYS = 7

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

export function nutrientTargetMet(progress: number, threshold: number): boolean {
  return progress + 1e-9 >= threshold
}

/**
 * Full min-target fires (habit-style): first on each lookahead day; follow-ups only
 * today while progress is still below min_amount.
 */
export function planNutrientFullTargetFires(input: {
  nutrientId: string
  settings: NutrientGoalReminderSettings
  now: Date
  today: string
  progressToday: number
}): NutrientReminderFire[] {
  const { nutrientId, settings, now, today, progressToday } = input
  if (!settings.remind_enabled || !settings.remind_first_time || settings.min_amount == null) {
    return []
  }
  if (!(settings.min_amount > 0)) return []

  const fires: NutrientReminderFire[] = []
  const first = settings.remind_first_time
  const every = settings.remind_every_minutes
  const completeToday = nutrientTargetMet(progressToday, settings.min_amount)

  for (let offset = 0; offset < LOOKAHEAD_DAYS; offset += 1) {
    const day = shiftIsoDate(today, offset)
    const firstAt = atLocalTime(day, first)
    if (firstAt.getTime() > now.getTime()) {
      fires.push({
        identifier: `nutrient:${nutrientId}:${day}:full:0`,
        date: firstAt,
        day,
        kind: 'full',
        index: 0,
        threshold_amount: settings.min_amount,
      })
    }

    if (offset !== 0 || completeToday || every == null) continue

    const dayEnd = endOfLocalDay(day)
    let next = new Date(firstAt.getTime() + every * 60_000)
    let index = 1
    while (next.getTime() <= dayEnd.getTime() && index < MAX_FIRES_PER_DAY) {
      if (next.getTime() > now.getTime()) {
        fires.push({
          identifier: `nutrient:${nutrientId}:${day}:full:${index}`,
          date: new Date(next.getTime()),
          day,
          kind: 'full',
          index,
          threshold_amount: settings.min_amount,
        })
      }
      next = new Date(next.getTime() + every * 60_000)
      index += 1
    }
  }

  return fires
}

/**
 * Checkpoint fires: at each milestone time, if today's progress is still below
 * the threshold (future days always schedule).
 */
export function planNutrientMilestoneFires(input: {
  nutrientId: string
  milestones: NutrientGoalMilestone[]
  now: Date
  today: string
  progressToday: number
}): NutrientReminderFire[] {
  const { nutrientId, milestones, now, today, progressToday } = input
  const fires: NutrientReminderFire[] = []
  const ordered = milestones
    .filter((row) => row.nutrient_id === nutrientId && row.threshold_amount > 0)
    .slice()
    .sort((a, b) => {
      if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order
      const aMin = a.remind_at.hour * 60 + a.remind_at.minute
      const bMin = b.remind_at.hour * 60 + b.remind_at.minute
      return aMin - bMin
    })

  for (let offset = 0; offset < LOOKAHEAD_DAYS; offset += 1) {
    const day = shiftIsoDate(today, offset)
    for (const milestone of ordered) {
      if (offset === 0 && nutrientTargetMet(progressToday, milestone.threshold_amount)) {
        continue
      }
      const at = atLocalTime(day, milestone.remind_at)
      if (at.getTime() <= now.getTime()) continue
      fires.push({
        identifier: `nutrient:${nutrientId}:${day}:milestone:${milestone.id}`,
        date: at,
        day,
        kind: 'milestone',
        index: milestone.sort_order,
        threshold_amount: milestone.threshold_amount,
      })
    }
  }

  return fires
}

export function planNutrientTargetFires(input: {
  nutrientId: string
  settings: NutrientGoalReminderSettings
  milestones: NutrientGoalMilestone[]
  now: Date
  today: string
  progressToday: number
}): NutrientReminderFire[] {
  return [
    ...planNutrientFullTargetFires(input),
    ...planNutrientMilestoneFires(input),
  ].sort((a, b) => a.date.getTime() - b.date.getTime())
}

export function normalizeNutrientReminderInput(input: {
  enabled: boolean
  firstTimeText: string
  everyMinutesText: string
  minAmount: number | null
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
  if (input.minAmount == null || !(input.minAmount > 0)) {
    return { ok: false, error: 'Set a min target before enabling nutrient reminders' }
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
    return {
      ok: false,
      error: 'Repeat interval must be blank or a whole number of minutes, 5 or more',
    }
  }
  return {
    ok: true,
    remind_enabled: true,
    remind_first_time: formatReminderTime(first),
    remind_every_minutes: every,
  }
}

export type MilestoneDraft = {
  key: string
  timeText: string
  amountText: string
}

export function normalizeMilestoneDrafts(
  drafts: MilestoneDraft[],
  nutrientName: string,
):
  | { ok: true; milestones: { remind_at: string; threshold_amount: number; sort_order: number }[] }
  | { ok: false; error: string } {
  const milestones: { remind_at: string; threshold_amount: number; sort_order: number }[] = []
  const seenTimes = new Set<string>()

  for (let index = 0; index < drafts.length; index += 1) {
    const draft = drafts[index]!
    const timeRaw = draft.timeText.trim()
    const amountRaw = draft.amountText.trim()
    if (!timeRaw && !amountRaw) continue

    const time = parseReminderTime(timeRaw)
    if (!time) {
      return { ok: false, error: `${nutrientName} checkpoint time must look like 15:00` }
    }
    const amount = Number(amountRaw)
    if (!(amount > 0)) {
      return {
        ok: false,
        error: `${nutrientName} checkpoint amount must be greater than zero`,
      }
    }
    const remindAt = formatReminderTime(time)
    if (seenTimes.has(remindAt)) {
      return { ok: false, error: `${nutrientName} has two checkpoints at ${remindAt}` }
    }
    seenTimes.add(remindAt)
    milestones.push({
      remind_at: remindAt,
      threshold_amount: amount,
      sort_order: index,
    })
  }

  return { ok: true, milestones }
}
