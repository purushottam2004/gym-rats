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
import { formatDay, localDate } from '../lib/localDate'
import { useScreenStyles, useTheme } from '../theme/ThemeProvider'

type Props = {
  /** YYYY-MM-DD */
  value: string
  onChange: (nextYyyyMmDd: string) => void
  placeholder?: string
  style?: StyleProp<TextStyle>
}

type HtmlDateInput = HTMLInputElement & {
  showPicker?: () => void
}

function parseLocalYmd(iso: string): Date {
  const [year, month, day] = iso.split('-').map(Number)
  if (!year || !month || !day) return new Date()
  return new Date(year, month - 1, day)
}

/**
 * Calendar day field stored as YYYY-MM-DD. Native opens the system date UI;
 * web uses the same pressable label and opens the browser date picker.
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
  const webInputRef = useRef<HtmlDateInput | null>(null)

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
          accessibilityLabel="Schedule day"
          accessibilityRole="button"
          accessibilityHint="Opens the date picker"
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
          type: 'date',
          value: value || '',
          onChange: (event: { target: { value: string } }) => {
            if (event.target.value) onChange(event.target.value)
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
