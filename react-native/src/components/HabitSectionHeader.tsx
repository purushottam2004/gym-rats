import { StyleSheet, Text, View } from 'react-native'
import { habitSectionProgress, type HabitProgressPart } from '../lib/habitProgress'
import { HabitProgressFill } from './HabitProgressFill'
import { useScreenStyles, useTheme } from '../theme/ThemeProvider'

type Props = {
  title: string
  parts: HabitProgressPart[]
}

/** Section title row with frequency-weighted green fill (same look as habit rows). */
export function HabitSectionHeader({ title, parts }: Props) {
  const screen = useScreenStyles()
  const { colors } = useTheme()
  const { done, target, ratio, complete } = habitSectionProgress(parts)

  return (
    <View
      style={[
        screen.row,
        screen.rowFirst,
        styles.row,
        {
          backgroundColor: colors.surface,
          borderLeftWidth: ratio > 0 ? 3 : 0,
          borderLeftColor: ratio > 0 ? colors.habitCompleteBorder : 'transparent',
        },
      ]}
    >
      <HabitProgressFill parts={parts} />
      <Text style={[screen.muted, screen.rowMain, styles.content]}>{title}</Text>
      {target > 0 ? (
        <Text
          style={[
            screen.rowMeta,
            styles.content,
            (complete || ratio > 0) && {
              color: colors.habitCompleteText,
              fontWeight: '700',
            },
          ]}
        >
          {done}/{target}
        </Text>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    overflow: 'hidden',
  },
  content: {
    zIndex: 1,
  },
})
