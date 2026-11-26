import { Check, Undo2 } from 'lucide-react-native'
import { useState } from 'react'
import { Animated, PanResponder, StyleSheet, Text, View } from 'react-native'
import { habitProgressRatio } from '../lib/habitProgress'
import { useScreenStyles, useTheme } from '../theme/ThemeProvider'

const SWIPE_THRESHOLD = 56
const SWIPE_MAX = 88
/** Small horizontal move that still counts if fling velocity is high. */
const SWIPE_FLICK_DX = 24
const SWIPE_FLICK_VX = 0.55

type Props = {
  name: string
  done: number
  target: number
  complete: boolean
  /** Local clock label when complete, e.g. "8:42 AM". */
  completedLabel?: string | null
  first?: boolean
  readOnly?: boolean
  onIncrement: () => void
  onDecrement: () => void
}

function shouldClaimHorizontal(_: unknown, gesture: { dx: number; dy: number }) {
  return Math.abs(gesture.dx) > 8 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.25
}

/**
 * Swipe right (+1) / left (−1). Gmail-style underlay icon scales as you drag.
 * Green bar fills from the left by done/target (e.g. 2/3 → two-thirds width).
 */
export function HabitSwipeRow({
  name,
  done,
  target,
  complete,
  completedLabel,
  first,
  readOnly,
  onIncrement,
  onDecrement,
}: Props) {
  const screen = useScreenStyles()
  const { colors } = useTheme()
  const [translateX] = useState(() => new Animated.Value(0))
  const progress = habitProgressRatio(done, target)

  const addScale = translateX.interpolate({
    inputRange: [0, SWIPE_THRESHOLD * 0.45, SWIPE_THRESHOLD, SWIPE_MAX],
    outputRange: [0.55, 0.85, 1.15, 1],
    extrapolate: 'clamp',
  })
  const undoScale = translateX.interpolate({
    inputRange: [-SWIPE_MAX, -SWIPE_THRESHOLD, -SWIPE_THRESHOLD * 0.45, 0],
    outputRange: [1, 1.15, 0.85, 0.55],
    extrapolate: 'clamp',
  })
  const addOpacity = translateX.interpolate({
    inputRange: [0, 12, SWIPE_THRESHOLD],
    outputRange: [0, 0.55, 1],
    extrapolate: 'clamp',
  })
  const undoOpacity = translateX.interpolate({
    inputRange: [-SWIPE_THRESHOLD, -12, 0],
    outputRange: [1, 0.55, 0],
    extrapolate: 'clamp',
  })

  const panHandlers = readOnly
    ? {}
    : PanResponder.create({
        onMoveShouldSetPanResponder: shouldClaimHorizontal,
        // Claim before the parent ScrollView on iOS so the swipe does not die mid-drag.
        onMoveShouldSetPanResponderCapture: shouldClaimHorizontal,
        onPanResponderTerminationRequest: () => false,
        onShouldBlockNativeResponder: () => true,
        onPanResponderMove: (_, gesture) => {
          translateX.setValue(Math.max(-SWIPE_MAX, Math.min(SWIPE_MAX, gesture.dx)))
        },
        onPanResponderRelease: (_, gesture) => {
          const flickRight = gesture.dx >= SWIPE_FLICK_DX && gesture.vx >= SWIPE_FLICK_VX
          const flickLeft = gesture.dx <= -SWIPE_FLICK_DX && gesture.vx <= -SWIPE_FLICK_VX
          if (gesture.dx >= SWIPE_THRESHOLD || flickRight) {
            onIncrement()
          } else if (gesture.dx <= -SWIPE_THRESHOLD || flickLeft) {
            onDecrement()
          }
          Animated.spring(translateX, {
            toValue: 0,
            friction: 7,
            tension: 80,
            useNativeDriver: true,
          }).start()
        },
        onPanResponderTerminate: () => {
          Animated.spring(translateX, {
            toValue: 0,
            friction: 7,
            tension: 80,
            useNativeDriver: true,
          }).start()
        },
      }).panHandlers

  return (
    <View style={[styles.clip, first && screen.rowFirst]}>
      {!readOnly ? (
        <View style={styles.underlay} pointerEvents="none">
          <View style={[styles.underlaySide, { backgroundColor: colors.habitCompleteBg }]}>
            <Animated.View
              style={[
                styles.actionChip,
                {
                  backgroundColor: colors.habitCompleteBorder,
                  opacity: addOpacity,
                  transform: [{ scale: addScale }],
                },
              ]}
            >
              <Check color="#ffffff" size={22} strokeWidth={2.5} />
            </Animated.View>
          </View>
          <View style={[styles.underlaySide, styles.underlayEnd, { backgroundColor: colors.dangerSoft }]}>
            <Animated.View
              style={[
                styles.actionChip,
                {
                  backgroundColor: colors.danger,
                  opacity: undoOpacity,
                  transform: [{ scale: undoScale }],
                },
              ]}
            >
              <Undo2 color="#ffffff" size={20} strokeWidth={2.5} />
            </Animated.View>
          </View>
        </View>
      ) : null}

      <Animated.View
        {...panHandlers}
        style={[
          screen.row,
          styles.foreground,
          first && screen.rowFirst,
          {
            backgroundColor: colors.surface,
            borderLeftWidth: progress > 0 ? 3 : 0,
            borderLeftColor: progress > 0 ? colors.habitCompleteBorder : 'transparent',
            transform: [{ translateX }],
          },
        ]}
      >
        {progress > 0 ? (
          <View
            pointerEvents="none"
            style={[
              styles.progressFill,
              {
                width: `${progress * 100}%`,
                backgroundColor: colors.habitCompleteBg,
              },
            ]}
          />
        ) : null}
        <View style={[screen.rowMain, styles.content]}>
          <Text style={screen.rowTitle}>{name}</Text>
          {complete && completedLabel ? (
            <Text style={[screen.muted, styles.completedAt]}>Done {completedLabel}</Text>
          ) : null}
        </View>
        <Text
          style={[
            screen.rowMeta,
            styles.content,
            (complete || progress > 0) && {
              color: colors.habitCompleteText,
              fontWeight: '700',
            },
          ]}
        >
          {done}/{target}
        </Text>
      </Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  clip: {
    overflow: 'hidden',
  },
  underlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  underlaySide: {
    width: SWIPE_MAX + 8,
    alignItems: 'flex-start',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  underlayEnd: {
    alignItems: 'flex-end',
  },
  actionChip: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  foreground: {
    borderTopWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  // Match HabitProgressFill / nutrientFill — full row height on iOS.
  progressFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
  },
  content: {
    zIndex: 1,
  },
  completedAt: {
    marginTop: 2,
    fontSize: 12,
  },
})
