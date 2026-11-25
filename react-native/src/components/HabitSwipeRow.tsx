import { useState } from 'react'
import { Animated, PanResponder, Text, View } from 'react-native'
import { useScreenStyles, useTheme } from '../theme/ThemeProvider'

const SWIPE_THRESHOLD = 56

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
 * Swipe right (+1) / left (−1). Green fill when done >= target.
 * Uses PanResponder so Expo Go needs no extra native swipe libs.
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

  const panHandlers = readOnly
    ? {}
    : PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) =>
          Math.abs(gesture.dx) > 8 && Math.abs(gesture.dx) > Math.abs(gesture.dy),
        onPanResponderMove: (_, gesture) => {
          translateX.setValue(Math.max(-80, Math.min(80, gesture.dx)))
        },
        onPanResponderRelease: (_, gesture) => {
          if (gesture.dx >= SWIPE_THRESHOLD) {
            onIncrement()
          } else if (gesture.dx <= -SWIPE_THRESHOLD) {
            onDecrement()
          }
          Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start()
        },
        onPanResponderTerminate: () => {
          Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start()
        },
      }).panHandlers

  return (
    <Animated.View
      {...panHandlers}
      style={[
        screen.row,
        first && screen.rowFirst,
        {
          backgroundColor: complete ? colors.toastSuccessBg : colors.surface,
          borderLeftWidth: complete ? 3 : 0,
          borderLeftColor: complete ? colors.toastSuccessBorder : 'transparent',
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
          complete && { color: colors.toastSuccessText, fontWeight: '700' },
        ]}
      >
        {done}/{target}
      </Text>
    </Animated.View>
  )
}
