/**
 * Per-day mute for Habit reminders (device-local).
 * Does not change Habit remind_* settings — only skips fires for that calendar day.
 */

export const HABIT_REMINDER_MUTE_STORAGE_KEY = 'gymrats.habits.reminderMuteByDay'

/** ISO day → muted habit ids. */
export type HabitReminderMuteByDay = Record<string, string[]>

export function parseHabitReminderMuteByDay(
  raw: string | null | undefined,
): HabitReminderMuteByDay {
  if (raw == null || raw === '') return {}
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    const out: HabitReminderMuteByDay = {}
    for (const [day, ids] of Object.entries(parsed as Record<string, unknown>)) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) continue
      if (!Array.isArray(ids)) continue
      const habitIds = ids.filter((id): id is string => typeof id === 'string' && id.length > 0)
      if (habitIds.length > 0) out[day] = [...new Set(habitIds)]
    }
    return out
  } catch {
    return {}
  }
}

export function loadHabitReminderMuteByDay(
  storage: Pick<Storage, 'getItem'> = globalThis.localStorage,
): HabitReminderMuteByDay {
  try {
    return parseHabitReminderMuteByDay(storage.getItem(HABIT_REMINDER_MUTE_STORAGE_KEY))
  } catch {
    return {}
  }
}

export function saveHabitReminderMuteByDay(
  map: HabitReminderMuteByDay,
  storage: Pick<Storage, 'setItem'> = globalThis.localStorage,
): void {
  try {
    storage.setItem(HABIT_REMINDER_MUTE_STORAGE_KEY, JSON.stringify(map))
  } catch {
    // Ignore quota / private-mode failures; in-session mute still applies until reload.
  }
}

export function isHabitReminderMutedOnDay(
  map: HabitReminderMuteByDay,
  habitId: string,
  day: string,
): boolean {
  const ids = map[day]
  return ids != null && ids.includes(habitId)
}

/** Immutable toggle; returns a new map. */
export function setHabitReminderMutedOnDay(
  map: HabitReminderMuteByDay,
  habitId: string,
  day: string,
  muted: boolean,
): HabitReminderMuteByDay {
  const existing = map[day] ?? []
  const has = existing.includes(habitId)
  if (muted && has) return map
  if (!muted && !has) return map

  const next: HabitReminderMuteByDay = { ...map }
  if (muted) {
    next[day] = [...existing, habitId]
  } else {
    const filtered = existing.filter((id) => id !== habitId)
    if (filtered.length === 0) delete next[day]
    else next[day] = filtered
  }
  return next
}

/** Drop mute entries for days strictly before `keepFromDay` (ISO). */
export function pruneHabitReminderMutesBefore(
  map: HabitReminderMuteByDay,
  keepFromDay: string,
): HabitReminderMuteByDay {
  const next: HabitReminderMuteByDay = {}
  for (const [day, ids] of Object.entries(map)) {
    if (day >= keepFromDay && ids.length > 0) next[day] = ids
  }
  return next
}
