import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  OTHER_LIFTS_MUSCLE_ID,
  liftCatalogGroups,
  liftCatalogGroupsWithLifts,
  type LiftWithMuscle,
  type Muscle,
} from './liftCatalog.ts'

const chest: Muscle = { id: 'm-chest', name: 'Chest', sort_order: 0 }
const back: Muscle = { id: 'm-back', name: 'Back', sort_order: 1 }
const empty: Muscle = { id: 'm-empty', name: 'Empty', sort_order: 2 }

const bench: LiftWithMuscle = { id: 'l1', name: 'Bench Press', muscle_id: 'm-chest' }
const fly: LiftWithMuscle = { id: 'l2', name: 'Cable Fly', muscle_id: 'm-chest' }
const row: LiftWithMuscle = { id: 'l3', name: 'Barbell Row', muscle_id: 'm-back' }
const other: LiftWithMuscle = { id: 'l4', name: 'Farmer Carry', muscle_id: null }
const orphan: LiftWithMuscle = { id: 'l5', name: 'Ghost Lift', muscle_id: 'gone' }

describe('liftCatalogGroups', () => {
  it('groups lifts under muscles in sort order, then Other lifts', () => {
    const groups = liftCatalogGroups([other, row, fly, bench, orphan], [back, empty, chest])
    assert.deepEqual(
      groups.map((g) => ({ key: g.key, title: g.title, names: g.lifts.map((l) => l.name) })),
      [
        { key: 'm-chest', title: 'Chest', names: ['Bench Press', 'Cable Fly'] },
        { key: 'm-back', title: 'Back', names: ['Barbell Row'] },
        { key: 'm-empty', title: 'Empty', names: [] },
        {
          key: OTHER_LIFTS_MUSCLE_ID,
          title: 'Other lifts',
          names: ['Farmer Carry', 'Ghost Lift'],
        },
      ],
    )
  })

  it('still returns Other when there are no muscles', () => {
    const groups = liftCatalogGroups([other], [])
    assert.equal(groups.length, 1)
    assert.equal(groups[0]?.key, OTHER_LIFTS_MUSCLE_ID)
    assert.equal(groups[0]?.lifts[0]?.name, 'Farmer Carry')
  })
})

describe('liftCatalogGroupsWithLifts', () => {
  it('hides empty muscle groups', () => {
    const groups = liftCatalogGroupsWithLifts([bench], [chest, empty])
    assert.deepEqual(
      groups.map((g) => g.key),
      ['m-chest'],
    )
  })
})
