/** Pure Books day-list helpers (no native imports — keeps node:test happy). */

export type Book = {
  id: string
  title: string
  author: string | null
  remind_enabled: boolean
  remind_every_minutes: number | null
  active: boolean
  sort_order: number
}

export type BookChapter = {
  id: string
  book_id: string
  title: string
  sort_order: number
  page_start: number | null
  page_end: number | null
  scheduled_on: string | null
  due_time: string | null
  completed_at: string | null
}

export type BookChapterDayRow = BookChapter & {
  book_title: string
  book_author: string | null
  overdue: boolean
}

/** One book’s due chapters for a day view (Books tab sections). */
export type BookChapterDayGroup = {
  book_id: string
  book_title: string
  book_author: string | null
  chapters: BookChapterDayRow[]
}

/**
 * Chapters visible on a day view.
 * - Exact schedule match for that day.
 * - When viewing today: also incomplete chapters scheduled earlier (overdue roll-forward).
 */
export function chaptersForDay(input: {
  chapters: BookChapter[]
  booksById: Map<string, Book>
  day: string
  today: string
}): BookChapterDayRow[] {
  const rows: BookChapterDayRow[] = []
  for (const chapter of input.chapters) {
    if (!chapter.scheduled_on) continue
    const book = input.booksById.get(chapter.book_id)
    if (!book || !book.active) continue

    const exact = chapter.scheduled_on === input.day
    const overdue =
      input.day === input.today &&
      chapter.scheduled_on < input.today &&
      chapter.completed_at == null

    if (!exact && !overdue) continue

    rows.push({
      ...chapter,
      book_title: book.title,
      book_author: book.author,
      overdue,
    })
  }

  rows.sort((a, b) => {
    const timeA = a.due_time ?? '99:99'
    const timeB = b.due_time ?? '99:99'
    if (timeA !== timeB) return timeA.localeCompare(timeB)
    if (a.book_title !== b.book_title) return a.book_title.localeCompare(b.book_title)
    return a.sort_order - b.sort_order
  })
  return rows
}

/**
 * Same day rows as `chaptersForDay`, grouped into one section per book
 * (Lifts-style cards). Within a book: due time, then chapter order.
 * Book order: earliest chapter due time, then title.
 */
export function chaptersByBookForDay(input: {
  chapters: BookChapter[]
  booksById: Map<string, Book>
  day: string
  today: string
}): BookChapterDayGroup[] {
  const rows = chaptersForDay(input)
  const groups = new Map<string, BookChapterDayGroup>()
  for (const row of rows) {
    let group = groups.get(row.book_id)
    if (!group) {
      group = {
        book_id: row.book_id,
        book_title: row.book_title,
        book_author: row.book_author,
        chapters: [],
      }
      groups.set(row.book_id, group)
    }
    group.chapters.push(row)
  }

  const list = [...groups.values()]
  for (const group of list) {
    group.chapters.sort((a, b) => {
      const timeA = a.due_time ?? '99:99'
      const timeB = b.due_time ?? '99:99'
      if (timeA !== timeB) return timeA.localeCompare(timeB)
      return a.sort_order - b.sort_order
    })
  }
  list.sort((a, b) => {
    const timeA = a.chapters[0]?.due_time ?? '99:99'
    const timeB = b.chapters[0]?.due_time ?? '99:99'
    if (timeA !== timeB) return timeA.localeCompare(timeB)
    return a.book_title.localeCompare(b.book_title)
  })
  return list
}

export function chapterIsComplete(chapter: Pick<BookChapter, 'completed_at'>): boolean {
  return chapter.completed_at != null
}

export function applyChapterCompletion(
  chapters: BookChapter[],
  chapterId: string,
  completedAt: string | null,
): BookChapter[] {
  return chapters.map((chapter) =>
    chapter.id === chapterId ? { ...chapter, completed_at: completedAt } : chapter,
  )
}
