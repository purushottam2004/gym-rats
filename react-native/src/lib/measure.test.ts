import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { basisForMeasure, measureLabel } from './measure.ts'

describe('measureLabel', () => {
  it('keeps gram and millilitre codes and names the count unit', () => {
    assert.equal(measureLabel('g'), 'g')
    assert.equal(measureLabel('ml'), 'ml')
    assert.equal(measureLabel('unit'), 'Unit')
  })
})

describe('basisForMeasure', () => {
  it('keeps a per-kilogram basis only for grams', () => {
    assert.equal(basisForMeasure('g', 'per_kg'), 'per_kg')
    assert.equal(basisForMeasure('g', 'per_100'), 'per_100')
    assert.equal(basisForMeasure('ml', 'per_kg'), 'per_100')
    assert.equal(basisForMeasure('unit', 'per_kg'), 'per_100')
  })
})
