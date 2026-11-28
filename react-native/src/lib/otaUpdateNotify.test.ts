import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  OTA_NOTIFIED_UPDATE_ID_KEY,
  formatUpdateWhen,
  otaAppliedNotification,
  otaDownloadedNotification,
  readNotifiedUpdateId,
  writeNotifiedUpdateId,
} from './otaUpdateNotify.ts'

describe('formatUpdateWhen', () => {
  it('returns null for missing or invalid dates', () => {
    assert.equal(formatUpdateWhen(null), null)
    assert.equal(formatUpdateWhen(undefined), null)
    assert.equal(formatUpdateWhen(new Date(Number.NaN)), null)
  })

  it('returns a non-empty string for a real date', () => {
    const text = formatUpdateWhen(new Date('2026-11-26T08:00:00.000Z'))
    assert.ok(text && text.length > 0)
  })
})

describe('otaDownloadedNotification / otaAppliedNotification', () => {
  it('includes a when clause when createdAt is set', () => {
    const createdAt = new Date('2026-11-26T08:00:00.000Z')
    const downloaded = otaDownloadedNotification(createdAt)
    assert.equal(downloaded.title, 'Echo update ready')
    assert.match(downloaded.body, /downloaded and will open now/)
    assert.match(downloaded.body, /A new version \(/)

    const applied = otaAppliedNotification(createdAt)
    assert.equal(applied.title, 'Echo updated')
    assert.match(applied.body, /latest update \(/)
  })

  it('omits the when clause when createdAt is missing', () => {
    assert.equal(
      otaDownloadedNotification(null).body,
      'A new version was downloaded and will open now.',
    )
    assert.equal(otaAppliedNotification(undefined).body, 'You are on the latest update.')
  })
})

describe('readNotifiedUpdateId / writeNotifiedUpdateId', () => {
  it('round-trips through a Storage-like map', () => {
    const map = new Map<string, string>()
    const storage = {
      getItem: (key: string) => map.get(key) ?? null,
      setItem: (key: string, value: string) => {
        map.set(key, value)
      },
    }
    assert.equal(readNotifiedUpdateId(storage), null)
    writeNotifiedUpdateId('update-abc', storage)
    assert.equal(map.get(OTA_NOTIFIED_UPDATE_ID_KEY), 'update-abc')
    assert.equal(readNotifiedUpdateId(storage), 'update-abc')
  })
})
