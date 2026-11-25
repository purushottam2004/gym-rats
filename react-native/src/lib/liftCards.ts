import type { Lift, SetLog } from './gym'

export type LiftCard = {
  lift: Lift
  rows: SetLog[]
}

function sortSets(rows: SetLog[]): SetLog[] {
  return rows.slice().sort((a, b) => {
    if (a.attempt !== b.attempt) return a.attempt - b.attempt
    if (a.created_at < b.created_at) return -1
    if (a.created_at > b.created_at) return 1
    return 0
  })
}

/**
 * Cards for the Lifts Day view: planned weekday Lifts first (even with no Sets),
 * then any logged Lifts that are not on the plan.
 */
export function liftCardsForDay(sets: SetLog[], planned: Lift[]): LiftCard[] {
  const byLiftId = new Map<string, SetLog[]>()
  for (const row of sets) {
    const list = byLiftId.get(row.lift.id) ?? []
    list.push(row)
    byLiftId.set(row.lift.id, list)
  }

  const cards: LiftCard[] = []
  const seen = new Set<string>()

  for (const lift of planned) {
    if (seen.has(lift.id)) continue
    seen.add(lift.id)
    cards.push({ lift, rows: sortSets(byLiftId.get(lift.id) ?? []) })
  }

  for (const row of sets) {
    if (seen.has(row.lift.id)) continue
    seen.add(row.lift.id)
    cards.push({ lift: row.lift, rows: sortSets(byLiftId.get(row.lift.id) ?? []) })
  }

  return cards
}
