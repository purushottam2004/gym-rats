import { Text, View, type StyleProp, type ViewStyle } from 'react-native'
import { screen } from './screenStyles'

type Props = {
  value: number
  style?: StyleProp<ViewStyle>
}

/**
 * Compact circled set number (①-style badge) matching the Add Set picker language.
 * Prefer this over ordinal text like `1st]` — quieter and consistent across platforms.
 */
export function OrdinalNumber({ value, style }: Props) {
  return (
    <View
      accessibilityLabel={`set ${value}`}
      accessibilityRole="text"
      style={[screen.setBadge, style]}
    >
      <Text style={screen.setBadgeText}>{value}</Text>
    </View>
  )
}
