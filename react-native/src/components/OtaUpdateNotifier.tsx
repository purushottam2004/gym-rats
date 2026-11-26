import { useEffect, useRef } from 'react'
import { Platform } from 'react-native'
import * as Updates from 'expo-updates'
import {
  otaAppliedNotification,
  otaDownloadedNotification,
  readNotifiedUpdateId,
  writeNotifiedUpdateId,
} from '../lib/otaUpdateNotify'

const ANDROID_OTA_CHANNEL = 'ota-updates'

/**
 * Local notification when an EAS Update is downloaded / first applied.
 * No UI — mount once under the root layout. Safe no-op on web / old binaries
 * that lack the notifications native module (calls are try/caught).
 */
export function OtaUpdateNotifier() {
  const handledPending = useRef(false)
  const { currentlyRunning, downloadedUpdate, isUpdatePending } = Updates.useUpdates()

  useEffect(() => {
    if (!Updates.isEnabled || Platform.OS === 'web') return
    const updateId = currentlyRunning.updateId
    if (currentlyRunning.isEmbeddedLaunch || !updateId) return
    if (readNotifiedUpdateId() === updateId) return

    void (async () => {
      const copy = otaAppliedNotification(currentlyRunning.createdAt)
      const shown = await showLocalNotification(copy.title, copy.body)
      if (shown) writeNotifiedUpdateId(updateId)
    })()
  }, [currentlyRunning.createdAt, currentlyRunning.isEmbeddedLaunch, currentlyRunning.updateId])

  useEffect(() => {
    if (!Updates.isEnabled || Platform.OS === 'web') return
    if (!isUpdatePending || handledPending.current) return
    handledPending.current = true

    void (async () => {
      const copy = otaDownloadedNotification(downloadedUpdate?.createdAt)
      await showLocalNotification(copy.title, copy.body)
      try {
        await Updates.reloadAsync()
      } catch {
        // Reload can fail in rare native states; update still applies on next cold start.
      }
    })()
  }, [downloadedUpdate?.createdAt, isUpdatePending])

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
      await Notifications.setNotificationChannelAsync(ANDROID_OTA_CHANNEL, {
        name: 'App updates',
        importance: Notifications.AndroidImportance.DEFAULT,
      })
    }

    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: false,
        ...(Platform.OS === 'android' ? { channelId: ANDROID_OTA_CHANNEL } : {}),
      },
      trigger: null,
    })
    return true
  } catch {
    // Missing native module (binary without expo-notifications) or permission denial.
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
