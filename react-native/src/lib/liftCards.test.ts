import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { liftCardsForDay } from './liftCards.ts'
import type { Lift, SetLog } from './gym.ts'

const bench: Lift = { id: 'b', name: 'Flat Bench Press', muscle_id: null, image_path: null }
const squat: Lift = { id: 's', name: 'Squat', muscle_id: null, image_path: null }
const rowLift: Lift = { id: 'r', name: 'Row', muscle_id: null, image_path: null }

function set(partial: Partial<SetLog> & { lift: Lift; attempt: number }): SetLog {
  return {
    id: partial.id ?? `${partial.lift.id}-${partial.attempt}`,
    attempt: partial.attempt,
    reps: partial.reps ?? 5,
    load_kg: partial.load_kg ?? 60,
    logged_on: partial.logged_on ?? '2026-11-25',
    created_at: partial.created_at ?? '2026-11-25T10:00:00Z',
    lift: partial.lift,
  }
}

describe('liftCardsForDay', () => {
  it('shows planned lifts with no sets', () => {
    const cards = liftCardsForDay([], [bench, squat])
    assert.deepEqual(
      cards.map((c) => c.lift.name),
      ['Flat Bench Press', 'Squat'],
    )
    assert.equal(cards[0]?.rows.length, 0)
  })

  it('keeps plan order and appends unplanned logged lifts', () => {
    const sets = [
      set({ lift: rowLift, attempt: 1 }),
      set({ lift: squat, attempt: 2, created_at: '2026-11-25T11:00:00Z' }),
      set({ lift: squat, attempt: 1, created_at: '2026-11-25T10:00:00Z' }),
    ]
    const cards = liftCardsForDay(sets, [bench, squat])
    assert.deepEqual(
      cards.map((c) => c.lift.name),
      ['Flat Bench Press', 'Squat', 'Row'],
    )
    assert.deepEqual(
      cards[1]?.rows.map((r) => r.attempt),
      [1, 2],
    )
  })
})
