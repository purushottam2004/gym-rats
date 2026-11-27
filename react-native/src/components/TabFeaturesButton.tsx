import { Info } from 'lucide-react-native'
import { useState } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import { useFeatureUpdates } from '../auth/FeatureUpdatesProvider'
import type { FeatureTab } from '../lib/featureUpdates'
import { useTheme } from '../theme/ThemeProvider'
import { TabFeaturesModal } from './TabFeaturesModal'

type Props = {
  tab: FeatureTab
  /** Modal title, e.g. "Habits features". */
  title: string
}

/** Trailing chrome "i" control — place after DayControls / New chips. */
export function TabFeaturesButton({ tab, title }: Props) {
  const { colors } = useTheme()
  const { unreadCount } = useFeatureUpdates()
  const [open, setOpen] = useState(false)
  const hasUnread = unreadCount(tab) > 0

  return (
    <>
      <Pressable
        accessibilityLabel={hasUnread ? `${title} (new)` : title}
        accessibilityRole="button"
        hitSlop={8}
        onPress={() => setOpen(true)}
        style={styles.hit}
      >
        <Info color={colors.accent} size={20} strokeWidth={1.75} />
        {hasUnread ? (
          <View style={[styles.dot, { backgroundColor: colors.accent }]} />
        ) : null}
      </Pressable>
      <TabFeaturesModal
        visible={open}
        tab={tab}
        title={title}
        onClose={() => setOpen(false)}
      />
    </>
  )
}

const styles = StyleSheet.create({
  hit: {
    position: 'relative',
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: '#ffffff',
  },
})
