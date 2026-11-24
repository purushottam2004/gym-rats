import { Text, View } from 'react-native'
import { formatNutrientTotal, type NutritionProgressLine } from '../lib/nutrition'
import { InfoButton } from './InfoButton'
import { screen } from './screenStyles'

type Props = {
  line: NutritionProgressLine
  first?: boolean
  onInfo?: () => void
}

export function NutrientProgressRow({ line, first, onInfo }: Props) {
  const fill = line.progress == null ? 0 : Math.max(0, Math.min(1, line.progress))
  const meta =
    line.goal != null
      ? `${formatNutrientTotal(line.total)} / ${formatNutrientTotal(line.goal)} ${line.unit}`
      : `${formatNutrientTotal(line.total)} ${line.unit}`

  return (
    <View style={[screen.row, first && screen.rowFirst]}>
      {line.goal != null ? <View pointerEvents="none" style={[screen.nutrientFill, { width: `${fill * 100}%` }]} /> : null}
      <Text style={[screen.rowTitle, screen.rowMain]}>{line.name}</Text>
      <View style={screen.choiceTrail}>
        <Text style={screen.rowMeta}>{meta}</Text>
        {onInfo ? <InfoButton onPress={onInfo} /> : null}
      </View>
    </View>
  )
}
