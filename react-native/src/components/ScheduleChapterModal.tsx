import { Modal, Pressable, Text, View } from 'react-native'
import { useScreenStyles, useTheme } from '../theme/ThemeProvider'
import { DatePickerField } from './DatePickerField'
import { TimePickerField } from './TimePickerField'

type Props = {
  visible: boolean
  /** Remount key so pickers open with the chapter’s prior schedule. */
  chapterId: string | null
  day: string
  time: string
  canClear: boolean
  saving?: boolean
  onChangeDay: (next: string) => void
  onChangeTime: (next: string) => void
  onSave: () => void
  onClear: () => void
  onCancel: () => void
}

export function ScheduleChapterModal({
  visible,
  chapterId,
  day,
  time,
  canClear,
  saving,
  onChangeDay,
  onChangeTime,
  onSave,
  onClear,
  onCancel,
}: Props) {
  const screen = useScreenStyles()
  const { colors } = useTheme()

  if (!visible) return null

  return (
    <Modal animationType="fade" transparent visible onRequestClose={onCancel}>
      <View style={screen.modalBackdrop}>
        <View style={screen.confirmCard}>
          <Text style={screen.sectionTitle}>Schedule chapter</Text>
          {/* Remount pickers when the target chapter changes so defaults stick. */}
          <View key={chapterId ?? 'none'} style={{ gap: 12 }}>
            <View>
              <Text style={screen.label}>Day</Text>
              <DatePickerField onChange={onChangeDay} value={day} />
            </View>
            <View>
              <Text style={screen.label}>Due time</Text>
              <TimePickerField onChange={onChangeTime} value={time} />
            </View>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Pressable
              accessibilityRole="button"
              disabled={saving}
              onPress={onCancel}
              style={({ pressed }) => [
                screen.save,
                {
                  flex: 1,
                  backgroundColor: colors.habitCompleteBorder,
                },
                (pressed || saving) && screen.buttonDisabled,
              ]}
            >
              <Text style={[screen.buttonText, { color: '#14532d' }]}>Cancel</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={saving || !canClear}
              onPress={onClear}
              style={({ pressed }) => [
                screen.save,
                {
                  flex: 1,
                  backgroundColor: '#ffffff',
                },
                (pressed || saving || !canClear) && screen.buttonDisabled,
              ]}
            >
              <Text style={[screen.buttonText, { color: '#1c1917' }]}>Clear</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={saving}
              onPress={onSave}
              style={({ pressed }) => [
                screen.save,
                {
                  flex: 1,
                  backgroundColor: colors.danger,
                },
                (pressed || saving) && screen.buttonDisabled,
              ]}
            >
              <Text style={[screen.buttonText, { color: '#ffffff' }]}>
                {saving ? '…' : 'Save'}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  )
}
