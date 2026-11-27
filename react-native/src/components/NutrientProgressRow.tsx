import { useState } from 'react'
import { StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native'
import {
  contrastTextForFill,
  formatNutrientGoalMeta,
  type NutritionProgressLine,
} from '../lib/nutrition'
import { InfoButton } from './InfoButton'
import { RatioProgressFill } from './RatioProgressFill'
import { useScreenStyles } from '../theme/ThemeProvider'

type Props = {
  line: NutritionProgressLine
  first?: boolean
  onInfo?: () => void
}

/**
 * Nutrition summary row with a left→right fill. Text under the fill is redrawn
 * in a contrast color (clipped to the fill width) so numbers stay readable.
 */
export function NutrientProgressRow({ line, first, onInfo }: Props) {
  const screen = useScreenStyles()
  const [trackWidth, setTrackWidth] = useState(0)
  const hasBand = line.min != null || line.max != null
  const fill = line.progress == null ? 0 : Math.max(0, Math.min(1, line.progress))
  const meta = formatNutrientGoalMeta(line.total, line.min, line.max, line.unit)
  const fillColor = hasBand ? line.fillColor : null
  const onFillColor = fillColor ? contrastTextForFill(fillColor) : null
  const fillWidth = trackWidth > 0 ? trackWidth * fill : 0

  function onRowLayout(event: LayoutChangeEvent) {
    const next = event.nativeEvent.layout.width
    setTrackWidth((prev) => (prev === next ? prev : next))
  }

  return (
    <View onLayout={onRowLayout} style={[screen.row, first && screen.rowFirst]}>
      {fillColor ? <RatioProgressFill ratio={fill} color={fillColor} /> : null}
      <Text style={[screen.rowTitle, screen.rowMain, styles.layer]}>{line.name}</Text>
      <View style={[screen.choiceTrail, styles.layer]}>
        <Text style={screen.nutrientMeta}>{meta}</Text>
        {onInfo ? <InfoButton onPress={onInfo} /> : null}
      </View>
      {fillColor && onFillColor && fillWidth > 0 ? (
        <View pointerEvents="none" style={[styles.clip, { width: fillWidth }]}>
          <View style={[styles.overlayRow, { width: trackWidth }]}>
            <Text style={[screen.rowTitle, screen.rowMain, { color: onFillColor }]}>{line.name}</Text>
            <View style={screen.choiceTrail}>
              <Text style={[screen.nutrientMeta, { color: onFillColor, fontWeight: '700' }]}>
                {meta}
              </Text>
              {onInfo ? <View style={styles.infoSpacer} /> : null}
            </View>
          </View>
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  layer: {
    zIndex: 1,
  },
  clip: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    overflow: 'hidden',
    zIndex: 2,
  },
  overlayRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  infoSpacer: {
    width: 20,
    height: 20,
  },
})
