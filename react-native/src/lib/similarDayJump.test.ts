import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  daysBackToWeekday,
  daysForwardToWeekday,
  defaultSimilarDayLinks,
  parseSimilarDayLinks,
  similarDayNext,
  similarDayPrev,
  withSimilarDayLink,
} from './similarDayJump.ts'

describe('similarDayJump', () => {
  it('defaults same weekday to ±7 days', () => {
    const links = defaultSimilarDayLinks()
    // 2026-11-23 is Monday
    assert.equal(similarDayPrev('2026-11-23', links), '2026-11-16')
    assert.equal(similarDayNext('2026-11-23', links), '2026-11-30')
  })

  it('jumps Monday prev→Wed and next→Thu', () => {
    let links = defaultSimilarDayLinks()
    links = withSimilarDayLink(links, 1, { prev: 3, next: 4 })
    // Monday 2026-11-23 → last Wed 2026-11-18, next Thu 2026-11-26
    assert.equal(similarDayPrev('2026-11-23', links), '2026-11-18')
    assert.equal(similarDayNext('2026-11-23', links), '2026-11-26')
  })

  it('computes wrap-around day deltas', () => {
    assert.equal(daysBackToWeekday(1, 1), 7)
    assert.equal(daysBackToWeekday(1, 3), 5)
    assert.equal(daysBackToWeekday(4, 1), 3)
    assert.equal(daysForwardToWeekday(1, 1), 7)
    assert.equal(daysForwardToWeekday(1, 4), 3)
    assert.equal(daysForwardToWeekday(5, 1), 3)
  })

  it('parses partial JSON and ignores bad entries', () => {
    const parsed = parseSimilarDayLinks(
      JSON.stringify({
        '1': { prev: 3, next: 4 },
        '2': { prev: 99, next: 'nope' },
      }),
    )
    assert.deepEqual(parsed[1], { prev: 3, next: 4 })
    assert.deepEqual(parsed[2], { prev: 2, next: 2 })
    assert.deepEqual(parsed[0], { prev: 0, next: 0 })
  })

  it('falls back on invalid JSON', () => {
    assert.deepEqual(parseSimilarDayLinks('not-json'), defaultSimilarDayLinks())
    assert.deepEqual(parseSimilarDayLinks(null), defaultSimilarDayLinks())
  })
})
