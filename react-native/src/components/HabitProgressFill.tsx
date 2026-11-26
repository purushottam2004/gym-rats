import { StyleSheet, View } from 'react-native'
import { habitSectionProgress, type HabitProgressPart } from '../lib/habitProgress'
import { useTheme } from '../theme/ThemeProvider'

type Props = {
  parts: HabitProgressPart[]
}

/** Absolute left→right green fill from frequency-weighted habit progress. */
export function HabitProgressFill({ parts }: Props) {
  const { colors } = useTheme()
  const { ratio } = habitSectionProgress(parts)
  if (ratio <= 0) return null
  return (
    <View
      pointerEvents="none"
      style={[
        styles.fill,
        {
          width: `${ratio * 100}%`,
          backgroundColor: colors.habitCompleteBg,
        },
      ]}
    />
  )
}

const styles = StyleSheet.create({
  // Same pattern as diet nutrientFill — left/top/bottom only.
  // Spreading StyleSheet.absoluteFill + right: undefined breaks height on iOS
  // (Yoga / WebKit treat the unresolved right edge differently than Chrome).
  fill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
  },
})
