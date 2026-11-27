/** Pure helpers for per-tab feature updates / what's-new. */

export const FEATURE_TABS = [
  'diet',
  'lifts',
  'habits',
  'groups',
  'posts',
  'profile',
] as const

export type FeatureTab = (typeof FEATURE_TABS)[number]

export type FeatureRow = {
  id: string
  tab: FeatureTab
  title: string
  summary: string
  body: string
  sort_order: number
  published_at: string
  /** ISO timestamp when this user read the feature; null = unread. */
  read_at: string | null
}

export const FEATURE_NOTIFIED_FINGERPRINT_KEY = 'gymrats.features.notifiedFingerprint'

export function isFeatureTab(value: string): value is FeatureTab {
  return (FEATURE_TABS as readonly string[]).includes(value)
}

export function featureIsUnread(feature: Pick<FeatureRow, 'read_at'>): boolean {
  return feature.read_at == null
}

export function unreadFeatures(features: FeatureRow[]): FeatureRow[] {
  return features.filter(featureIsUnread)
}

export function unreadCountForTab(features: FeatureRow[], tab: FeatureTab): number {
  return features.reduce(
    (count, feature) => (feature.tab === tab && featureIsUnread(feature) ? count + 1 : count),
    0,
  )
}

/** Stable fingerprint of the current unread set (for local notify dedupe). */
export function unreadFingerprint(features: FeatureRow[]): string {
  return unreadFeatures(features)
    .map((feature) => feature.id)
    .sort()
    .join(',')
}

export function featureUpdateNotification(unread: FeatureRow[]): {
  title: string
  body: string
} {
  const count = unread.length
  if (count <= 0) {
    return { title: 'Gym Rats', body: 'You are up to date.' }
  }
  if (count === 1) {
    return {
      title: 'New in Gym Rats',
      body: unread[0]?.title
        ? `${unread[0].title} — open the info icon on that tab to read more.`
        : 'A new feature is ready. Open the info icon on a tab to read more.',
    }
  }
  const sample = unread
    .slice(0, 2)
    .map((feature) => feature.title)
    .filter(Boolean)
    .join(', ')
  return {
    title: 'New in Gym Rats',
    body: sample
      ? `${count} new features (${sample}${count > 2 ? ', …' : ''}). Open a tab’s info icon to explore.`
      : `${count} new features. Open a tab’s info icon to explore.`,
  }
}

export function readNotifiedFingerprint(
  storage: Pick<Storage, 'getItem'> = globalThis.localStorage,
): string | null {
  try {
    return storage.getItem(FEATURE_NOTIFIED_FINGERPRINT_KEY)
  } catch {
    return null
  }
}

export function writeNotifiedFingerprint(
  fingerprint: string,
  storage: Pick<Storage, 'setItem'> = globalThis.localStorage,
): void {
  try {
    storage.setItem(FEATURE_NOTIFIED_FINGERPRINT_KEY, fingerprint)
  } catch {
    // Ignore quota / private-mode failures; worst case we re-notify once.
  }
}

export function markFeatureReadLocal(
  features: FeatureRow[],
  featureId: string,
  readAt: string,
): FeatureRow[] {
  return features.map((feature) =>
    feature.id === featureId && feature.read_at == null
      ? { ...feature, read_at: readAt }
      : feature,
  )
}
