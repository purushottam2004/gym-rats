import { Bell, BellOff, Check, Undo2 } from 'lucide-react-native'
import { useState, type ReactNode } from 'react'
import { Animated, PanResponder, Pressable, StyleSheet, Text, View } from 'react-native'
import { habitProgressRatio } from '../lib/habitProgress'
import { useScreenStyles, useTheme } from '../theme/ThemeProvider'
import { RatioProgressFill } from './RatioProgressFill'

const SWIPE_THRESHOLD = 56
const SWIPE_MAX = 88
/** Small horizontal move that still counts if fling velocity is high. */
const SWIPE_FLICK_DX = 24
const SWIPE_FLICK_VX = 0.55

type ReminderMuteControl = {
  /** True when reminders are muted for the selected day only. */
  muted: boolean
  /** Habit has overall remind_enabled; when false the bell is shown off and disabled. */
  remindersConfigured: boolean
  onToggle: () => void
}

type Props = {
  name: string
  done: number
  target: number
  complete: boolean
  /** Local clock label when complete, e.g. "8:42 AM". */
  completedLabel?: string | null
  /** Optional leading content (e.g. chapter ordinal badge). */
  leading?: ReactNode
  /** Day-only reminder mute bell (left of the swipe row; does not change Habit settings). */
  reminderMute?: ReminderMuteControl
  /** Replaces the done/target meta when set (e.g. pencil edit control). */
  trailing?: ReactNode
  first?: boolean
  readOnly?: boolean
  onIncrement: () => void
  onDecrement: () => void
}

/** Leave the extreme left edge free for the iOS edge-back gesture. */
const EDGE_BACK_ZONE_PX = 28

function shouldClaimHorizontal(
  event: { nativeEvent: { pageX: number } },
  gesture: { dx: number; dy: number },
) {
  if (event.nativeEvent.pageX < EDGE_BACK_ZONE_PX) return false
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
  leading,
  reminderMute,
  trailing,
  first,
  readOnly,
  onIncrement,
  onDecrement,
}: Props) {
  const screen = useScreenStyles()
  const { colors } = useTheme()
  const [translateX] = useState(() => new Animated.Value(0))
  const progress = habitProgressRatio(done, target)
  const muteInteractive = reminderMute != null && reminderMute.remindersConfigured
  const muteShownOff = reminderMute != null && (!reminderMute.remindersConfigured || reminderMute.muted)

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

  const swipe = (
    <View style={[styles.clip, first && screen.rowFirst, reminderMute ? styles.clipFlex : null]}>
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
        <RatioProgressFill ratio={progress} color={colors.habitCompleteBg} />
        {leading ? <View style={[styles.leading, styles.content]}>{leading}</View> : null}
        <View style={[screen.rowMain, styles.content]}>
          <Text style={screen.rowTitle}>{name}</Text>
          {complete && completedLabel ? (
            <Text style={[screen.muted, styles.completedAt]}>Done {completedLabel}</Text>
          ) : null}
        </View>
        {trailing != null ? (
          <View style={[styles.trailing, styles.content]}>{trailing}</View>
        ) : (
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
        )}
      </Animated.View>
    </View>
  )

  if (!reminderMute) return swipe

  const MuteIcon = muteShownOff ? BellOff : Bell
  return (
    <View style={[styles.rowWithMute, first && screen.rowFirst]}>
      <Pressable
        accessibilityLabel={
          !reminderMute.remindersConfigured
            ? 'Reminders are off for this habit'
            : muteShownOff
              ? 'Reminders muted for this day — tap to turn on'
              : 'Reminders on for this day — tap to mute today only'
        }
        accessibilityRole="button"
        disabled={!muteInteractive}
        hitSlop={8}
        onPress={muteInteractive ? reminderMute.onToggle : undefined}
        style={({ pressed }) => [
          styles.muteButton,
          pressed && muteInteractive && screen.rowPressed,
          !muteInteractive && styles.muteDisabled,
        ]}
      >
        <MuteIcon
          color={muteShownOff ? colors.tabInactive : colors.accent}
          size={20}
          strokeWidth={2.1}
        />
      </Pressable>
      {swipe}
    </View>
  )
}

const styles = StyleSheet.create({
  rowWithMute: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  muteButton: {
    width: 44,
    justifyContent: 'center',
    alignItems: 'center',
    paddingLeft: 10,
  },
  muteDisabled: {
    opacity: 0.55,
  },
  clip: {
    overflow: 'hidden',
  },
  clipFlex: {
    flex: 1,
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
  content: {
    zIndex: 1,
  },
  leading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  trailing: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  completedAt: {
    marginTop: 2,
    fontSize: 12,
  },
})
