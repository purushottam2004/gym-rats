import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  habitDoneOnDay,
  habitRowsForDay,
  isHabitDueOnDay,
  mondayOfWeek,
  weekDates,
  type Habit,
  type HabitDayCount,
} from './habitSchedule.ts'

const daily: Habit = {
  id: 'h1',
  name: 'Morning Brush',
  recurrence: 'per_day',
  frequency: 1,
  weekdays: [1, 2, 3, 4, 5],
  sort_order: 0,
  active: true,
}

const weekly: Habit = {
  id: 'h2',
  name: 'Mobility',
  recurrence: 'per_week',
  frequency: 3,
  weekdays: [0, 1, 2, 3, 4, 5, 6],
  sort_order: 1,
  active: true,
}

describe('mondayOfWeek / weekDates', () => {
  it('treats weeks as Mon–Sun', () => {
    // 2026-11-25 is Wednesday
    assert.equal(mondayOfWeek('2026-11-25'), '2026-11-23')
    assert.deepEqual(weekDates('2026-11-25'), [
      '2026-11-23',
      '2026-11-24',
      '2026-11-25',
      '2026-11-26',
      '2026-11-27',
      '2026-11-28',
      '2026-11-29',
    ])
    // Sunday belongs to the week that started the prior Monday
    assert.equal(mondayOfWeek('2026-11-29'), '2026-11-23')
  })
})

describe('isHabitDueOnDay', () => {
  it('respects weekday set for per_day', () => {
    assert.equal(isHabitDueOnDay(daily, '2026-11-25'), true) // Wed
    assert.equal(isHabitDueOnDay(daily, '2026-11-28'), false) // Sat
  })

  it('always dues per_week habits', () => {
    assert.equal(isHabitDueOnDay(weekly, '2026-11-28'), true)
  })
})

describe('habitDoneOnDay', () => {
  const counts: HabitDayCount[] = [
    { habit_id: 'h1', logged_on: '2026-11-25', count: 1 },
    { habit_id: 'h2', logged_on: '2026-11-24', count: 1 },
    { habit_id: 'h2', logged_on: '2026-11-25', count: 2 },
  ]

  it('uses the day count for per_day', () => {
    assert.equal(habitDoneOnDay(daily, counts, '2026-11-25'), 1)
    assert.equal(habitDoneOnDay(daily, counts, '2026-11-26'), 0)
  })

  it('sums Mon–Sun for per_week', () => {
    assert.equal(habitDoneOnDay(weekly, counts, '2026-11-25'), 3)
  })
})

describe('habitRowsForDay', () => {
  it('filters inactive and not-due, keeps user order', () => {
    const inactive: Habit = { ...daily, id: 'h0', name: 'Z', active: false, sort_order: -1 }
    const rows = habitRowsForDay([weekly, daily, inactive], [], '2026-11-25')
    assert.deepEqual(
      rows.map((r) => r.habit.id),
      ['h1', 'h2'],
    )
  })
})
