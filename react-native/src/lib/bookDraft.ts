/** In-memory draft for New book (photo estimate → editable form). */

export type BookChapterDraft = {
  title: string
  page_start: string
  page_end: string
}

export type BookDraft = {
  title: string
  author: string
  chapters: BookChapterDraft[]
}

let draft: BookDraft | null = null

export function setBookDraft(next: BookDraft | null): void {
  draft = next
}

export function takeBookDraft(): BookDraft | null {
  const current = draft
  draft = null
  return current
}

export function peekBookDraft(): BookDraft | null {
  return draft
}
