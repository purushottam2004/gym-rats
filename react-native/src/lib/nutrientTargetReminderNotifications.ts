/**
 * Device-local nutrient target reminders via expo-notifications (not remote push).
 * Safe no-op on web / binaries without the native module.
 */
import { Platform } from 'react-native'
import { localDate } from './localDate'
import {
  planNutrientTargetFires,
  type NutrientGoalMilestone,
  type NutrientGoalReminderSettings,
} from './nutrientTargetReminders'

const ANDROID_NUTRIENT_CHANNEL = 'nutrient-reminders'
const NUTRIENT_ID_PREFIX = 'nutrient:'

export type NutrientReminderSyncGoal = {
  nutrient_id: string
  name: string
  unit: string
  min_amount: number | null
  remind_enabled: boolean
  remind_first_time: { hour: number; minute: number } | null
  remind_every_minutes: number | null
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
    await Notifications.setNotificationChannelAsync(ANDROID_NUTRIENT_CHANNEL, {
      name: 'Nutrient reminders',
      importance: Notifications.AndroidImportance.DEFAULT,
    })
  }
}

export async function cancelAllNutrientReminderNotifications(): Promise<void> {
  if (Platform.OS === 'web') return
  try {
    const Notifications = await import('expo-notifications')
    const scheduled = await Notifications.getAllScheduledNotificationsAsync()
    await Promise.all(
      scheduled
        .filter((item) => item.identifier.startsWith(NUTRIENT_ID_PREFIX))
        .map((item) => Notifications.cancelScheduledNotificationAsync(item.identifier)),
    )
  } catch {
    // Missing native module or permission — ignore.
  }
}

function settingsFromGoal(goal: NutrientReminderSyncGoal): NutrientGoalReminderSettings {
  return {
    remind_enabled: goal.remind_enabled,
    remind_first_time: goal.remind_first_time,
    remind_every_minutes: goal.remind_every_minutes,
    min_amount: goal.min_amount,
  }
}

function formatAmount(amount: number, unit: string): string {
  const rounded = Number.isInteger(amount) ? String(amount) : amount.toFixed(1)
  return `${rounded} ${unit}`
}

/**
 * Replace all nutrient reminder schedules from the owner's goals + milestones.
 * Call after diet load / intake save / goal save so progress cancels stale fires.
 */
export async function syncNutrientReminderNotifications(input: {
  goals: NutrientReminderSyncGoal[]
  milestones: NutrientGoalMilestone[]
  /** Today's totals keyed by nutrient_id (missing = 0). */
  progressByNutrientId: Record<string, number>
  now?: Date
  today?: string
}): Promise<void> {
  if (Platform.OS === 'web') return

  try {
    const Notifications = await import('expo-notifications')
    await cancelAllNutrientReminderNotifications()

    const now = input.now ?? new Date()
    const today = input.today ?? localDate()
    const activeGoals = input.goals.filter(
      (goal) =>
        (goal.remind_enabled && goal.min_amount != null) ||
        input.milestones.some((row) => row.nutrient_id === goal.nutrient_id),
    )
    // Also schedule milestones for nutrients that only have milestones (goal row may exist).
    const nutrientIds = new Set<string>([
      ...activeGoals.map((goal) => goal.nutrient_id),
      ...input.milestones.map((row) => row.nutrient_id),
    ])
    if (nutrientIds.size === 0) return

    const permitted = await ensurePermission(Notifications)
    if (!permitted) return
    await ensureHandlerAndChannel(Notifications)

    for (const nutrientId of nutrientIds) {
      const goal = input.goals.find((row) => row.nutrient_id === nutrientId)
      const milestones = input.milestones.filter((row) => row.nutrient_id === nutrientId)
      const progressToday = input.progressByNutrientId[nutrientId] ?? 0
      const settings: NutrientGoalReminderSettings = goal
        ? settingsFromGoal(goal)
        : {
            remind_enabled: false,
            remind_first_time: null,
            remind_every_minutes: null,
            min_amount: null,
          }

      const fires = planNutrientTargetFires({
        nutrientId,
        settings,
        milestones,
        now,
        today,
        progressToday,
      })

      const name = goal?.name ?? 'Nutrient'
      const unit = goal?.unit ?? ''

      for (const fire of fires) {
        const amountLabel = formatAmount(fire.threshold_amount, unit)
        const body =
          fire.index > 0
            ? `Still short of the ${amountLabel} checkpoint.`
            : `Checkpoint: aim for at least ${amountLabel} by now.`

        await Notifications.scheduleNotificationAsync({
          identifier: fire.identifier,
          content: {
            title: name,
            body,
            sound: true,
            data: {
              nutrientId,
              day: fire.day,
              kind: 'nutrient-reminder',
              reminderKind: fire.kind,
            },
            ...(Platform.OS === 'android' ? { channelId: ANDROID_NUTRIENT_CHANNEL } : {}),
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: fire.date,
            ...(Platform.OS === 'android' ? { channelId: ANDROID_NUTRIENT_CHANNEL } : {}),
          },
        })
      }
    }
  } catch {
    // Missing native module / scheduling failure — leave UI usable.
  }
}
