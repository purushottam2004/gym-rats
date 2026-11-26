/** Pure Similar day jump helpers (no cross-module runtime imports — keeps node:test happy). */

import type { Weekday } from './weekday'

/** Per weekday: which weekday << and >> jump to (strictly before / after the current Day). */
export type SimilarDayLink = { prev: Weekday; next: Weekday }

export type SimilarDayLinks = Record<Weekday, SimilarDayLink>

export const SIMILAR_DAY_LINKS_STORAGE_KEY = 'gym-rats-similar-day-links'

/** Default: same weekday last / next week (±7 days). */
export function defaultSimilarDayLinks(): SimilarDayLinks {
  return {
    0: { prev: 0, next: 0 },
    1: { prev: 1, next: 1 },
    2: { prev: 2, next: 2 },
    3: { prev: 3, next: 3 },
    4: { prev: 4, next: 4 },
    5: { prev: 5, next: 5 },
    6: { prev: 6, next: 6 },
  }
}

function isWeekday(value: unknown): value is Weekday {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 6
}

function parseLink(raw: unknown, fallback: SimilarDayLink): SimilarDayLink {
  if (!raw || typeof raw !== 'object') return fallback
  const record = raw as { prev?: unknown; next?: unknown }
  return {
    prev: isWeekday(record.prev) ? record.prev : fallback.prev,
    next: isWeekday(record.next) ? record.next : fallback.next,
  }
}

export function parseSimilarDayLinks(raw: string | null | undefined): SimilarDayLinks {
  const defaults = defaultSimilarDayLinks()
  if (raw == null || raw === '') return defaults
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return defaults
    const record = parsed as Record<string, unknown>
    const links = { ...defaults }
    for (let weekday = 0; weekday <= 6; weekday++) {
      const key = String(weekday)
      links[weekday as Weekday] = parseLink(
        record[key] ?? record[weekday as unknown as string],
        defaults[weekday as Weekday],
      )
    }
    return links
  } catch {
    return defaults
  }
}

export function loadSimilarDayLinks(
  storage: Pick<Storage, 'getItem'> = globalThis.localStorage,
): SimilarDayLinks {
  try {
    return parseSimilarDayLinks(storage.getItem(SIMILAR_DAY_LINKS_STORAGE_KEY))
  } catch {
    return defaultSimilarDayLinks()
  }
}

export function saveSimilarDayLinks(
  links: SimilarDayLinks,
  storage: Pick<Storage, 'setItem'> = globalThis.localStorage,
): void {
  try {
    storage.setItem(SIMILAR_DAY_LINKS_STORAGE_KEY, JSON.stringify(links))
  } catch {
    // Ignore quota / private-mode failures; in-session callers keep their own copy.
  }
}

export function withSimilarDayLink(
  links: SimilarDayLinks,
  weekday: Weekday,
  patch: Partial<SimilarDayLink>,
): SimilarDayLinks {
  return {
    ...links,
    [weekday]: {
      ...links[weekday],
      ...patch,
    },
  }
}

/**
 * Days to step back from `fromWeekday` to land on `target` (always at least 1; same weekday → 7).
 */
export function daysBackToWeekday(fromWeekday: Weekday, target: Weekday): number {
  const delta = (fromWeekday - target + 7) % 7
  return delta === 0 ? 7 : delta
}

/**
 * Days to step forward from `fromWeekday` to land on `target` (always at least 1; same weekday → 7).
 */
export function daysForwardToWeekday(fromWeekday: Weekday, target: Weekday): number {
  const delta = (target - fromWeekday + 7) % 7
  return delta === 0 ? 7 : delta
}

function weekdayFromIso(iso: string): Weekday {
  const [year, month, day] = iso.split('-').map(Number)
  return new Date(year, month - 1, day).getDay() as Weekday
}

function shiftIso(iso: string, days: number): string {
  const [year, month, day] = iso.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  date.setDate(date.getDate() + days)
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** Jump << : most recent Day of the configured previous similar weekday. */
export function similarDayPrev(iso: string, links: SimilarDayLinks): string {
  const from = weekdayFromIso(iso)
  const target = links[from]?.prev ?? from
  return shiftIso(iso, -daysBackToWeekday(from, target))
}

/** Jump >> : next Day of the configured next similar weekday. */
export function similarDayNext(iso: string, links: SimilarDayLinks): string {
  const from = weekdayFromIso(iso)
  const target = links[from]?.next ?? from
  return shiftIso(iso, daysForwardToWeekday(from, target))
}
