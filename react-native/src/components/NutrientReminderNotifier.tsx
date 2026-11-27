import { useEffect } from 'react'
import { AppState, Platform } from 'react-native'
import { useAuth } from '../auth/AuthProvider'
import { localDate } from '../lib/localDate'
import { syncNutrientRemindersForUser } from '../lib/nutrientReminderSync'

const NUTRIENT_KIND = 'nutrient-reminder'

/**
 * Re-sync nutrient checkpoint schedules when the app becomes active or a
 * nutrient reminder is delivered / opened, so every-N follow-ups stop once
 * today's intake already meets the checkpoint.
 */
export function NutrientReminderNotifier() {
  const { session } = useAuth()
  const userId = session?.user.id

  useEffect(() => {
    if (!userId || Platform.OS === 'web') return

    const refresh = () => {
      void syncNutrientRemindersForUser(userId, localDate())
    }

    refresh()

    const appSub = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh()
    })

    let receivedSub: { remove: () => void } | undefined
    let responseSub: { remove: () => void } | undefined

    void (async () => {
      try {
        const Notifications = await import('expo-notifications')
        receivedSub = Notifications.addNotificationReceivedListener((notification) => {
          if (notification.request.content.data?.kind === NUTRIENT_KIND) refresh()
        })
        responseSub = Notifications.addNotificationResponseReceivedListener((response) => {
          if (response.notification.request.content.data?.kind === NUTRIENT_KIND) refresh()
        })
      } catch {
        // Native module missing — AppState refresh still helps.
      }
    })()

    return () => {
      appSub.remove()
      receivedSub?.remove()
      responseSub?.remove()
    }
  }, [userId])

  return null
}
