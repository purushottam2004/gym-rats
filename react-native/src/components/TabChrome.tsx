import type { LucideIcon } from 'lucide-react-native'
import { useState, type ReactNode } from 'react'
import { Pressable, Text, View } from 'react-native'
import { useFeatureUpdates } from '../auth/FeatureUpdatesProvider'
import type { FeatureTab } from '../lib/featureUpdates'
import { useScreenStyles, useTheme } from '../theme/ThemeProvider'
import { TabFeaturesModal } from './TabFeaturesModal'

type Props = {
  icon: LucideIcon
  title: string
  trailing?: ReactNode
  /** When set, the lead icon opens this tab’s features modal (replaces the old trailing “i”). */
  featuresTab?: FeatureTab
  featuresTitle?: string
}

export function TabChrome({
  icon: Icon,
  title,
  trailing,
  featuresTab,
  featuresTitle,
}: Props) {
  const screen = useScreenStyles()
  const { colors } = useTheme()
  const { unreadCount } = useFeatureUpdates()
  const [featuresOpen, setFeaturesOpen] = useState(false)
  const hasUnread = featuresTab ? unreadCount(featuresTab) > 0 : false
  const modalTitle = featuresTitle ?? `${title} features`

  const lead = (
    <>
      <View style={{ position: 'relative' }}>
        <Icon color={colors.accent} size={20} strokeWidth={2.25} />
        {hasUnread ? (
          <View
            style={{
              position: 'absolute',
              top: -2,
              right: -2,
              width: 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: colors.accent,
              borderWidth: 1.5,
              borderColor: colors.surface,
            }}
          />
        ) : null}
      </View>
      <Text style={screen.tabChromeTitle}>{title}</Text>
    </>
  )

  return (
    <View style={screen.tabChrome}>
      {featuresTab ? (
        <Pressable
          accessibilityLabel={hasUnread ? `${modalTitle} (new)` : modalTitle}
          accessibilityRole="button"
          onPress={() => setFeaturesOpen(true)}
          style={screen.tabChromeLead}
        >
          {lead}
        </Pressable>
      ) : (
        <View style={screen.tabChromeLead}>{lead}</View>
      )}
      {trailing ? <View style={screen.tabChromeTrail}>{trailing}</View> : null}
      {featuresTab ? (
        <TabFeaturesModal
          visible={featuresOpen}
          tab={featuresTab}
          title={modalTitle}
          onClose={() => setFeaturesOpen(false)}
        />
      ) : null}
    </View>
  )
}
