/** Pure Lift catalog grouping helpers (no cross-module runtime imports — keeps node:test happy). */

export type Muscle = {
  id: string
  name: string
  sort_order: number
}

export type LiftWithMuscle = {
  id: string
  name: string
  muscle_id: string | null
}

export const OTHER_LIFTS_MUSCLE_ID = '__other_lifts__'

export type LiftCatalogGroup = {
  /** Named muscle id, or `OTHER_LIFTS_MUSCLE_ID` for unassigned lifts. */
  key: string
  title: string
  lifts: LiftWithMuscle[]
}

/**
 * Catalog grouping: every muscle (even empty), then Other lifts for null / orphaned.
 * Lifts within a group are sorted by name.
 */
export function liftCatalogGroups(
  lifts: LiftWithMuscle[],
  muscles: Muscle[],
): LiftCatalogGroup[] {
  const sortedLifts = lifts.slice().sort((a, b) => a.name.localeCompare(b.name))
  const muscleOrder = muscles.slice().sort((a, b) => {
    if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order
    return a.name.localeCompare(b.name)
  })
  const knownIds = new Set(muscleOrder.map((muscle) => muscle.id))

  const groups = muscleOrder.map((muscle) => ({
    key: muscle.id,
    title: muscle.name,
    lifts: sortedLifts.filter((lift) => lift.muscle_id === muscle.id),
  }))

  const other = sortedLifts.filter(
    (lift) => lift.muscle_id == null || !knownIds.has(lift.muscle_id),
  )
  groups.push({
    key: OTHER_LIFTS_MUSCLE_ID,
    title: 'Other lifts',
    lifts: other,
  })

  return groups
}

/** Catalog display: only groups that have at least one lift (muscles with none stay hidden). */
export function liftCatalogGroupsWithLifts(
  lifts: LiftWithMuscle[],
  muscles: Muscle[],
): LiftCatalogGroup[] {
  return liftCatalogGroups(lifts, muscles).filter((group) => group.lifts.length > 0)
}
