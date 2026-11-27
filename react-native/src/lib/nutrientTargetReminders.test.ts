import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  normalizeMilestoneDrafts,
  normalizeNutrientReminderInput,
  nutrientTargetMet,
  planNutrientMilestoneFires,
  planNutrientTargetFires,
  type NutrientGoalMilestone,
} from './nutrientTargetReminders.ts'

describe('nutrientTargetMet', () => {
  it('treats progress at or above the threshold as met', () => {
    assert.equal(nutrientTargetMet(1200, 1200), true)
    assert.equal(nutrientTargetMet(1199.999, 1200), false)
    assert.equal(nutrientTargetMet(1200.1, 1200), true)
  })
})

describe('normalizeNutrientReminderInput', () => {
  it('requires a min target when enabling', () => {
    const result = normalizeNutrientReminderInput({
      enabled: true,
      firstTimeText: '08:00',
      everyMinutesText: '',
      minAmount: null,
    })
    assert.equal(result.ok, false)
  })

  it('accepts first + optional every', () => {
    const once = normalizeNutrientReminderInput({
      enabled: true,
      firstTimeText: '08:00',
      everyMinutesText: '',
      minAmount: 2000,
    })
    assert.deepEqual(once, {
      ok: true,
      remind_enabled: true,
      remind_first_time: '08:00',
      remind_every_minutes: null,
    })

    const every = normalizeNutrientReminderInput({
      enabled: true,
      firstTimeText: '8:30',
      everyMinutesText: '45',
      minAmount: 2000,
    })
    assert.deepEqual(every, {
      ok: true,
      remind_enabled: true,
      remind_first_time: '08:30',
      remind_every_minutes: 45,
    })
  })
})

describe('normalizeMilestoneDrafts', () => {
  it('skips blank rows and rejects duplicates', () => {
    const ok = normalizeMilestoneDrafts(
      [
        { key: 'a', timeText: '15:00', amountText: '1200' },
        { key: 'b', timeText: '', amountText: '' },
        { key: 'c', timeText: '18:00', amountText: '1800' },
      ],
      'Energy',
    )
    assert.equal(ok.ok, true)
    if (ok.ok) {
      assert.deepEqual(ok.milestones, [
        { remind_at: '15:00', threshold_amount: 1200, sort_order: 0 },
        { remind_at: '18:00', threshold_amount: 1800, sort_order: 2 },
      ])
    }

    const dup = normalizeMilestoneDrafts(
      [
        { key: 'a', timeText: '15:00', amountText: '1200' },
        { key: 'b', timeText: '15:00', amountText: '1400' },
      ],
      'Energy',
    )
    assert.equal(dup.ok, false)
  })
})

describe('planNutrientTargetFires', () => {
  const now = new Date(2026, 10, 27, 10, 0, 0)
  const today = '2026-11-27'
  const milestones: NutrientGoalMilestone[] = [
    {
      id: 'm1',
      nutrient_id: 'n1',
      remind_at: { hour: 15, minute: 0 },
      threshold_amount: 1200,
      sort_order: 0,
    },
    {
      id: 'm2',
      nutrient_id: 'n1',
      remind_at: { hour: 18, minute: 0 },
      threshold_amount: 1800,
      sort_order: 1,
    },
  ]

  it('schedules unmet milestones and skips met ones for today', () => {
    const fires = planNutrientMilestoneFires({
      nutrientId: 'n1',
      milestones,
      now,
      today,
      progressToday: 1300,
    })
    const todayFires = fires.filter((fire) => fire.day === today)
    assert.equal(todayFires.length, 1)
    assert.equal(todayFires[0]?.threshold_amount, 1800)
  })

  it('plans full-target follow-ups while incomplete', () => {
    const fires = planNutrientTargetFires({
      nutrientId: 'n1',
      settings: {
        remind_enabled: true,
        remind_first_time: { hour: 9, minute: 0 },
        remind_every_minutes: 60,
        min_amount: 2000,
      },
      milestones: [],
      now,
      today,
      progressToday: 500,
    })
    const todayFull = fires.filter((fire) => fire.day === today && fire.kind === 'full')
    assert.ok(todayFull.length >= 1)
    assert.ok(todayFull.every((fire) => fire.date.getTime() > now.getTime()))
  })
})
