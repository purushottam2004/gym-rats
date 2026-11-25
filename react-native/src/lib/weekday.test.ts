import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { weekdayFromDay, weekdayLongName } from './weekday.ts'

describe('weekdayFromDay', () => {
  it('uses the local calendar, not UTC', () => {
    // 2026-11-25 is a Wednesday in local civil time.
    assert.equal(weekdayFromDay('2026-11-25'), 3)
    assert.equal(weekdayLongName(weekdayFromDay('2026-11-25')), 'Wednesday')
  })

  it('maps Sunday and Saturday', () => {
    assert.equal(weekdayFromDay('2026-11-22'), 0)
    assert.equal(weekdayFromDay('2026-11-28'), 6)
  })
})
