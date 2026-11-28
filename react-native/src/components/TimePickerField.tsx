import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker'
import { createElement, useMemo, useRef, useState } from 'react'
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
} from 'react-native'
import {
  dateToReminderTime,
  formatReminderTime,
  formatReminderTimeDisplay,
  parseReminderTime,
  reminderTimeToDate,
} from '../lib/habitReminders'
import { useScreenStyles, useTheme } from '../theme/ThemeProvider'

type Props = {
  value: string
  onChange: (nextHhMm: string) => void
  placeholder?: string
  style?: StyleProp<TextStyle>
}

type HtmlTimeInput = HTMLInputElement & {
  showPicker?: () => void
}

/**
 * Reminder wall-clock field. Native opens the system time UI; web uses the same
 * pressable label and opens the browser time picker. Stored value stays `HH:MM`.
 */
export function TimePickerField({
  value,
  onChange,
  placeholder = '08:00',
  style,
}: Props) {
  const screen = useScreenStyles()
  const { colors, resolved } = useTheme()
  const [open, setOpen] = useState(false)
  const webInputRef = useRef<HtmlTimeInput | null>(null)

  const parsed = useMemo(() => parseReminderTime(value) ?? { hour: 8, minute: 0 }, [value])
  const pickerDate = useMemo(() => reminderTimeToDate(parsed), [parsed])
  const label = value ? formatReminderTimeDisplay(parsed) : placeholder

  function applyDate(next: Date) {
    onChange(formatReminderTime(dateToReminderTime(next)))
  }

  function onNativeChange(event: DateTimePickerEvent, selected?: Date) {
    if (Platform.OS === 'android') {
      setOpen(false)
      if (event.type !== 'set' || !selected) return
      applyDate(selected)
      return
    }
    if (selected) applyDate(selected)
  }

  function openWebPicker() {
    const el = webInputRef.current
    if (!el) return
    try {
      if (typeof el.showPicker === 'function') {
        el.showPicker()
        return
      }
    } catch {
      // Fall through to click() when showPicker is blocked.
    }
    el.click()
  }

  if (Platform.OS === 'web') {
    return (
      <View style={styles.webWrap}>
        <Pressable
          accessibilityLabel="Due time"
          accessibilityRole="button"
          accessibilityHint="Opens the time picker"
          onPress={openWebPicker}
          style={({ pressed }) => [
            screen.input,
            styles.trigger,
            pressed && screen.rowPressed,
            style,
          ]}
        >
          <Text style={[styles.triggerText, { color: colors.text }]}>{label}</Text>
        </Pressable>
        {createElement('input', {
          ref: webInputRef,
          type: 'time',
          value: formatReminderTime(parsed),
          onChange: (event: { target: { value: string } }) => {
            if (event.target.value) onChange(event.target.value.slice(0, 5))
          },
          'aria-hidden': true,
          tabIndex: -1,
          style: webHiddenInputStyle,
        })}
      </View>
    )
  }

  return (
    <View>
      <Pressable
        accessibilityLabel="Due time"
        accessibilityRole="button"
        accessibilityHint="Opens the system time picker"
        onPress={() => setOpen(true)}
        style={({ pressed }) => [
          screen.input,
          styles.trigger,
          pressed && screen.rowPressed,
          style,
        ]}
      >
        <Text style={[styles.triggerText, { color: colors.text }]}>{label}</Text>
      </Pressable>

      {Platform.OS === 'android' && open ? (
        <DateTimePicker
          value={pickerDate}
          mode="time"
          display="clock"
          is24Hour={false}
          onChange={onNativeChange}
        />
      ) : null}

      {Platform.OS === 'ios' ? (
        <Modal
          visible={open}
          transparent
          animationType="slide"
          onRequestClose={() => setOpen(false)}
        >
          <Pressable style={styles.backdrop} onPress={() => setOpen(false)} />
          <View style={[styles.sheet, { backgroundColor: colors.surface }]}>
            <View style={[styles.sheetHeader, { borderBottomColor: colors.borderSubtle }]}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Done"
                onPress={() => setOpen(false)}
                hitSlop={12}
              >
                <Text style={[styles.done, { color: colors.accent }]}>Done</Text>
              </Pressable>
            </View>
            <DateTimePicker
              value={pickerDate}
              mode="time"
              display="spinner"
              themeVariant={resolved === 'dark' ? 'dark' : 'light'}
              onChange={onNativeChange}
              style={styles.iosSpinner}
            />
          </View>
        </Modal>
      ) : null}
    </View>
  )
}

const webHiddenInputStyle = {
  position: 'absolute' as const,
  opacity: 0,
  width: 1,
  height: 1,
  left: 0,
  top: 0,
  pointerEvents: 'none' as const,
  border: 'none',
  padding: 0,
  margin: 0,
}

const styles = StyleSheet.create({
  webWrap: {
    position: 'relative',
  },
  trigger: {
    justifyContent: 'center',
  },
  triggerText: {
    fontSize: 16,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  sheet: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: 24,
  },
  sheetHeader: {
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  done: {
    fontSize: 17,
    fontWeight: '600',
  },
  iosSpinner: {
    alignSelf: 'center',
    width: '100%',
  },
})
