import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  markFeatureReadLocal,
  unreadCountForTab,
  type FeatureRow,
  type FeatureTab,
} from '../lib/featureUpdates'
import { loadFeatures, markFeatureRead } from '../lib/gym'
import { useAuth } from './AuthProvider'

type FeatureUpdatesValue = {
  features: FeatureRow[]
  hydrated: boolean
  refresh: () => Promise<void>
  unreadCount: (tab: FeatureTab) => number
  featuresForTab: (tab: FeatureTab) => FeatureRow[]
  openFeature: (featureId: string) => Promise<FeatureRow | null>
}

const FeatureUpdatesContext = createContext<FeatureUpdatesValue | null>(null)

export function FeatureUpdatesProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth()
  const userId = session?.user.id
  const [features, setFeatures] = useState<FeatureRow[]>([])
  const [hydrated, setHydrated] = useState(false)

  const refresh = useCallback(async () => {
    if (!userId) {
      setFeatures([])
      setHydrated(true)
      return
    }
    try {
      const next = await loadFeatures(userId)
      setFeatures(next)
    } catch {
      // Leave prior state; tabs still work without the info catalog.
    } finally {
      setHydrated(true)
    }
  }, [userId])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      if (!userId) {
        if (!cancelled) {
          setFeatures([])
          setHydrated(true)
        }
        return
      }
      try {
        const next = await loadFeatures(userId)
        if (!cancelled) setFeatures(next)
      } catch {
        // Leave prior state; tabs still work without the info catalog.
      } finally {
        if (!cancelled) setHydrated(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [userId])

  const openFeature = useCallback(
    async (featureId: string): Promise<FeatureRow | null> => {
      const current = features.find((row) => row.id === featureId) ?? null
      if (!current) return null
      if (current.read_at != null) return current

      const readAt = new Date().toISOString()
      setFeatures((prev) => markFeatureReadLocal(prev, featureId, readAt))
      try {
        const savedAt = await markFeatureRead(featureId)
        setFeatures((prev) => markFeatureReadLocal(prev, featureId, savedAt))
        return { ...current, read_at: savedAt }
      } catch {
        // Keep optimistic read so the UI is not stuck unread on a transient failure.
        return { ...current, read_at: readAt }
      }
    },
    [features],
  )

  const value = useMemo<FeatureUpdatesValue>(
    () => ({
      features,
      hydrated,
      refresh,
      unreadCount: (tab) => unreadCountForTab(features, tab),
      featuresForTab: (tab) =>
        features
          .filter((row) => row.tab === tab)
          .slice()
          .sort((a, b) => {
            if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order
            return a.title.localeCompare(b.title)
          }),
      openFeature,
    }),
    [features, hydrated, openFeature, refresh],
  )

  return (
    <FeatureUpdatesContext.Provider value={value}>{children}</FeatureUpdatesContext.Provider>
  )
}

export function useFeatureUpdates(): FeatureUpdatesValue {
  const value = useContext(FeatureUpdatesContext)
  if (!value) {
    throw new Error('useFeatureUpdates must be used within FeatureUpdatesProvider')
  }
  return value
}
