import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { compareSetsByAttemptThenCreated } from './setOrder.ts'

describe('compareSetsByAttemptThenCreated', () => {
  it('orders by attempt ascending', () => {
    const rows = [
      { attempt: 3, created_at: '2026-11-25T10:00:00Z' },
      { attempt: 1, created_at: '2026-11-25T12:00:00Z' },
      { attempt: 2, created_at: '2026-11-25T11:00:00Z' },
    ]
    rows.sort(compareSetsByAttemptThenCreated)
    assert.deepEqual(
      rows.map((r) => r.attempt),
      [1, 2, 3],
    )
  })

  it('breaks ties with created_at ascending', () => {
    const rows = [
      { attempt: 2, created_at: '2026-11-25T12:00:00Z' },
      { attempt: 2, created_at: '2026-11-25T10:00:00Z' },
      { attempt: 1, created_at: '2026-11-25T13:00:00Z' },
    ]
    rows.sort(compareSetsByAttemptThenCreated)
    assert.deepEqual(rows, [
      { attempt: 1, created_at: '2026-11-25T13:00:00Z' },
      { attempt: 2, created_at: '2026-11-25T10:00:00Z' },
      { attempt: 2, created_at: '2026-11-25T12:00:00Z' },
    ])
  })
})
