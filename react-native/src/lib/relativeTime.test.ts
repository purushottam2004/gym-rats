import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { formatRelativeTime } from './relativeTime.ts'

describe('formatRelativeTime', () => {
  it('labels minutes and hours ago', () => {
    const now = new Date('2026-11-24T12:00:00')
    assert.equal(formatRelativeTime('2026-11-24T11:50:00', now), '10m')
    assert.equal(formatRelativeTime('2026-11-24T09:00:00', now), '3h')
  })

  it('falls back to a short date for older posts', () => {
    const now = new Date('2026-11-24T12:00:00')
    const label = formatRelativeTime('2026-11-01T12:00:00', now)
    assert.match(label, /Nov/)
  })
})
