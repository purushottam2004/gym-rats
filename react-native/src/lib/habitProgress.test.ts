import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { habitProgressRatio } from './habitProgress.ts'

describe('habitProgressRatio', () => {
  it('maps partial progress like 2/3', () => {
    assert.equal(habitProgressRatio(2, 3), 2 / 3)
  })

  it('caps at full when complete or overshot', () => {
    assert.equal(habitProgressRatio(3, 3), 1)
    assert.equal(habitProgressRatio(4, 3), 1)
  })

  it('is zero with no progress or invalid target', () => {
    assert.equal(habitProgressRatio(0, 3), 0)
    assert.equal(habitProgressRatio(1, 0), 0)
  })
})
