import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  formatReminderTime,
  habitCompletedAtForDay,
  normalizeHabitReminderInput,
  parseReminderTime,
  planHabitReminderFires,
} from './habitReminders.ts'

describe('parseReminderTime / formatReminderTime', () => {
  it('parses HH:MM and HH:MM:SS', () => {
    assert.deepEqual(parseReminderTime('8:05'), { hour: 8, minute: 5 })
    assert.deepEqual(parseReminderTime('08:05:00'), { hour: 8, minute: 5 })
    assert.equal(parseReminderTime('25:00'), null)
    assert.equal(parseReminderTime(''), null)
  })

  it('round-trips', () => {
    assert.equal(formatReminderTime({ hour: 7, minute: 30 }), '07:30')
  })
})

describe('normalizeHabitReminderInput', () => {
  it('clears fields when disabled', () => {
    assert.deepEqual(
      normalizeHabitReminderInput({
        enabled: false,
        firstTimeText: '08:00',
        everyMinutesText: '30',
      }),
      {
        ok: true,
        remind_enabled: false,
        remind_first_time: null,
        remind_every_minutes: null,
      },
    )
  })

  it('requires a valid first time when enabled', () => {
    const bad = normalizeHabitReminderInput({
      enabled: true,
      firstTimeText: 'nope',
      everyMinutesText: '',
    })
    assert.equal(bad.ok, false)
  })

  it('allows first-only or repeat >= 5', () => {
    assert.deepEqual(
      normalizeHabitReminderInput({
        enabled: true,
        firstTimeText: '09:15',
        everyMinutesText: '',
      }),
      {
        ok: true,
        remind_enabled: true,
        remind_first_time: '09:15',
        remind_every_minutes: null,
      },
    )
    assert.deepEqual(
      normalizeHabitReminderInput({
        enabled: true,
        firstTimeText: '09:15',
        everyMinutesText: '15',
      }),
      {
        ok: true,
        remind_enabled: true,
        remind_first_time: '09:15',
        remind_every_minutes: 15,
      },
    )
    const tooSmall = normalizeHabitReminderInput({
      enabled: true,
      firstTimeText: '09:15',
      everyMinutesText: '4',
    })
    assert.equal(tooSmall.ok, false)
  })
})

describe('planHabitReminderFires', () => {
  it('schedules first + follow-ups today while incomplete', () => {
    // Wednesday 2026-11-25 07:00 local
    const now = new Date(2026, 10, 25, 7, 0, 0, 0)
    const fires = planHabitReminderFires({
      habitId: 'h1',
      settings: {
        remind_enabled: true,
        remind_first_time: { hour: 8, minute: 0 },
        remind_every_minutes: 60,
      },
      isDueOnDay: () => true,
      now,
      today: '2026-11-25',
      completeToday: false,
    })
    assert.equal(fires[0]?.identifier, 'habit:h1:2026-11-25:0')
    assert.equal(fires[0]?.date.getHours(), 8)
    assert.ok(fires.some((fire) => fire.index === 1 && fire.date.getHours() === 9))
    assert.ok(fires.some((fire) => fire.day === '2026-11-26' && fire.index === 0))
    assert.ok(!fires.some((fire) => fire.day === '2026-11-26' && fire.index > 0))
  })

  it('skips today follow-ups when already complete', () => {
    const now = new Date(2026, 10, 25, 7, 0, 0, 0)
    const fires = planHabitReminderFires({
      habitId: 'h1',
      settings: {
        remind_enabled: true,
        remind_first_time: { hour: 8, minute: 0 },
        remind_every_minutes: 30,
      },
      isDueOnDay: () => true,
      now,
      today: '2026-11-25',
      completeToday: true,
    })
    assert.ok(fires.every((fire) => fire.index === 0))
    assert.ok(fires.some((fire) => fire.day === '2026-11-25'))
  })

  it('omits past first time and keeps later repeats', () => {
    // 08:29 → first (08:00) is past; next follow-up is 08:30 (index 1).
    const now = new Date(2026, 10, 25, 8, 29, 0, 0)
    const fires = planHabitReminderFires({
      habitId: 'h1',
      settings: {
        remind_enabled: true,
        remind_first_time: { hour: 8, minute: 0 },
        remind_every_minutes: 30,
      },
      isDueOnDay: (day) => day === '2026-11-25',
      now,
      today: '2026-11-25',
      completeToday: false,
    })
    assert.ok(!fires.some((fire) => fire.index === 0 && fire.day === '2026-11-25'))
    assert.ok(fires.some((fire) => fire.index === 1 && fire.date.getHours() === 8 && fire.date.getMinutes() === 30))
  })
})

describe('habitCompletedAtForDay', () => {
  it('reads the day stamp for per_day Habits', () => {
    assert.equal(
      habitCompletedAtForDay({
        habitId: 'h1',
        recurrence: 'per_day',
        complete: true,
        day: '2026-11-25',
        weekDays: [],
        counts: [
          {
            habit_id: 'h1',
            logged_on: '2026-11-25',
            completed_at: '2026-11-25T03:10:00.000Z',
          },
        ],
      }),
      '2026-11-25T03:10:00.000Z',
    )
  })

  it('picks the latest week stamp for per_week Habits', () => {
    assert.equal(
      habitCompletedAtForDay({
        habitId: 'h2',
        recurrence: 'per_week',
        complete: true,
        day: '2026-11-25',
        weekDays: ['2026-11-23', '2026-11-24', '2026-11-25'],
        counts: [
          {
            habit_id: 'h2',
            logged_on: '2026-11-24',
            completed_at: '2026-11-24T10:00:00.000Z',
          },
          {
            habit_id: 'h2',
            logged_on: '2026-11-25',
            completed_at: '2026-11-25T12:00:00.000Z',
          },
        ],
      }),
      '2026-11-25T12:00:00.000Z',
    )
  })
})
