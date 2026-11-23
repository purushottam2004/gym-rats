import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { randomFileId } from './fileId.ts'

describe('randomFileId', () => {
  it('returns a unique uuid-shaped id', () => {
    const first = randomFileId()
    const second = randomFileId()
    assert.match(first, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
    assert.notEqual(first, second)
  })
})
