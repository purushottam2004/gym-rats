import type { LucideIcon } from 'lucide-react-native'
import type { ReactNode } from 'react'
import { Text, View } from 'react-native'
import { useScreenStyles, useTheme } from '../theme/ThemeProvider'

type Props = {
  icon: LucideIcon
  title: string
  trailing?: ReactNode
}

export function TabChrome({ icon: Icon, title, trailing }: Props) {
  const screen = useScreenStyles()
  const { colors } = useTheme()
  return (
    <View style={screen.tabChrome}>
      <View style={screen.tabChromeLead}>
        <Icon color={colors.accent} size={20} strokeWidth={2.25} />
        <Text style={screen.tabChromeTitle}>{title}</Text>
      </View>
      {trailing ? <View style={screen.tabChromeTrail}>{trailing}</View> : null}
    </View>
  )
}
