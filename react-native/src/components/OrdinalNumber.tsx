import { Text, View, type StyleProp, type ViewStyle } from 'react-native'
import { useScreenStyles } from '../theme/ThemeProvider'

type Props = {
  value: number
  /** Defaults to `set ${value}` (lift attempts); pass e.g. `chapter 3`. */
  accessibilityLabel?: string
  style?: StyleProp<ViewStyle>
}

/**
 * Compact circled set number (①-style badge) matching the Add Set picker language.
 * Prefer this over ordinal text like `1st]` — quieter and consistent across platforms.
 */
export function OrdinalNumber({ value, accessibilityLabel, style }: Props) {
  const screen = useScreenStyles()
  return (
    <View
      accessibilityLabel={accessibilityLabel ?? `set ${value}`}
      accessibilityRole="text"
      style={[screen.setBadge, style]}
    >
      <Text style={screen.setBadgeText}>{value}</Text>
    </View>
  )
}
