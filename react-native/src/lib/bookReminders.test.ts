import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { planBookChapterReminderFires } from './bookReminders.ts'

describe('planBookChapterReminderFires', () => {
  it('schedules first fire at due time when still in the future', () => {
    const fires = planBookChapterReminderFires({
      chapterId: 'c1',
      settings: { remind_enabled: true, remind_every_minutes: null },
      scheduledOn: '2026-11-27',
      dueTime: '18:00',
      completed: false,
      today: '2026-11-27',
      now: new Date(2026, 10, 27, 10, 0, 0),
    })
    assert.equal(fires.length, 1)
    assert.equal(fires[0]?.identifier, 'book:c1:2026-11-27:0')
    assert.equal(fires[0]?.date.getHours(), 18)
  })

  it('skips completed chapters', () => {
    const fires = planBookChapterReminderFires({
      chapterId: 'c1',
      settings: { remind_enabled: true, remind_every_minutes: 30 },
      scheduledOn: '2026-11-27',
      dueTime: '18:00',
      completed: true,
      today: '2026-11-27',
      now: new Date(2026, 10, 27, 10, 0, 0),
    })
    assert.equal(fires.length, 0)
  })

  it('rolls overdue chapters onto today', () => {
    const fires = planBookChapterReminderFires({
      chapterId: 'c1',
      settings: { remind_enabled: true, remind_every_minutes: null },
      scheduledOn: '2026-11-25',
      dueTime: '09:00',
      completed: false,
      today: '2026-11-27',
      now: new Date(2026, 10, 27, 8, 0, 0),
    })
    assert.equal(fires.length, 1)
    assert.equal(fires[0]?.day, '2026-11-27')
    assert.equal(fires[0]?.date.getHours(), 9)
  })
})
