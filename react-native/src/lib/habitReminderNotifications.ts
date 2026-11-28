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
  isHabitReminderMutedOnDay,
  loadHabitReminderMuteByDay,
  pruneHabitReminderMutesBefore,
  saveHabitReminderMuteByDay,
} from './habitReminderMute'
import {
  planHabitReminderFires,
  selectHabitReminderFiresForSchedule,
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
 *
 * Plans every Habit, then keeps only the soonest fires under a shared cap so
 * early reminders (Morning Brush at 8 AM) are not crowded out by hundreds of
 * later every-N repeats from other Habits (iOS ~64 pending local notifications).
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

    const now = input.now ?? new Date()
    const today = input.today ?? localDate()
    const active = input.habits.filter((habit) => habit.active && habit.remind_enabled)

    // Permission before cancel — otherwise a denied prompt would wipe schedules
    // and leave nothing in their place.
    if (active.length > 0) {
      const permitted = await ensurePermission(Notifications)
      if (!permitted) return
    }

    await cancelAllHabitReminderNotifications()
    if (active.length === 0) return

    await ensureHandlerAndChannel(Notifications)

    // Drop past mute days so local storage does not grow forever.
    const muteMap = pruneHabitReminderMutesBefore(loadHabitReminderMuteByDay(), today)
    saveHabitReminderMuteByDay(muteMap)

    const habitById = new Map(active.map((habit) => [habit.id, habit]))
    const planned = active.flatMap((habit) => {
      const done = habitDoneOnDay(habit, input.counts, today)
      const completeToday = habitComplete(habit, done)
      return planHabitReminderFires({
        habitId: habit.id,
        settings: settingsFromHabit(habit),
        isDueOnDay: (day) => isHabitDueOnDay(habit, day),
        now,
        today,
        completeToday,
        isMutedOnDay: (day) => isHabitReminderMutedOnDay(muteMap, habit.id, day),
      })
    })
    const fires = selectHabitReminderFiresForSchedule(planned)

    for (const fire of fires) {
      const habit = habitById.get(fire.habitId)
      if (!habit) continue
      const isFollowUp = fire.index > 0
      try {
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
      } catch {
        // One failed schedule must not abort the rest of the day's reminders.
      }
    }
  } catch {
    // Missing native module / scheduling failure — leave UI usable.
  }
}
