import { Calendar, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react-native'
import { createElement, useId } from 'react'
import { Platform, Pressable, Text, View } from 'react-native'
import { formatDay, shiftDate } from '../lib/localDate'
import {
  similarDayNext,
  similarDayPrev,
  type SimilarDayLinks,
} from '../lib/similarDayJump'
import { useScreenStyles, useTheme } from '../theme/ThemeProvider'

type Props = {
  day: string
  onChange: (day: string) => void
  /** When set, show << >> jumps using these weekday links (Lifts). */
  similarLinks?: SimilarDayLinks
}

export function DayControls({ day, onChange, similarLinks }: Props) {
  const screen = useScreenStyles()
  const { colors } = useTheme()
  const accent = colors.accent
  const inputId = useId()

  function openPicker() {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return
    const node = document.getElementById(inputId) as HTMLInputElement | null
    if (!node) return
    if (typeof node.showPicker === 'function') node.showPicker()
    else node.click()
  }

  return (
    <View style={screen.dayControls}>
      <View style={screen.dayPill}>
        {similarLinks ? (
          <Pressable
            accessibilityLabel="Previous similar day"
            accessibilityRole="button"
            hitSlop={8}
            onPress={() => onChange(similarDayPrev(day, similarLinks))}
          >
            <ChevronsLeft color={accent} size={18} strokeWidth={2.25} />
          </Pressable>
        ) : null}
        <Pressable
          accessibilityLabel="Previous day"
          accessibilityRole="button"
          hitSlop={8}
          onPress={() => onChange(shiftDate(day, -1))}
        >
          <ChevronLeft color={accent} size={18} strokeWidth={2.25} />
        </Pressable>
        <Text style={screen.dayPillLabel}>{formatDay(day)}</Text>
        <Pressable
          accessibilityLabel="Next day"
          accessibilityRole="button"
          hitSlop={8}
          onPress={() => onChange(shiftDate(day, 1))}
        >
          <ChevronRight color={accent} size={18} strokeWidth={2.25} />
        </Pressable>
        {similarLinks ? (
          <Pressable
            accessibilityLabel="Next similar day"
            accessibilityRole="button"
            hitSlop={8}
            onPress={() => onChange(similarDayNext(day, similarLinks))}
          >
            <ChevronsRight color={accent} size={18} strokeWidth={2.25} />
          </Pressable>
        ) : null}
      </View>
      <Pressable
        accessibilityLabel="Pick a date"
        accessibilityRole="button"
        hitSlop={8}
        onPress={openPicker}
        style={screen.dayCalendarButton}
      >
        <Calendar color={accent} size={18} strokeWidth={2.25} />
        {Platform.OS === 'web'
          ? createElement('input', {
              id: inputId,
              type: 'date',
              value: day,
              onChange: (event: { target: { value: string } }) => {
                if (event.target.value) onChange(event.target.value)
              },
              style: {
                position: 'absolute',
                opacity: 0,
                width: '100%',
                height: '100%',
                left: 0,
                top: 0,
                cursor: 'pointer',
                border: 0,
              },
              'aria-label': 'Pick a date',
            })
          : null}
      </Pressable>
    </View>
  )
}
