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
