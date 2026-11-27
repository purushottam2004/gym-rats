import { useEffect, useRef } from 'react'
import { Platform } from 'react-native'
import { useAuth } from '../auth/AuthProvider'
import { useFeatureUpdates } from '../auth/FeatureUpdatesProvider'
import {
  featureUpdateNotification,
  readNotifiedFingerprint,
  unreadFeatures,
  unreadFingerprint,
  writeNotifiedFingerprint,
} from '../lib/featureUpdates'

const ANDROID_FEATURE_CHANNEL = 'feature-updates'

/**
 * Local notification when unread tab features exist after sign-in.
 * Mount under FeatureUpdatesProvider. Safe no-op on web / missing native module.
 */
export function FeatureUpdateNotifier() {
  const { session } = useAuth()
  const { features, hydrated } = useFeatureUpdates()
  const notifiedForUser = useRef<string | null>(null)

  useEffect(() => {
    if (!hydrated || !session?.user.id || Platform.OS === 'web') return

    const unread = unreadFeatures(features)
    if (unread.length === 0) return

    const fingerprint = unreadFingerprint(features)
    if (!fingerprint) return
    if (readNotifiedFingerprint() === fingerprint) return
    // One attempt per signed-in user per mount of this fingerprint.
    if (notifiedForUser.current === `${session.user.id}:${fingerprint}`) return
    notifiedForUser.current = `${session.user.id}:${fingerprint}`

    void (async () => {
      const copy = featureUpdateNotification(unread)
      const shown = await showLocalNotification(copy.title, copy.body)
      if (shown) writeNotifiedFingerprint(fingerprint)
    })()
  }, [features, hydrated, session?.user.id])

  return null
}

async function showLocalNotification(title: string, body: string): Promise<boolean> {
  try {
    const Notifications = await import('expo-notifications')
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
      }),
    })

    const permitted = await ensurePermission(Notifications)
    if (!permitted) return false

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(ANDROID_FEATURE_CHANNEL, {
        name: 'Feature updates',
        importance: Notifications.AndroidImportance.DEFAULT,
      })
    }

    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: false,
        ...(Platform.OS === 'android' ? { channelId: ANDROID_FEATURE_CHANNEL } : {}),
      },
      trigger: null,
    })
    return true
  } catch {
    return false
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
