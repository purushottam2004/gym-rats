import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  consumeOtherFoodDraft,
  formatEstimatedAmount,
  setOtherFoodDraft,
} from './otherFoodDraft.ts'

describe('otherFoodDraft', () => {
  it('stores a draft and consumes it once', () => {
    setOtherFoodDraft({ name: 'Salad', amounts: { a: '12' } })
    assert.deepEqual(consumeOtherFoodDraft(), { name: 'Salad', amounts: { a: '12' } })
    assert.equal(consumeOtherFoodDraft(), null)
  })
})

describe('formatEstimatedAmount', () => {
  it('formats whole numbers and one decimal', () => {
    assert.equal(formatEstimatedAmount(12), '12')
    assert.equal(formatEstimatedAmount(12.25), '12.3')
    assert.equal(formatEstimatedAmount(0), '')
  })
})
