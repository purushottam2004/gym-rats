import { Text, View } from 'react-native'
import {
  formatNutrientGoalMeta,
  type NutritionProgressLine,
} from '../lib/nutrition'
import { InfoButton } from './InfoButton'
import { screen } from './screenStyles'

type Props = {
  line: NutritionProgressLine
  first?: boolean
  onInfo?: () => void
}

export function NutrientProgressRow({ line, first, onInfo }: Props) {
  const hasBand = line.min != null || line.max != null
  const fill = line.progress == null ? 0 : Math.max(0, Math.min(1, line.progress))
  const meta = formatNutrientGoalMeta(line.total, line.min, line.max, line.unit)

  return (
    <View style={[screen.row, first && screen.rowFirst]}>
      {hasBand && line.fillColor ? (
        <View
          pointerEvents="none"
          style={[
            screen.nutrientFill,
            { width: `${fill * 100}%`, backgroundColor: line.fillColor },
          ]}
        />
      ) : null}
      <Text style={[screen.rowTitle, screen.rowMain]}>{line.name}</Text>
      <View style={screen.choiceTrail}>
        <Text style={screen.nutrientMeta}>{meta}</Text>
        {onInfo ? <InfoButton onPress={onInfo} /> : null}
      </View>
    </View>
  )
}
