import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { habitProgressRatio, habitSectionProgress } from './habitProgress.ts'

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

describe('habitSectionProgress', () => {
  it('weights by frequency (target) across habits', () => {
    // 1/1 + 1/3 + 0/1 → 2/5
    const progress = habitSectionProgress([
      { done: 1, target: 1 },
      { done: 1, target: 3 },
      { done: 0, target: 1 },
    ])
    assert.equal(progress.done, 2)
    assert.equal(progress.target, 5)
    assert.equal(progress.ratio, 2 / 5)
    assert.equal(progress.complete, false)
  })

  it('caps per-habit overshoot so one habit cannot overfill the section', () => {
    const progress = habitSectionProgress([
      { done: 5, target: 1 },
      { done: 0, target: 1 },
    ])
    assert.equal(progress.done, 1)
    assert.equal(progress.target, 2)
    assert.equal(progress.ratio, 0.5)
  })

  it('is complete when every weighted unit is done', () => {
    const progress = habitSectionProgress([
      { done: 1, target: 1 },
      { done: 3, target: 3 },
    ])
    assert.equal(progress.complete, true)
    assert.equal(progress.ratio, 1)
  })
})
