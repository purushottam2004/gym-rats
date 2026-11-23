import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { isLiftInUseError } from './liftDelete.ts'

describe('isLiftInUseError', () => {
  it('detects foreign-key restrict wording', () => {
    assert.equal(isLiftInUseError(new Error('violates foreign key constraint')), true)
    assert.equal(isLiftInUseError(new Error('ON DELETE RESTRICT')), true)
  })

  it('ignores unrelated errors', () => {
    assert.equal(isLiftInUseError(new Error('not signed in')), false)
  })
})
