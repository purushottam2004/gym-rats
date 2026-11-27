/**
 * Device-local Book chapter reminders via expo-notifications (not remote push).
 * Safe no-op on web / binaries without the native module.
 */
import { Platform } from 'react-native'
import { planBookChapterReminderFires } from './bookReminders'
import { localDate } from './localDate'
import type { Book, BookChapter } from './bookSchedule'

const ANDROID_BOOK_CHANNEL = 'book-reminders'
const BOOK_ID_PREFIX = 'book:'

async function ensurePermission(
  Notifications: typeof import('expo-notifications'),
): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync()
  if (
    current.granted ||
    current.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL
  ) {
    return true
  }
  const asked = await Notifications.requestPermissionsAsync()
  return (
    asked.granted || asked.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL
  )
}

async function ensureHandlerAndChannel(
  Notifications: typeof import('expo-notifications'),
): Promise<void> {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  })
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(ANDROID_BOOK_CHANNEL, {
      name: 'Book reminders',
      importance: Notifications.AndroidImportance.DEFAULT,
    })
  }
}

export async function cancelAllBookReminderNotifications(): Promise<void> {
  if (Platform.OS === 'web') return
  try {
    const Notifications = await import('expo-notifications')
    const scheduled = await Notifications.getAllScheduledNotificationsAsync()
    await Promise.all(
      scheduled
        .filter((item) => item.identifier.startsWith(BOOK_ID_PREFIX))
        .map((item) => Notifications.cancelScheduledNotificationAsync(item.identifier)),
    )
  } catch {
    // Missing native module or permission — ignore.
  }
}

/** Replace all Book chapter reminder schedules from the owner's active books. */
export async function syncBookReminderNotifications(input: {
  books: Book[]
  chapters: BookChapter[]
  now?: Date
  today?: string
}): Promise<void> {
  if (Platform.OS === 'web') return

  try {
    const Notifications = await import('expo-notifications')
    await cancelAllBookReminderNotifications()

    const now = input.now ?? new Date()
    const today = input.today ?? localDate()
    const booksById = new Map(input.books.map((book) => [book.id, book]))
    const candidates = input.chapters.filter((chapter) => {
      if (!chapter.scheduled_on || !chapter.due_time || chapter.completed_at) return false
      const book = booksById.get(chapter.book_id)
      return Boolean(book?.active && book.remind_enabled)
    })
    if (candidates.length === 0) return

    const allowed = await ensurePermission(Notifications)
    if (!allowed) return
    await ensureHandlerAndChannel(Notifications)

    for (const chapter of candidates) {
      const book = booksById.get(chapter.book_id)
      if (!book || !chapter.scheduled_on || !chapter.due_time) continue
      const fires = planBookChapterReminderFires({
        chapterId: chapter.id,
        settings: {
          remind_enabled: book.remind_enabled,
          remind_every_minutes: book.remind_every_minutes,
        },
        scheduledOn: chapter.scheduled_on,
        dueTime: chapter.due_time,
        completed: false,
        now,
        today,
      })
      for (const fire of fires) {
        await Notifications.scheduleNotificationAsync({
          identifier: fire.identifier,
          content: {
            title: book.title,
            body: `${chapter.title} — due ${chapter.due_time.slice(0, 5)}`,
            sound: true,
            ...(Platform.OS === 'android' ? { channelId: ANDROID_BOOK_CHANNEL } : null),
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: fire.date,
          },
        })
      }
    }
  } catch {
    // Missing native module — ignore.
  }
}
