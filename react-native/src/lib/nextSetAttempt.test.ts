import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { nextSetAttempt } from './nextSetAttempt.ts'

describe('nextSetAttempt', () => {
  it('returns 1 when no attempts exist', () => {
    assert.equal(nextSetAttempt([]), 1)
  })

  it('returns the lowest unused number in 1–5', () => {
    assert.equal(nextSetAttempt([1, 2, 3]), 4)
    assert.equal(nextSetAttempt([1, 3]), 2)
    assert.equal(nextSetAttempt([2, 3, 4, 5]), 1)
  })

  it('returns 1 when every slot is taken', () => {
    assert.equal(nextSetAttempt([1, 2, 3, 4, 5]), 1)
  })
})
