import { useState } from 'react'
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native'

type Props = {
  /** 0–1; values above 1 are capped. */
  ratio: number
  color: string
}

/**
 * Absolute left→right progress fill.
 *
 * Yoga on iOS/Android resolves percentage widths for absolute children against
 * the parent's content box (padding omitted). Chrome / react-native-web use the
 * padding box, so `width: '100%'` looks full on web and stops short on native
 * when the parent has horizontal padding (e.g. screen.row). Measure the track
 * with absoluteFill + onLayout, then paint a pixel width.
 *
 * @see https://github.com/facebook/react-native/issues/46392
 */
export function RatioProgressFill({ ratio, color }: Props) {
  const [trackWidth, setTrackWidth] = useState(0)
  if (!(ratio > 0)) return null
  const clamped = Math.min(1, ratio)

  function onTrackLayout(event: LayoutChangeEvent) {
    const next = event.nativeEvent.layout.width
    setTrackWidth((prev) => (prev === next ? prev : next))
  }

  return (
    <>
      <View pointerEvents="none" onLayout={onTrackLayout} style={styles.track} />
      {trackWidth > 0 ? (
        <View
          pointerEvents="none"
          style={[
            styles.fill,
            {
              width: trackWidth * clamped,
              backgroundColor: color,
            },
          ]}
        />
      ) : null}
    </>
  )
}

const styles = StyleSheet.create({
  // Spans the full padding box so onLayout.width matches the visible track.
  track: {
    ...StyleSheet.absoluteFill,
  },
  fill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
  },
})
