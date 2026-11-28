import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  HABIT_REMINDER_MUTE_STORAGE_KEY,
  isHabitReminderMutedOnDay,
  loadHabitReminderMuteByDay,
  parseHabitReminderMuteByDay,
  pruneHabitReminderMutesBefore,
  saveHabitReminderMuteByDay,
  setHabitReminderMutedOnDay,
} from './habitReminderMute.ts'

describe('parseHabitReminderMuteByDay', () => {
  it('returns empty for null / invalid', () => {
    assert.deepEqual(parseHabitReminderMuteByDay(null), {})
    assert.deepEqual(parseHabitReminderMuteByDay(''), {})
    assert.deepEqual(parseHabitReminderMuteByDay('not-json'), {})
    assert.deepEqual(parseHabitReminderMuteByDay('[]'), {})
  })

  it('keeps ISO days and string habit ids', () => {
    const parsed = parseHabitReminderMuteByDay(
      JSON.stringify({
        '2026-11-28': ['h1', 'h1', 'h2'],
        bad: ['h3'],
        '2026-11-29': [1, 'h4', null],
      }),
    )
    assert.deepEqual(parsed, {
      '2026-11-28': ['h1', 'h2'],
      '2026-11-29': ['h4'],
    })
  })
})

describe('setHabitReminderMutedOnDay / isHabitReminderMutedOnDay', () => {
  it('toggles without mutating the original map', () => {
    const empty = {}
    const muted = setHabitReminderMutedOnDay(empty, 'h1', '2026-11-28', true)
    assert.deepEqual(empty, {})
    assert.equal(isHabitReminderMutedOnDay(muted, 'h1', '2026-11-28'), true)
    assert.equal(isHabitReminderMutedOnDay(muted, 'h1', '2026-11-29'), false)

    const cleared = setHabitReminderMutedOnDay(muted, 'h1', '2026-11-28', false)
    assert.equal(isHabitReminderMutedOnDay(cleared, 'h1', '2026-11-28'), false)
    assert.equal(Object.prototype.hasOwnProperty.call(cleared, '2026-11-28'), false)
  })
})

describe('pruneHabitReminderMutesBefore', () => {
  it('drops days before the keep-from day', () => {
    const pruned = pruneHabitReminderMutesBefore(
      {
        '2026-11-26': ['h1'],
        '2026-11-27': ['h2'],
        '2026-11-28': ['h3'],
      },
      '2026-11-27',
    )
    assert.deepEqual(pruned, {
      '2026-11-27': ['h2'],
      '2026-11-28': ['h3'],
    })
  })
})

describe('load / save HabitReminderMuteByDay', () => {
  it('round-trips through mock storage', () => {
    const store = new Map<string, string>()
    const storage = {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value)
      },
    }
    const map = setHabitReminderMutedOnDay({}, 'h1', '2026-11-28', true)
    saveHabitReminderMuteByDay(map, storage)
    assert.ok(store.get(HABIT_REMINDER_MUTE_STORAGE_KEY))
    assert.deepEqual(loadHabitReminderMuteByDay(storage), map)
  })
})
