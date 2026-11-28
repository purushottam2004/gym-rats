import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  dateToReminderTime,
  formatReminderTime,
  formatReminderTimeDisplay,
  habitCompletedAtForDay,
  MAX_EVERY_FOLLOWUPS_SCHEDULED,
  normalizeHabitReminderInput,
  parseReminderTime,
  planHabitReminderFires,
  reminderTimeToDate,
  selectHabitReminderFiresForSchedule,
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

  it('converts to/from Date for the system time picker', () => {
    const date = reminderTimeToDate({ hour: 22, minute: 5 })
    assert.equal(date.getHours(), 22)
    assert.equal(date.getMinutes(), 5)
    assert.deepEqual(dateToReminderTime(date), { hour: 22, minute: 5 })
  })

  it('formats a 12h locale label with AM/PM', () => {
    assert.match(formatReminderTimeDisplay({ hour: 10, minute: 0 }, 'en-US'), /10:00\s*AM/i)
    assert.match(formatReminderTimeDisplay({ hour: 22, minute: 5 }, 'en-US'), /10:05\s*PM/i)
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

  it('caps every-N follow-ups so a full day of nags is not pre-scheduled', () => {
    const now = new Date(2026, 10, 25, 7, 0, 0, 0)
    const fires = planHabitReminderFires({
      habitId: 'h1',
      settings: {
        remind_enabled: true,
        remind_first_time: { hour: 8, minute: 0 },
        remind_every_minutes: 10,
      },
      isDueOnDay: (day) => day === '2026-11-25',
      now,
      today: '2026-11-25',
      completeToday: false,
    })
    const followUps = fires.filter((fire) => fire.index > 0)
    assert.equal(followUps.length, MAX_EVERY_FOLLOWUPS_SCHEDULED)
    assert.ok(fires.some((fire) => fire.index === 0))
  })

  it('skips muted days but still schedules later unmuted due days', () => {
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
      isMutedOnDay: (day) => day === '2026-11-25',
    })
    assert.ok(!fires.some((fire) => fire.day === '2026-11-25'))
    assert.ok(fires.some((fire) => fire.day === '2026-11-26' && fire.index === 0))
  })
})

describe('selectHabitReminderFiresForSchedule', () => {
  it('keeps the soonest fires so early habits beat later floods', () => {
    const brush = planHabitReminderFires({
      habitId: 'brush',
      settings: {
        remind_enabled: true,
        remind_first_time: { hour: 8, minute: 0 },
        remind_every_minutes: 30,
      },
      isDueOnDay: () => true,
      now: new Date(2026, 10, 28, 7, 0, 0, 0),
      today: '2026-11-28',
      completeToday: false,
    })
    const kojic = planHabitReminderFires({
      habitId: 'kojic',
      settings: {
        remind_enabled: true,
        remind_first_time: { hour: 10, minute: 0 },
        remind_every_minutes: 20,
      },
      isDueOnDay: () => true,
      now: new Date(2026, 10, 28, 7, 0, 0, 0),
      today: '2026-11-28',
      completeToday: false,
    })
    // Limit 4: brush first + 2 follow-ups, then kojic's 10:00 first (not kojic's week flood).
    const selected = selectHabitReminderFiresForSchedule([...kojic, ...brush], 4)
    assert.equal(selected.length, 4)
    assert.equal(selected[0]?.habitId, 'brush')
    assert.equal(selected[0]?.date.getHours(), 8)
    assert.equal(selected[0]?.index, 0)
    assert.ok(selected.some((fire) => fire.habitId === 'kojic' && fire.index === 0))
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
