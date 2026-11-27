import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router'
import { Check, Circle, CircleCheck, Pencil } from 'lucide-react-native'
import { useCallback, useMemo, useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { useAuth } from '../../auth/AuthProvider'
import { AppTextInput } from '../../components/AppTextInput'
import { LoadingBlock } from '../../components/BrandLoader'
import { HabitSwipeRow } from '../../components/HabitSwipeRow'
import { Screen } from '../../components/Screen'
import { TimePickerField } from '../../components/TimePickerField'
import { formatChapterScheduleChip } from '../../lib/bookReminders'
import { syncBookReminderNotifications } from '../../lib/bookReminderNotifications'
import {
  applyChapterCompletion,
  chapterIsComplete,
  type Book,
  type BookChapter,
} from '../../lib/bookSchedule'
import {
  addBookChapter,
  clearBookChapterSchedule,
  deleteBook,
  loadBook,
  loadBookAudiences,
  loadBookChapters,
  loadBooks,
  loadGroups,
  scheduleBookChapter,
  setBookChapterCompleted,
  updateBook,
  type Group,
} from '../../lib/gym'
import { formatHabitCompletedAt } from '../../lib/habitReminders'
import { localDate } from '../../lib/localDate'
import { useScreenStyles, useTheme } from '../../theme/ThemeProvider'

export default function BookDetailScreen() {
  const screen = useScreenStyles()
  const { colors } = useTheme()
  const { session } = useAuth()
  const router = useRouter()
  const { id } = useLocalSearchParams<{ id: string }>()
  const userId = session?.user.id
  const [book, setBook] = useState<Book | null>(null)
  const [chapters, setChapters] = useState<BookChapter[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [profile, setProfile] = useState(false)
  const [selected, setSelected] = useState<Record<string, boolean>>({})
  const [title, setTitle] = useState('')
  const [author, setAuthor] = useState('')
  const [editingTitle, setEditingTitle] = useState(false)
  const [editingAuthor, setEditingAuthor] = useState(false)
  const [remindEnabled, setRemindEnabled] = useState(false)
  const [remindEvery, setRemindEvery] = useState('30')
  const [scheduleChapterId, setScheduleChapterId] = useState<string | null>(null)
  const [scheduleDay, setScheduleDay] = useState(localDate)
  const [scheduleTime, setScheduleTime] = useState('20:00')
  const [newChapterTitle, setNewChapterTitle] = useState('')
  const [hydrated, setHydrated] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    if (!id) return
    try {
      const [nextBook, nextChapters, audiences, nextGroups] = await Promise.all([
        loadBook(id),
        loadBookChapters([id]),
        loadBookAudiences(id),
        loadGroups(),
      ])
      setBook(nextBook)
      setChapters(nextChapters)
      setTitle(nextBook.title)
      setAuthor(nextBook.author ?? '')
      setRemindEnabled(nextBook.remind_enabled)
      setRemindEvery(
        nextBook.remind_every_minutes != null ? String(nextBook.remind_every_minutes) : '30',
      )
      setProfile(audiences.some((row) => row.kind === 'profile'))
      const nextSelected: Record<string, boolean> = {}
      for (const row of audiences) {
        if (row.kind === 'group' && row.group_id) nextSelected[row.group_id] = true
      }
      setSelected(nextSelected)
      setGroups(nextGroups)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not open book')
    } finally {
      setHydrated(true)
    }
  }, [id])

  useFocusEffect(
    useCallback(() => {
      void load()
    }, [load]),
  )

  const sortedChapters = useMemo(
    () => [...chapters].sort((a, b) => a.sort_order - b.sort_order),
    [chapters],
  )

  function remindEveryMinutes(): number | null {
    const every = remindEvery.trim() ? Number(remindEvery.trim()) : null
    return remindEnabled && every != null && Number.isInteger(every) && every >= 5 ? every : null
  }

  function audienceGroupIds(): string[] {
    return groups.filter((group) => selected[group.id]).map((group) => group.id)
  }

  async function persistBook(next: { title: string; author: string }): Promise<Book> {
    if (!book) throw new Error('Book not loaded')
    await updateBook({
      bookId: book.id,
      title: next.title,
      author: next.author,
      remindEnabled,
      remindEveryMinutes: remindEveryMinutes(),
      profile,
      groupIds: audienceGroupIds(),
    })
    const refreshed = await loadBook(book.id)
    setBook(refreshed)
    if (userId) {
      const ownerBooks = await loadBooks(userId)
      const ownerChapters = await loadBookChapters(ownerBooks.map((row) => row.id))
      void syncBookReminderNotifications({ books: ownerBooks, chapters: ownerChapters })
    }
    return refreshed
  }

  /** Save reminders / sharing only — never commits an in-progress title/author edit. */
  async function saveMeta() {
    if (!book || saving) return
    setSaving(true)
    setError(null)
    try {
      const refreshed = await persistBook({
        title: book.title,
        author: book.author ?? '',
      })
      if (!editingTitle) setTitle(refreshed.title)
      if (!editingAuthor) setAuthor(refreshed.author ?? '')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save')
    } finally {
      setSaving(false)
    }
  }

  async function saveTitleEdit() {
    if (!book || saving) return
    const nextTitle = title.trim()
    if (!nextTitle) {
      setError('Title is required')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const refreshed = await persistBook({
        title: nextTitle,
        author: book.author ?? '',
      })
      setTitle(refreshed.title)
      setEditingTitle(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save title')
    } finally {
      setSaving(false)
    }
  }

  async function saveAuthorEdit() {
    if (!book || saving) return
    setSaving(true)
    setError(null)
    try {
      const refreshed = await persistBook({
        title: book.title,
        author,
      })
      setAuthor(refreshed.author ?? '')
      setEditingAuthor(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save author')
    } finally {
      setSaving(false)
    }
  }

  async function toggleChapter(chapterId: string, complete: boolean) {
    const previous = chapters
    const optimisticAt = complete ? new Date().toISOString() : null
    setChapters(applyChapterCompletion(previous, chapterId, optimisticAt))
    try {
      const completedAt = await setBookChapterCompleted(chapterId, complete)
      const next = applyChapterCompletion(previous, chapterId, completedAt)
      setChapters(next)
      if (book) void syncBookReminderNotifications({ books: [book], chapters: next })
    } catch (err) {
      setChapters(previous)
      setError(err instanceof Error ? err.message : 'Could not update chapter')
    }
  }

  async function saveSchedule() {
    if (!scheduleChapterId) return
    try {
      await scheduleBookChapter({
        chapterId: scheduleChapterId,
        scheduledOn: scheduleDay,
        dueTime: scheduleTime,
      })
      setScheduleChapterId(null)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not schedule chapter')
    }
  }

  async function addChapter() {
    if (!book) return
    const chapterTitle = newChapterTitle.trim()
    if (!chapterTitle) return
    try {
      const created = await addBookChapter({
        bookId: book.id,
        title: chapterTitle,
        sortOrder: chapters.length,
      })
      setChapters((current) => [...current, created])
      setNewChapterTitle('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add chapter')
    }
  }

  async function removeBook() {
    if (!book) return
    try {
      await deleteBook(book.id)
      router.back()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete book')
    }
  }

  return (
    <Screen>
      <Text style={screen.title}>{book?.title ?? 'Book'}</Text>
      {error ? <Text style={screen.error}>{error}</Text> : null}
      {!hydrated || !book ? (
        <LoadingBlock label="Loading book" />
      ) : (
        <>
          <View style={screen.card}>
            <View style={[screen.row, screen.rowFirst]}>
              {editingTitle ? (
                <AppTextInput
                  autoFocus
                  editable={!saving}
                  onChangeText={setTitle}
                  style={[screen.input, screen.rowMain]}
                  value={title}
                />
              ) : (
                <View style={screen.rowMain}>
                  <Text style={screen.muted}>Title</Text>
                  <Text style={screen.rowTitle}>{book.title.trim() ? book.title : '—'}</Text>
                </View>
              )}
              {editingTitle ? (
                <Pressable
                  accessibilityLabel="Save title"
                  accessibilityRole="button"
                  disabled={saving}
                  hitSlop={8}
                  onPress={() => void saveTitleEdit()}
                >
                  <Check color={colors.accent} size={22} strokeWidth={2.5} />
                </Pressable>
              ) : (
                <Pressable
                  accessibilityLabel="Edit title"
                  accessibilityRole="button"
                  disabled={saving}
                  hitSlop={8}
                  onPress={() => {
                    setTitle(book.title)
                    setEditingTitle(true)
                  }}
                >
                  <Pencil color={colors.accent} size={18} strokeWidth={2.25} />
                </Pressable>
              )}
            </View>
            <View style={screen.row}>
              {editingAuthor ? (
                <AppTextInput
                  autoFocus
                  editable={!saving}
                  onChangeText={setAuthor}
                  style={[screen.input, screen.rowMain]}
                  value={author}
                />
              ) : (
                <View style={screen.rowMain}>
                  <Text style={screen.muted}>Author</Text>
                  <Text style={screen.rowTitle}>
                    {(book.author ?? '').trim() ? book.author : '—'}
                  </Text>
                </View>
              )}
              {editingAuthor ? (
                <Pressable
                  accessibilityLabel="Save author"
                  accessibilityRole="button"
                  disabled={saving}
                  hitSlop={8}
                  onPress={() => void saveAuthorEdit()}
                >
                  <Check color={colors.accent} size={22} strokeWidth={2.5} />
                </Pressable>
              ) : (
                <Pressable
                  accessibilityLabel="Edit author"
                  accessibilityRole="button"
                  disabled={saving}
                  hitSlop={8}
                  onPress={() => {
                    setAuthor(book.author ?? '')
                    setEditingAuthor(true)
                  }}
                >
                  <Pencil color={colors.accent} size={18} strokeWidth={2.25} />
                </Pressable>
              )}
            </View>
          </View>

          <Text style={screen.label}>Reminders</Text>
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: remindEnabled }}
            onPress={() => setRemindEnabled((current) => !current)}
            style={({ pressed }) => [
              screen.row,
              screen.rowFirst,
              remindEnabled && screen.rowSelected,
              pressed && (remindEnabled ? screen.rowSelectedPressed : screen.rowPressed),
            ]}
          >
            <Text style={[screen.rowTitle, remindEnabled && screen.rowTitleSelected]}>
              Remind at each chapter’s due time
            </Text>
            {remindEnabled ? (
              <CircleCheck color={colors.accent} size={20} strokeWidth={2.25} />
            ) : (
              <Circle color={colors.border} size={20} strokeWidth={1.75} />
            )}
          </Pressable>
          {remindEnabled ? (
            <>
              <Text style={screen.label}>Every (min) while incomplete</Text>
              <AppTextInput
                keyboardType="number-pad"
                onChangeText={setRemindEvery}
                placeholder="30"
                style={screen.input}
                value={remindEvery}
              />
            </>
          ) : null}

          <Text style={screen.label}>Sharing</Text>
          <View style={screen.card}>
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: profile }}
              onPress={() => setProfile((current) => !current)}
              style={({ pressed }) => [
                screen.row,
                screen.rowFirst,
                profile && screen.rowSelected,
                pressed && (profile ? screen.rowSelectedPressed : screen.rowPressed),
              ]}
            >
              <Text style={[screen.rowTitle, profile && screen.rowTitleSelected]}>Profile</Text>
              {profile ? (
                <CircleCheck color={colors.accent} size={20} strokeWidth={2.25} />
              ) : (
                <Circle color={colors.border} size={20} strokeWidth={1.75} />
              )}
            </Pressable>
            {groups.map((group) => {
              const checked = Boolean(selected[group.id])
              return (
                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked }}
                  key={group.id}
                  onPress={() =>
                    setSelected((current) => ({ ...current, [group.id]: !current[group.id] }))
                  }
                  style={({ pressed }) => [
                    screen.row,
                    checked && screen.rowSelected,
                    pressed && (checked ? screen.rowSelectedPressed : screen.rowPressed),
                  ]}
                >
                  <Text style={[screen.rowTitle, checked && screen.rowTitleSelected]}>
                    {group.name}
                  </Text>
                  {checked ? (
                    <CircleCheck color={colors.accent} size={20} strokeWidth={2.25} />
                  ) : (
                    <Circle color={colors.border} size={20} strokeWidth={1.75} />
                  )}
                </Pressable>
              )
            })}
          </View>

          <Pressable
            disabled={saving}
            onPress={() => void saveMeta()}
            style={[screen.save, saving && screen.buttonDisabled]}
          >
            <Text style={screen.buttonText}>{saving ? 'Saving…' : 'Save details'}</Text>
          </Pressable>

          <Text style={screen.label}>Chapters</Text>
          <View style={screen.card}>
            {sortedChapters.length === 0 ? (
              <Text style={screen.body}>No chapters yet.</Text>
            ) : (
              sortedChapters.map((chapter, index) => {
                const complete = chapterIsComplete(chapter)
                const scheduleChip = formatChapterScheduleChip(
                  chapter.scheduled_on,
                  chapter.due_time,
                )
                return (
                  <View key={chapter.id} style={{ gap: 6 }}>
                    <HabitSwipeRow
                      name={chapter.title}
                      done={complete ? 1 : 0}
                      target={1}
                      complete={complete}
                      completedLabel={formatHabitCompletedAt(chapter.completed_at)}
                      first={index === 0}
                      onIncrement={() => void toggleChapter(chapter.id, true)}
                      onDecrement={() => void toggleChapter(chapter.id, false)}
                    />
                    <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 4 }}>
                      <Pressable
                        accessibilityLabel={
                          chapter.scheduled_on ? 'Edit chapter schedule' : 'Schedule chapter'
                        }
                        accessibilityRole="button"
                        onPress={() => {
                          setScheduleChapterId(chapter.id)
                          setScheduleDay(chapter.scheduled_on ?? localDate())
                          setScheduleTime(chapter.due_time ?? '20:00')
                        }}
                        style={({ pressed }) => [
                          screen.chromeChip,
                          pressed && { opacity: 0.85 },
                        ]}
                      >
                        <Text style={screen.chromeChipText}>{scheduleChip}</Text>
                      </Pressable>
                    </View>
                  </View>
                )
              })
            )}
          </View>

          {scheduleChapterId ? (
            <View style={screen.card}>
              <Text style={screen.sectionTitle}>Schedule chapter</Text>
              <Text style={screen.label}>Day (YYYY-MM-DD)</Text>
              <AppTextInput onChangeText={setScheduleDay} style={screen.input} value={scheduleDay} />
              <Text style={screen.label}>Due time</Text>
              <TimePickerField onChange={setScheduleTime} value={scheduleTime} />
              <Pressable onPress={() => void saveSchedule()} style={screen.save}>
                <Text style={screen.buttonText}>Save schedule</Text>
              </Pressable>
              {chapters.some(
                (chapter) => chapter.id === scheduleChapterId && chapter.scheduled_on,
              ) ? (
                <Pressable
                  onPress={() =>
                    void clearBookChapterSchedule(scheduleChapterId).then(() => {
                      setScheduleChapterId(null)
                      return load()
                    })
                  }
                  style={screen.secondaryButton}
                >
                  <Text style={screen.secondaryButtonText}>Clear schedule</Text>
                </Pressable>
              ) : null}
              <Pressable
                onPress={() => setScheduleChapterId(null)}
                style={screen.secondaryButton}
              >
                <Text style={screen.secondaryButtonText}>Cancel</Text>
              </Pressable>
            </View>
          ) : null}

          <Text style={screen.label}>Add chapter</Text>
          <AppTextInput
            onChangeText={setNewChapterTitle}
            placeholder="Chapter title"
            style={screen.input}
            value={newChapterTitle}
          />
          <Pressable onPress={() => void addChapter()} style={screen.secondaryButton}>
            <Text style={screen.secondaryButtonText}>Add chapter</Text>
          </Pressable>

          <Pressable onPress={() => void removeBook()} style={screen.secondaryButton}>
            <Text style={screen.secondaryButtonText}>Delete book</Text>
          </Pressable>
        </>
      )}
    </Screen>
  )
}
