import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  FEATURE_NOTIFIED_FINGERPRINT_KEY,
  featureUpdateNotification,
  isFeatureTab,
  markFeatureReadLocal,
  readNotifiedFingerprint,
  unreadCountForTab,
  unreadFingerprint,
  writeNotifiedFingerprint,
  type FeatureRow,
} from './featureUpdates.ts'

const sample: FeatureRow[] = [
  {
    id: 'f1',
    tab: 'habits',
    title: 'Swipe',
    summary: 'Swipe to complete',
    body: 'Details',
    sort_order: 10,
    published_at: '2026-11-27T00:00:00.000Z',
    read_at: null,
  },
  {
    id: 'f2',
    tab: 'habits',
    title: 'Reminders',
    summary: 'Local reminders',
    body: 'Details',
    sort_order: 20,
    published_at: '2026-11-27T00:00:00.000Z',
    read_at: '2026-11-27T01:00:00.000Z',
  },
  {
    id: 'f3',
    tab: 'diet',
    title: 'Log food',
    summary: 'Track intakes',
    body: 'Details',
    sort_order: 10,
    published_at: '2026-11-27T00:00:00.000Z',
    read_at: null,
  },
]

describe('isFeatureTab', () => {
  it('accepts known tabs only', () => {
    assert.equal(isFeatureTab('habits'), true)
    assert.equal(isFeatureTab('nope'), false)
  })
})

describe('unread helpers', () => {
  it('counts unread per tab', () => {
    assert.equal(unreadCountForTab(sample, 'habits'), 1)
    assert.equal(unreadCountForTab(sample, 'diet'), 1)
    assert.equal(unreadCountForTab(sample, 'posts'), 0)
  })

  it('builds a stable fingerprint from unread ids', () => {
    assert.equal(unreadFingerprint(sample), 'f1,f3')
  })

  it('marks a feature read locally', () => {
    const next = markFeatureReadLocal(sample, 'f1', '2026-11-27T02:00:00.000Z')
    assert.equal(next.find((row) => row.id === 'f1')?.read_at, '2026-11-27T02:00:00.000Z')
    assert.equal(unreadCountForTab(next, 'habits'), 0)
  })
})

describe('featureUpdateNotification', () => {
  it('summarizes one or many unread features', () => {
    const one = featureUpdateNotification([sample[0]!])
    assert.equal(one.title, 'New in Echo')
    assert.match(one.body, /Swipe/)

    const many = featureUpdateNotification([sample[0]!, sample[2]!])
    assert.match(many.body, /2 new features/)
  })
})

describe('notified fingerprint storage', () => {
  it('round-trips through a mock storage', () => {
    const store = new Map<string, string>()
    const storage = {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value)
      },
    }
    assert.equal(readNotifiedFingerprint(storage), null)
    writeNotifiedFingerprint('a,b', storage)
    assert.equal(store.get(FEATURE_NOTIFIED_FINGERPRINT_KEY), 'a,b')
    assert.equal(readNotifiedFingerprint(storage), 'a,b')
  })
})
