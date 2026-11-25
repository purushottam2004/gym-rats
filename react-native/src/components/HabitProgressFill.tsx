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
  fill: {
    ...StyleSheet.absoluteFill,
    right: undefined,
  },
})
