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
import { formatDay, localDate } from '../lib/localDate'
import { useScreenStyles, useTheme } from '../theme/ThemeProvider'
import { AppTextInput } from './AppTextInput'

type Props = {
  /** YYYY-MM-DD */
  value: string
  onChange: (nextYyyyMmDd: string) => void
  placeholder?: string
  style?: StyleProp<TextStyle>
}

function parseLocalYmd(iso: string): Date {
  const [year, month, day] = iso.split('-').map(Number)
  if (!year || !month || !day) return new Date()
  return new Date(year, month - 1, day)
}

/**
 * Calendar day field stored as YYYY-MM-DD. Native opens the system date UI;
 * web keeps a text input.
 */
export function DatePickerField({
  value,
  onChange,
  placeholder = 'YYYY-MM-DD',
  style,
}: Props) {
  const screen = useScreenStyles()
  const { colors, resolved } = useTheme()
  const [open, setOpen] = useState(false)

  const pickerDate = useMemo(() => parseLocalYmd(value || localDate()), [value])
  const label = value ? formatDay(value) : placeholder

  function applyDate(next: Date) {
    onChange(localDate(next))
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
        accessibilityLabel="Schedule day"
        autoCapitalize="none"
        autoCorrect={false}
        onChangeText={onChange}
        placeholder={placeholder}
        style={[screen.input, style]}
        value={value}
      />
    )
  }

  return (
    <View>
      <Pressable
        accessibilityLabel="Schedule day"
        accessibilityRole="button"
        accessibilityHint="Opens the system date picker"
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
          mode="date"
          display="calendar"
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
              mode="date"
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
