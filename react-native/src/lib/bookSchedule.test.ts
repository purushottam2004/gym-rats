import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  applyChapterCompletion,
  chapterIsComplete,
  chaptersByBookForDay,
  chaptersForDay,
  type Book,
  type BookChapter,
} from './bookSchedule.ts'

function book(partial: Partial<Book> & Pick<Book, 'id' | 'title'>): Book {
  return {
    author: null,
    remind_enabled: false,
    remind_every_minutes: null,
    active: true,
    sort_order: 0,
    ...partial,
  }
}

function chapter(
  partial: Partial<BookChapter> & Pick<BookChapter, 'id' | 'book_id' | 'title'>,
): BookChapter {
  return {
    sort_order: 0,
    page_start: null,
    page_end: null,
    scheduled_on: null,
    due_time: null,
    completed_at: null,
    ...partial,
  }
}

describe('chaptersForDay', () => {
  it('lists exact schedule matches', () => {
    const books = new Map([['b1', book({ id: 'b1', title: 'Dune' })]])
    const rows = chaptersForDay({
      booksById: books,
      today: '2026-11-27',
      day: '2026-11-27',
      chapters: [
        chapter({
          id: 'c1',
          book_id: 'b1',
          title: 'Ch 1',
          scheduled_on: '2026-11-27',
          due_time: '09:00',
        }),
        chapter({
          id: 'c2',
          book_id: 'b1',
          title: 'Ch 2',
          scheduled_on: '2026-11-28',
          due_time: '09:00',
        }),
      ],
    })
    assert.equal(rows.length, 1)
    assert.equal(rows[0]?.id, 'c1')
    assert.equal(rows[0]?.overdue, false)
  })

  it('rolls incomplete earlier chapters into today', () => {
    const books = new Map([['b1', book({ id: 'b1', title: 'Dune' })]])
    const rows = chaptersForDay({
      booksById: books,
      today: '2026-11-27',
      day: '2026-11-27',
      chapters: [
        chapter({
          id: 'c1',
          book_id: 'b1',
          title: 'Ch 1',
          scheduled_on: '2026-11-25',
          due_time: '08:00',
        }),
        chapter({
          id: 'c2',
          book_id: 'b1',
          title: 'Ch 2',
          scheduled_on: '2026-11-25',
          due_time: '10:00',
          completed_at: '2026-11-25T10:01:00.000Z',
        }),
      ],
    })
    assert.equal(rows.length, 1)
    assert.equal(rows[0]?.id, 'c1')
    assert.equal(rows[0]?.overdue, true)
  })

  it('does not show overdue on a future day view', () => {
    const books = new Map([['b1', book({ id: 'b1', title: 'Dune' })]])
    const rows = chaptersForDay({
      booksById: books,
      today: '2026-11-27',
      day: '2026-11-28',
      chapters: [
        chapter({
          id: 'c1',
          book_id: 'b1',
          title: 'Ch 1',
          scheduled_on: '2026-11-25',
          due_time: '08:00',
        }),
      ],
    })
    assert.equal(rows.length, 0)
  })
})

describe('chaptersByBookForDay', () => {
  it('sections due chapters under each book title', () => {
    const books = new Map([
      ['b1', book({ id: 'b1', title: 'Dune' })],
      ['b2', book({ id: 'b2', title: 'Foundation' })],
    ])
    const groups = chaptersByBookForDay({
      booksById: books,
      today: '2026-11-27',
      day: '2026-11-27',
      chapters: [
        chapter({
          id: 'c2',
          book_id: 'b2',
          title: 'Psychohistory',
          scheduled_on: '2026-11-27',
          due_time: '07:00',
        }),
        chapter({
          id: 'c1b',
          book_id: 'b1',
          title: 'Ch 2',
          scheduled_on: '2026-11-27',
          due_time: '10:00',
        }),
        chapter({
          id: 'c1a',
          book_id: 'b1',
          title: 'Ch 1',
          scheduled_on: '2026-11-27',
          due_time: '09:00',
        }),
      ],
    })
    assert.deepEqual(
      groups.map((group) => ({
        book: group.book_title,
        chapters: group.chapters.map((row) => row.title),
      })),
      [
        { book: 'Foundation', chapters: ['Psychohistory'] },
        { book: 'Dune', chapters: ['Ch 1', 'Ch 2'] },
      ],
    )
  })
})

describe('chapter completion helpers', () => {
  it('toggles completed_at', () => {
    const list = [
      chapter({ id: 'c1', book_id: 'b1', title: 'Ch 1' }),
      chapter({ id: 'c2', book_id: 'b1', title: 'Ch 2' }),
    ]
    const next = applyChapterCompletion(list, 'c1', '2026-11-27T08:00:00.000Z')
    assert.equal(chapterIsComplete(next[0]!), true)
    assert.equal(chapterIsComplete(next[1]!), false)
    const undone = applyChapterCompletion(next, 'c1', null)
    assert.equal(chapterIsComplete(undone[0]!), false)
  })
})
