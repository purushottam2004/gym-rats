import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker'
import { useMemo, useState } from 'react'
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
import { AppTextInput } from './AppTextInput'

type Props = {
  value: string
  onChange: (nextHhMm: string) => void
  placeholder?: string
  style?: StyleProp<TextStyle>
}

/**
 * Reminder wall-clock field. Native opens the system time UI (iOS wheels with
 * AM/PM when the device is 12h; Android clock dialog). Web keeps `<input type="time">`.
 * Stored value stays `HH:MM` for Postgres / notification scheduling.
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

  const parsed = useMemo(() => parseReminderTime(value) ?? { hour: 8, minute: 0 }, [value])
  const pickerDate = useMemo(() => reminderTimeToDate(parsed), [parsed])
  const label = formatReminderTimeDisplay(parsed)

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

  if (Platform.OS === 'web') {
    return (
      <AppTextInput
        accessibilityLabel="First notification time"
        autoCapitalize="none"
        autoCorrect={false}
        onChangeText={onChange}
        placeholder={placeholder}
        style={[screen.input, style]}
        value={value}
        // RN Web maps this to <input type="time"> (browser clock / AM-PM UI).
        {...({ type: 'time' } as object)}
      />
    )
  }

  return (
    <View>
      <Pressable
        accessibilityLabel="First notification time"
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

const styles = StyleSheet.create({
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
