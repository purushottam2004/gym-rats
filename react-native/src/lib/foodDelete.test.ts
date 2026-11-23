import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { isFoodInUseError } from './foodDelete.ts'

describe('isFoodInUseError', () => {
  it('detects the delete_food in-use message', () => {
    assert.equal(isFoodInUseError(new Error('a food that has been logged cannot be deleted')), true)
  })

  it('detects foreign-key restrict wording', () => {
    assert.equal(isFoodInUseError(new Error('violates foreign key constraint')), true)
    assert.equal(isFoodInUseError(new Error('ON DELETE RESTRICT')), true)
  })

  it('ignores unrelated errors', () => {
    assert.equal(isFoodInUseError(new Error('not signed in')), false)
  })
})
