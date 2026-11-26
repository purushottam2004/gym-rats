/** Pure helpers for OTA local-notification copy and “already told you” storage. */

export const OTA_NOTIFIED_UPDATE_ID_KEY = 'gymrats.ota.notifiedUpdateId'

export type OtaNotifyCopy = {
  title: string
  body: string
}

/** Shown when a new update has finished downloading and is about to apply. */
export function otaDownloadedNotification(createdAt?: Date | null): OtaNotifyCopy {
  const when = formatUpdateWhen(createdAt)
  return {
    title: 'Gym Rats update ready',
    body: when
      ? `A new version (${when}) was downloaded and will open now.`
      : 'A new version was downloaded and will open now.',
  }
}

/** Shown once when the app is running a downloaded (non-embedded) update. */
export function otaAppliedNotification(createdAt?: Date | null): OtaNotifyCopy {
  const when = formatUpdateWhen(createdAt)
  return {
    title: 'Gym Rats updated',
    body: when ? `You are on the latest update (${when}).` : 'You are on the latest update.',
  }
}

export function formatUpdateWhen(createdAt?: Date | null): string | null {
  if (!createdAt || Number.isNaN(createdAt.getTime())) return null
  try {
    return createdAt.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  } catch {
    return createdAt.toISOString()
  }
}

export function readNotifiedUpdateId(
  storage: Pick<Storage, 'getItem'> = globalThis.localStorage,
): string | null {
  try {
    return storage.getItem(OTA_NOTIFIED_UPDATE_ID_KEY)
  } catch {
    return null
  }
}

export function writeNotifiedUpdateId(
  updateId: string,
  storage: Pick<Storage, 'setItem'> = globalThis.localStorage,
): void {
  try {
    storage.setItem(OTA_NOTIFIED_UPDATE_ID_KEY, updateId)
  } catch {
    // Ignore quota / private-mode failures; worst case we re-notify once.
  }
}
