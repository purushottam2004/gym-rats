import { Text, View } from 'react-native'
import {
  formatNutrientGoalMeta,
  type NutritionProgressLine,
} from '../lib/nutrition'
import { InfoButton } from './InfoButton'
import { RatioProgressFill } from './RatioProgressFill'
import { useScreenStyles, useTheme } from '../theme/ThemeProvider'

type Props = {
  line: NutritionProgressLine
  first?: boolean
  onInfo?: () => void
}

/**
 * Nutrition summary row with a left→right fill. When the bar has progress, name
 * and amounts use habitCompleteText — same readable treatment as Habits rows.
 */
export function NutrientProgressRow({ line, first, onInfo }: Props) {
  const screen = useScreenStyles()
  const { colors } = useTheme()
  const hasBand = line.min != null || line.max != null
  const fill = line.progress == null ? 0 : Math.max(0, Math.min(1, line.progress))
  const meta = formatNutrientGoalMeta(line.total, line.min, line.max, line.unit)
  const fillColor = hasBand ? line.fillColor : null
  const onFill = fillColor != null && fill > 0

  return (
    <View style={[screen.row, first && screen.rowFirst]}>
      {fillColor ? <RatioProgressFill ratio={fill} color={fillColor} /> : null}
      <Text
        style={[
          screen.rowTitle,
          screen.rowMain,
          onFill && { color: colors.habitCompleteText },
        ]}
      >
        {line.name}
      </Text>
      <View style={screen.choiceTrail}>
        <Text
          style={[
            screen.nutrientMeta,
            onFill && { color: colors.habitCompleteText, fontWeight: '700' },
          ]}
        >
          {meta}
        </Text>
        {onInfo ? <InfoButton onPress={onInfo} /> : null}
      </View>
    </View>
  )
}
