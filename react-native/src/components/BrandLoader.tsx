import { useEffect, useState } from 'react'
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Modal,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native'
import { APP_DISPLAY_NAME } from '../lib/brand'
import { useTheme } from '../theme/ThemeProvider'

type Size = 'sm' | 'md' | 'lg'

type Props = {
  /** Optional caption under the dots (e.g. "Loading groups"). */
  label?: string
  size?: Size
  /** Show the Echo wordmark above the dots (default for lg). */
  showMark?: boolean
  style?: StyleProp<ViewStyle>
}

const DOT_COUNT = 3

/**
 * Branded waiting indicator for any async gap (auth, first tab paint, joins, uploads).
 * Three accent “rats” bounce in a pack; respects reduce-motion.
 */
export function BrandLoader({ label, size = 'md', showMark, style }: Props) {
  const { colors } = useTheme()
  const [reduceMotion, setReduceMotion] = useState(false)
  const [phases] = useState(() =>
    Array.from({ length: DOT_COUNT }, () => new Animated.Value(0)),
  )

  const mark = showMark ?? size === 'lg'
  const dot = size === 'sm' ? 7 : size === 'lg' ? 12 : 9
  const gap = size === 'sm' ? 6 : size === 'lg' ? 10 : 8
  const lift = size === 'sm' ? 5 : size === 'lg' ? 10 : 7

  useEffect(() => {
    let alive = true
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (alive) setReduceMotion(enabled)
    })
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion)
    return () => {
      alive = false
      sub.remove()
    }
  }, [])

  useEffect(() => {
    if (reduceMotion) {
      phases.forEach((value) => value.setValue(0.35))
      return
    }
    const loops = phases.map((value, index) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(index * 120),
          Animated.timing(value, {
            toValue: 1,
            duration: 320,
            easing: Easing.bezier(0.23, 1, 0.32, 1),
            useNativeDriver: true,
          }),
          Animated.timing(value, {
            toValue: 0,
            duration: 320,
            easing: Easing.bezier(0.77, 0, 0.175, 1),
            useNativeDriver: true,
          }),
          Animated.delay((DOT_COUNT - 1 - index) * 120 + 180),
        ]),
      ),
    )
    loops.forEach((loop) => loop.start())
    return () => loops.forEach((loop) => loop.stop())
  }, [phases, reduceMotion])

  return (
    <View
      accessibilityLabel={label ?? 'Loading'}
      accessibilityRole="progressbar"
      style={[styles.root, style]}
    >
      {mark ? (
        <Text
          style={[
            styles.mark,
            {
              color: colors.text,
              fontSize: size === 'lg' ? 28 : 22,
            },
          ]}
        >
          {APP_DISPLAY_NAME}
        </Text>
      ) : null}
      <View style={[styles.row, { gap }]}>
        {phases.map((value, index) => (
          <Animated.View
            key={index}
            style={{
              width: dot,
              height: dot,
              borderRadius: dot / 2,
              backgroundColor: colors.accent,
              opacity: value.interpolate({
                inputRange: [0, 1],
                outputRange: [0.35, 1],
              }),
              transform: [
                {
                  translateY: value.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, -lift],
                  }),
                },
                {
                  scale: value.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.92, 1],
                  }),
                },
              ],
            }}
          />
        ))}
      </View>
      {label ? <Text style={[styles.label, { color: colors.textMuted }]}>{label}</Text> : null}
    </View>
  )
}

/** Centered page/section placeholder while the first fetch is in flight. */
export function LoadingBlock({
  label,
  size = 'md',
  showMark,
  style,
}: Props) {
  return (
    <View style={[styles.block, style]}>
      <BrandLoader label={label} showMark={showMark} size={size} />
    </View>
  )
}

/** Full-screen dimmed wait for in-flight actions (voice, uploads). */
export function BusyOverlay({
  visible,
  label,
}: {
  visible: boolean
  label?: string
}) {
  const { colors } = useTheme()
  // Unmount when hidden — leaving a transparent Modal mounted after dismiss can
  // keep eating taps on iOS (feels like a freeze on the screen underneath).
  if (!visible) return null
  return (
    <Modal animationType="fade" transparent visible onRequestClose={() => {}}>
      <View style={[styles.overlay, { backgroundColor: colors.modalBackdrop }]}>
        <View style={[styles.overlayCard, { backgroundColor: colors.surface }]}>
          <BrandLoader label={label} showMark size="md" />
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
  },
  mark: {
    fontWeight: '700',
    letterSpacing: -0.6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 28,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
  },
  block: {
    minHeight: 220,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    flexGrow: 1,
  },
  overlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  overlayCard: {
    borderRadius: 20,
    paddingHorizontal: 28,
    paddingVertical: 24,
    minWidth: 200,
    alignItems: 'center',
  },
})
