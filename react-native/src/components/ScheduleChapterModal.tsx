import { Modal, Pressable, Text, View } from 'react-native'
import { useScreenStyles } from '../theme/ThemeProvider'
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

  return (
    <Modal animationType="fade" transparent visible={visible} onRequestClose={onCancel}>
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
          <Pressable
            disabled={saving}
            onPress={onSave}
            style={[screen.save, saving && screen.buttonDisabled]}
          >
            <Text style={screen.buttonText}>{saving ? 'Saving…' : 'Save schedule'}</Text>
          </Pressable>
          {canClear ? (
            <Pressable
              disabled={saving}
              onPress={onClear}
              style={[screen.secondaryButton, saving && screen.buttonDisabled]}
            >
              <Text style={screen.secondaryButtonText}>Clear schedule</Text>
            </Pressable>
          ) : null}
          <Pressable
            disabled={saving}
            onPress={onCancel}
            style={[screen.secondaryButton, saving && screen.buttonDisabled]}
          >
            <Text style={screen.secondaryButtonText}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  )
}
