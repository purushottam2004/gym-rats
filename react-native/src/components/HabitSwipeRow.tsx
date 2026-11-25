import { Check, Undo2 } from 'lucide-react-native'
import { useState } from 'react'
import { Animated, PanResponder, StyleSheet, Text, View } from 'react-native'
import { useScreenStyles, useTheme } from '../theme/ThemeProvider'

const SWIPE_THRESHOLD = 56
const SWIPE_MAX = 88

type Props = {
  name: string
  done: number
  target: number
  complete: boolean
  first?: boolean
  readOnly?: boolean
  onIncrement: () => void
  onDecrement: () => void
}

/**
 * Swipe right (+1) / left (−1). Gmail-style underlay icon scales as you drag.
 * Green fill when done >= target.
 */
export function HabitSwipeRow({
  name,
  done,
  target,
  complete,
  first,
  readOnly,
  onIncrement,
  onDecrement,
}: Props) {
  const screen = useScreenStyles()
  const { colors } = useTheme()
  const [translateX] = useState(() => new Animated.Value(0))

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
        onMoveShouldSetPanResponder: (_, gesture) =>
          Math.abs(gesture.dx) > 8 && Math.abs(gesture.dx) > Math.abs(gesture.dy),
        onPanResponderMove: (_, gesture) => {
          translateX.setValue(Math.max(-SWIPE_MAX, Math.min(SWIPE_MAX, gesture.dx)))
        },
        onPanResponderRelease: (_, gesture) => {
          if (gesture.dx >= SWIPE_THRESHOLD) {
            onIncrement()
          } else if (gesture.dx <= -SWIPE_THRESHOLD) {
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
            backgroundColor: complete ? colors.habitCompleteBg : colors.surface,
            borderLeftWidth: complete ? 3 : 0,
            borderLeftColor: complete ? colors.habitCompleteBorder : 'transparent',
            transform: [{ translateX }],
          },
        ]}
      >
        <View style={screen.rowMain}>
          <Text style={screen.rowTitle}>{name}</Text>
          {!readOnly ? (
            <Text style={screen.muted}>Swipe right to add · left to undo</Text>
          ) : null}
        </View>
        <Text
          style={[
            screen.rowMeta,
            complete && { color: colors.habitCompleteText, fontWeight: '700' },
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
    ...StyleSheet.absoluteFill,
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
  },
})
