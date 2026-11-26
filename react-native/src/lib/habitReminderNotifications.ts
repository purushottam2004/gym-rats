/**
 * Device-local Habit reminders via expo-notifications (not remote push).
 * Safe no-op on web / binaries without the native module.
 */
import { Platform } from 'react-native'
import {
  habitComplete,
  habitDoneOnDay,
  isHabitDueOnDay,
  type Habit,
  type HabitDayCount,
} from './habitSchedule'
import { localDate } from './localDate'
import {
  planHabitReminderFires,
  type HabitReminderSettings,
} from './habitReminders'

const ANDROID_HABIT_CHANNEL = 'habit-reminders'
const HABIT_ID_PREFIX = 'habit:'

function settingsFromHabit(habit: Habit): HabitReminderSettings {
  return {
    remind_enabled: habit.remind_enabled,
    remind_first_time: habit.remind_first_time,
    remind_every_minutes: habit.remind_every_minutes,
  }
}

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
    await Notifications.setNotificationChannelAsync(ANDROID_HABIT_CHANNEL, {
      name: 'Habit reminders',
      importance: Notifications.AndroidImportance.DEFAULT,
    })
  }
}

/** Cancel every scheduled notification whose id starts with `habit:`. */
export async function cancelAllHabitReminderNotifications(): Promise<void> {
  if (Platform.OS === 'web') return
  try {
    const Notifications = await import('expo-notifications')
    const scheduled = await Notifications.getAllScheduledNotificationsAsync()
    await Promise.all(
      scheduled
        .filter((item) => item.identifier.startsWith(HABIT_ID_PREFIX))
        .map((item) => Notifications.cancelScheduledNotificationAsync(item.identifier)),
    )
  } catch {
    // Missing native module or permission — ignore.
  }
}

/**
 * Replace all Habit reminder schedules from the owner's active Habits.
 * Call after load / bump / save so completion cancels today's follow-ups.
 */
export async function syncHabitReminderNotifications(input: {
  habits: Habit[]
  counts: HabitDayCount[]
  now?: Date
  today?: string
}): Promise<void> {
  if (Platform.OS === 'web') return

  try {
    const Notifications = await import('expo-notifications')
    await cancelAllHabitReminderNotifications()

    const now = input.now ?? new Date()
    const today = input.today ?? localDate()
    const active = input.habits.filter((habit) => habit.active && habit.remind_enabled)
    if (active.length === 0) return

    const permitted = await ensurePermission(Notifications)
    if (!permitted) return
    await ensureHandlerAndChannel(Notifications)

    for (const habit of active) {
      const done = habitDoneOnDay(habit, input.counts, today)
      const completeToday = habitComplete(habit, done)
      const fires = planHabitReminderFires({
        habitId: habit.id,
        settings: settingsFromHabit(habit),
        isDueOnDay: (day) => isHabitDueOnDay(habit, day),
        now,
        today,
        completeToday,
      })

      for (const fire of fires) {
        const isFollowUp = fire.index > 0
        await Notifications.scheduleNotificationAsync({
          identifier: fire.identifier,
          content: {
            title: habit.name,
            body: isFollowUp
              ? 'Still waiting — mark it done in Habits.'
              : 'Time to complete this habit.',
            sound: true,
            data: { habitId: habit.id, day: fire.day, kind: 'habit-reminder' },
            ...(Platform.OS === 'android' ? { channelId: ANDROID_HABIT_CHANNEL } : {}),
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: fire.date,
            ...(Platform.OS === 'android' ? { channelId: ANDROID_HABIT_CHANNEL } : {}),
          },
        })
      }
    }
  } catch {
    // Missing native module / scheduling failure — leave UI usable.
  }
}
