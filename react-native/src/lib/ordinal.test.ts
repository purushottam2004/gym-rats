import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { ordinalSuffix } from './ordinal.ts'

describe('ordinalSuffix', () => {
  it('uses st, nd, rd, and th for common set numbers', () => {
    assert.equal(ordinalSuffix(1), 'st')
    assert.equal(ordinalSuffix(2), 'nd')
    assert.equal(ordinalSuffix(3), 'rd')
    assert.equal(ordinalSuffix(4), 'th')
    assert.equal(ordinalSuffix(5), 'th')
  })

  it('keeps teen exceptions on 11–13', () => {
    assert.equal(ordinalSuffix(11), 'th')
    assert.equal(ordinalSuffix(12), 'th')
    assert.equal(ordinalSuffix(13), 'th')
    assert.equal(ordinalSuffix(21), 'st')
    assert.equal(ordinalSuffix(22), 'nd')
    assert.equal(ordinalSuffix(23), 'rd')
  })
})
