import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { nextSetAttempt } from './nextSetAttempt.ts'

describe('nextSetAttempt', () => {
  it('returns 1 when no attempts exist', () => {
    assert.equal(nextSetAttempt([]), 1)
  })

  it('returns one past the highest attempt', () => {
    assert.equal(nextSetAttempt([1, 2, 3]), 4)
    assert.equal(nextSetAttempt([1, 3]), 4)
    assert.equal(nextSetAttempt([2]), 3)
  })

  it('stays on 5 when the highest is already 5', () => {
    assert.equal(nextSetAttempt([2, 3, 4, 5]), 5)
    assert.equal(nextSetAttempt([1, 2, 3, 4, 5]), 5)
    assert.equal(nextSetAttempt([5]), 5)
  })
})
