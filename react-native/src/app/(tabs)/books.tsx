import * as ImagePicker from 'expo-image-picker'
import { useFocusEffect, useRouter } from 'expo-router'
import { BookOpen, Camera, Plus } from 'lucide-react-native'
import { useCallback, useMemo, useState } from 'react'
import { Image, Pressable, StyleSheet, Text, View } from 'react-native'
import { useAuth } from '../../auth/AuthProvider'
import { BusyOverlay, LoadingBlock } from '../../components/BrandLoader'
import { DayControls } from '../../components/DayControls'
import { HabitSwipeRow } from '../../components/HabitSwipeRow'
import { PhotoConfirmModal } from '../../components/PhotoConfirmModal'
import { ProfileAvatarButton } from '../../components/ProfileAvatarButton'
import { Screen } from '../../components/Screen'
import { TabChrome } from '../../components/TabChrome'
import { Toast, type ToastKind } from '../../components/Toast'
import { setBookDraft } from '../../lib/bookDraft'
import { formatChapterDueLabel } from '../../lib/bookReminders'
import { syncBookReminderNotifications } from '../../lib/bookReminderNotifications'
import {
  applyChapterCompletion,
  chaptersForDay,
  chapterIsComplete,
  type Book,
  type BookChapter,
} from '../../lib/bookSchedule'
import {
  estimateBookFromPhotos,
  loadBookChapters,
  loadBooks,
  setBookChapterCompleted,
} from '../../lib/gym'
import { formatHabitCompletedAt } from '../../lib/habitReminders'
import { localDate } from '../../lib/localDate'
import { useScreenStyles, useTheme } from '../../theme/ThemeProvider'

type PendingPhoto = { uri: string; mimeType?: string }

export default function BooksScreen() {
  const screen = useScreenStyles()
  const { colors } = useTheme()
  const ACTION_ICON = colors.accent
  const { session } = useAuth()
  const router = useRouter()
  const userId = session?.user.id
  const [day, setDay] = useState(localDate)
  const [books, setBooks] = useState<Book[]>([])
  const [chapters, setChapters] = useState<BookChapter[]>([])
  const [hydrated, setHydrated] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<{ kind: ToastKind; message: string } | null>(null)
  const [photos, setPhotos] = useState<PendingPhoto[]>([])
  const [reviewOpen, setReviewOpen] = useState(false)
  const [photoBusy, setPhotoBusy] = useState(false)

  const load = useCallback(async () => {
    if (!userId) return
    try {
      const nextBooks = await loadBooks(userId)
      const nextChapters = await loadBookChapters(nextBooks.map((book) => book.id))
      setBooks(nextBooks)
      setChapters(nextChapters)
      setError(null)
      void syncBookReminderNotifications({ books: nextBooks, chapters: nextChapters })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load books')
    } finally {
      setHydrated(true)
    }
  }, [userId])

  useFocusEffect(
    useCallback(() => {
      void load()
    }, [load]),
  )

  const today = localDate()
  const booksById = useMemo(() => new Map(books.map((book) => [book.id, book])), [books])
  const dayRows = useMemo(
    () => chaptersForDay({ chapters, booksById, day, today }),
    [chapters, booksById, day, today],
  )
  const dueTitle = day === today ? 'Due today' : `Scheduled ${day}`

  async function capturePhoto() {
    if (photoBusy) return
    const permission = await ImagePicker.requestCameraPermissionsAsync()
    if (!permission.granted) {
      setToast({ kind: 'error', message: 'Camera permission is required' })
      return
    }
    const result = await ImagePicker.launchCameraAsync({
      quality: 0.7,
      exif: false,
    })
    if (result.canceled || !result.assets[0]) return
    setPhotos((current) => [
      ...current,
      { uri: result.assets[0]!.uri, mimeType: result.assets[0]!.mimeType },
    ])
    setReviewOpen(true)
  }

  async function processPhotos() {
    if (photos.length === 0 || photoBusy) return
    setReviewOpen(false)
    setPhotoBusy(true)
    try {
      const result = await estimateBookFromPhotos({ images: photos })
      setPhotos([])
      if (!result.ok) {
        setToast({ kind: 'error', message: result.error })
        return
      }
      setBookDraft({
        title: result.book.title,
        author: result.book.author ?? '',
        chapters: result.book.chapters.map((chapter) => ({
          title: chapter.title,
          page_start: chapter.page_start != null ? String(chapter.page_start) : '',
          page_end: chapter.page_end != null ? String(chapter.page_end) : '',
        })),
      })
      router.push('/new-book')
    } catch (err) {
      setToast({
        kind: 'error',
        message: err instanceof Error && err.message.trim() ? err.message.trim() : 'Could not read book',
      })
    } finally {
      setPhotoBusy(false)
    }
  }

  async function toggleChapter(chapterId: string, complete: boolean) {
    const previous = chapters
    const optimisticAt = complete ? new Date().toISOString() : null
    setChapters(applyChapterCompletion(previous, chapterId, optimisticAt))
    try {
      const completedAt = await setBookChapterCompleted(chapterId, complete)
      setChapters((current) => applyChapterCompletion(current, chapterId, completedAt))
      void syncBookReminderNotifications({
        books,
        chapters: applyChapterCompletion(previous, chapterId, completedAt),
      })
    } catch (err) {
      setChapters(previous)
      setToast({
        kind: 'error',
        message: err instanceof Error ? err.message : 'Could not update chapter',
      })
    }
  }

  return (
    <View style={{ flex: 1 }}>
      <Screen
        header={
          <>
            <TabChrome
              icon={BookOpen}
              title="Books"
              featuresTab="books"
              featuresTitle="Books features"
              trailing={
                <>
                  <DayControls day={day} onChange={setDay} />
                  <ProfileAvatarButton />
                </>
              }
            />
            <View style={screen.card}>
              <View style={[screen.iconActionRow, styles.actionRow]}>
                <Pressable
                  accessibilityLabel="Add a book"
                  accessibilityRole="button"
                  onPress={() => router.push('/new-book')}
                  style={({ pressed }) => [screen.iconActionButton, pressed && screen.rowPressed]}
                >
                  <Plus color={ACTION_ICON} size={20} strokeWidth={2.25} />
                </Pressable>
                <Pressable
                  accessibilityLabel="Photograph book"
                  accessibilityRole="button"
                  disabled={photoBusy}
                  onPress={() => void capturePhoto()}
                  style={({ pressed }) => [
                    screen.iconActionButton,
                    (pressed || photoBusy) && screen.buttonDisabled,
                  ]}
                >
                  <Camera color={ACTION_ICON} size={20} strokeWidth={2.25} />
                </Pressable>
              </View>
            </View>
          </>
        }
      >
        {error ? <Text style={screen.error}>{error}</Text> : null}
        {!hydrated ? (
          <LoadingBlock label="Loading books" />
        ) : (
          <>
            <View style={screen.section}>
              <Text style={screen.sectionTitle}>Your books</Text>
              <View style={screen.card}>
                {books.length === 0 ? (
                  <View style={[screen.row, screen.rowFirst]}>
                    <Text style={screen.muted}>
                      No books yet. Tap + to add one, or the camera to scan a TOC.
                    </Text>
                  </View>
                ) : (
                  books.map((book, index) => (
                    <Pressable
                      key={book.id}
                      onPress={() =>
                        router.push({ pathname: '/book/[id]', params: { id: book.id } })
                      }
                      style={({ pressed }) => [
                        screen.row,
                        index === 0 && screen.rowFirst,
                        pressed && screen.rowPressed,
                      ]}
                    >
                      <View style={[screen.rowMain, { gap: 2 }]}>
                        <Text style={screen.rowTitle}>{book.title}</Text>
                        {book.author ? <Text style={screen.muted}>{book.author}</Text> : null}
                      </View>
                    </Pressable>
                  ))
                )}
              </View>
            </View>

            <View style={screen.section}>
              <Text style={screen.sectionTitle}>{dueTitle}</Text>
              <View style={screen.card}>
                {dayRows.length === 0 ? (
                  <View style={[screen.row, screen.rowFirst]}>
                    <Text style={screen.muted}>
                      No chapters scheduled{day === today ? ' or overdue' : ''} for this day.
                    </Text>
                  </View>
                ) : (
                  dayRows.map((row, index) => {
                    const complete = chapterIsComplete(row)
                    const dueLabel = formatChapterDueLabel(row.due_time)
                    const name = `${row.title} · ${row.book_title}${
                      row.overdue ? ' (overdue)' : dueLabel ? ` · ${dueLabel}` : ''
                    }`
                    return (
                      <HabitSwipeRow
                        key={row.id}
                        name={name}
                        done={complete ? 1 : 0}
                        target={1}
                        complete={complete}
                        completedLabel={formatHabitCompletedAt(row.completed_at)}
                        first={index === 0}
                        onIncrement={() => void toggleChapter(row.id, true)}
                        onDecrement={() => void toggleChapter(row.id, false)}
                      />
                    )
                  })
                )}
              </View>
            </View>
          </>
        )}
      </Screen>

      <PhotoConfirmModal
        visible={reviewOpen && photos.length > 0}
        imageUri={photos[photos.length - 1]?.uri ?? null}
        body="We will read title, author, and TOC from your photos and open New book so you can edit before saving. Add more shots first if you need cover + contents pages."
        onCancel={() => {
          setReviewOpen(false)
          setPhotos([])
        }}
        onRetake={() => {
          void capturePhoto()
        }}
        onContinue={() => void processPhotos()}
      />

      {photos.length > 1 && reviewOpen ? (
        <View style={styles.strip} pointerEvents="box-none">
          <Text style={screen.muted}>{photos.length} photos — Process uses all of them</Text>
          <View style={styles.stripRow}>
            {photos.map((photo) => (
              <Image key={photo.uri} source={{ uri: photo.uri }} style={styles.thumb} />
            ))}
            <Pressable
              onPress={() => void capturePhoto()}
              style={({ pressed }) => [screen.secondaryButton, pressed && { opacity: 0.85 }]}
            >
              <Text style={screen.secondaryButtonText}>Add photo</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      <BusyOverlay visible={photoBusy} label="Reading book…" />
      <Toast
        visible={toast != null}
        kind={toast?.kind ?? 'error'}
        message={toast?.message ?? ''}
        onHide={() => setToast(null)}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  actionRow: {
    justifyContent: 'flex-start',
  },
  strip: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 100,
    gap: 8,
  },
  stripRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    alignItems: 'center',
  },
  thumb: {
    width: 44,
    height: 44,
    borderRadius: 6,
  },
})
