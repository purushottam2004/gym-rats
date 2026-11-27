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

/** Default complete-intake checkpoint when Notify me turns on with no checkpoints. */
export const DEFAULT_COMPLETE_INTAKE_CHECKPOINT_TIME = '22:00'

/** Default repeat interval (minutes) when nutrient reminders turn on. */
export const DEFAULT_REMIND_EVERY_MINUTES = 30

export type NutrientGoalReminderSettings = {
  remind_enabled: boolean
  /** @deprecated Unused by the planner; checkpoints own fire times. */
  remind_first_time: ReminderTime | null
  remind_every_minutes: number | null
  /** Day min target; required for enabling reminders. */
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
  /** `nutrient:{nutrientId}:{iso}:milestone:{milestoneId}` or `…:r:{n}` for repeats */
  identifier: string
  date: Date
  day: string
  kind: 'milestone'
  /** 0 = checkpoint time; >0 = every-N follow-up after that checkpoint. */
  index: number
  threshold_amount: number
}

const MAX_FIRES_PER_DAY = 24
/** Cap every-N follow-ups scheduled ahead so intake updates can cancel stale nags. */
export const MAX_EVERY_FOLLOWUPS_SCHEDULED = 2
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
 * Checkpoint fires: at each milestone time while reminders are on.
 * Optional every-N repeats after each unmet checkpoint (today only) while intake
 * is still below that checkpoint's threshold.
 */
export function planNutrientMilestoneFires(input: {
  nutrientId: string
  settings: NutrientGoalReminderSettings
  milestones: NutrientGoalMilestone[]
  now: Date
  today: string
  progressToday: number
}): NutrientReminderFire[] {
  const { nutrientId, settings, milestones, now, today, progressToday } = input
  if (!settings.remind_enabled) return []

  const fires: NutrientReminderFire[] = []
  const every = settings.remind_every_minutes
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
      if (at.getTime() > now.getTime()) {
        fires.push({
          identifier: `nutrient:${nutrientId}:${day}:milestone:${milestone.id}`,
          date: at,
          day,
          kind: 'milestone',
          index: 0,
          threshold_amount: milestone.threshold_amount,
        })
      }

      // Every-N nags only for today, and only a short ahead window. Scheduling the
      // whole day up front left stale "still short" fires after the user logged enough.
      if (offset !== 0 || every == null) continue
      if (nutrientTargetMet(progressToday, milestone.threshold_amount)) continue

      const dayEnd = endOfLocalDay(day)
      let next = new Date(at.getTime() + every * 60_000)
      let index = 1
      let scheduledFollowUps = 0
      while (next.getTime() <= dayEnd.getTime() && index < MAX_FIRES_PER_DAY) {
        if (next.getTime() > now.getTime()) {
          fires.push({
            identifier: `nutrient:${nutrientId}:${day}:milestone:${milestone.id}:r:${index}`,
            date: new Date(next.getTime()),
            day,
            kind: 'milestone',
            index,
            threshold_amount: milestone.threshold_amount,
          })
          scheduledFollowUps += 1
          if (scheduledFollowUps >= MAX_EVERY_FOLLOWUPS_SCHEDULED) break
        }
        next = new Date(next.getTime() + every * 60_000)
        index += 1
      }
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
  return planNutrientMilestoneFires(input).sort((a, b) => a.date.getTime() - b.date.getTime())
}

export function normalizeNutrientReminderInput(input: {
  enabled: boolean
  everyMinutesText: string
  minAmount: number | null
}):
  | { ok: true; remind_enabled: false; remind_first_time: null; remind_every_minutes: null }
  | {
      ok: true
      remind_enabled: true
      remind_first_time: null
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
  const everyText = input.everyMinutesText.trim()
  if (!everyText) {
    return {
      ok: true,
      remind_enabled: true,
      remind_first_time: null,
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
    remind_first_time: null,
    remind_every_minutes: every,
  }
}

export type MilestoneDraft = {
  key: string
  timeText: string
  amountText: string
}

export function defaultCompleteIntakeCheckpoint(minAmount: number): MilestoneDraft {
  return {
    key: `m-default-${Date.now()}`,
    timeText: DEFAULT_COMPLETE_INTAKE_CHECKPOINT_TIME,
    amountText: String(minAmount),
  }
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
