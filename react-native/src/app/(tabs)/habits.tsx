import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio'
import { useFocusEffect, useRouter } from 'expo-router'
import { Mic, Pencil, Repeat } from 'lucide-react-native'
import { useCallback, useState } from 'react'
import { Platform, Pressable, Text, View } from 'react-native'
import { useAuth } from '../../auth/AuthProvider'
import { DayControls } from '../../components/DayControls'
import { HabitSwipeRow } from '../../components/HabitSwipeRow'
import { Screen } from '../../components/Screen'
import { TabChrome } from '../../components/TabChrome'
import { Toast, type ToastKind } from '../../components/Toast'
import {
  bumpHabitDayCount,
  completeHabitsFromVoice,
  loadHabitDayCounts,
  loadHabits,
  type Habit,
  type HabitDayCount,
} from '../../lib/gym'
import { habitRowsForDay } from '../../lib/habitSchedule'
import { localDate } from '../../lib/localDate'
import { useScreenStyles, useTheme } from '../../theme/ThemeProvider'

function recordingMimeType(): string {
  return Platform.OS === 'web' ? 'audio/webm' : 'audio/mp4'
}

export default function HabitsScreen() {
  const screen = useScreenStyles()
  const { colors } = useTheme()
  const ACTION_ICON = colors.accent
  const { session } = useAuth()
  const router = useRouter()
  const userId = session?.user.id
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY)
  const recorderState = useAudioRecorderState(audioRecorder)
  const [day, setDay] = useState(localDate)
  const [habits, setHabits] = useState<Habit[]>([])
  const [counts, setCounts] = useState<HabitDayCount[]>([])
  const [error, setError] = useState<string | null>(null)
  const [voiceBusy, setVoiceBusy] = useState(false)
  const [toast, setToast] = useState<{ kind: ToastKind; message: string } | null>(null)

  const load = useCallback(async () => {
    if (!userId) return
    try {
      const [nextHabits, nextCounts] = await Promise.all([
        loadHabits(userId),
        loadHabitDayCounts(userId, day),
      ])
      setHabits(nextHabits)
      setCounts(nextCounts)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load habits')
    }
  }, [userId, day])

  useFocusEffect(
    useCallback(() => {
      void load()
    }, [load]),
  )

  async function toggleVoice() {
    if (voiceBusy) return

    if (recorderState.isRecording) {
      setVoiceBusy(true)
      try {
        await audioRecorder.stop()
        const uri = audioRecorder.uri
        if (!uri) {
          setToast({ kind: 'error', message: 'No recording captured' })
          return
        }
        const result = await completeHabitsFromVoice({
          day,
          audioUri: uri,
          mimeType: recordingMimeType(),
        })
        if (result.ok) {
          const names = result.completed.map((row) => row.habit_name).join(', ')
          setToast({
            kind: 'success',
            message: names ? `Marked: ${names}` : 'Habits updated',
          })
          await load()
        } else {
          setToast({ kind: 'error', message: result.error })
        }
      } catch (err) {
        const detail =
          err instanceof Error && err.message.trim()
            ? err.message.trim()
            : 'Could not complete habits from voice'
        setToast({ kind: 'error', message: detail })
      } finally {
        setVoiceBusy(false)
      }
      return
    }

    const permission = await AudioModule.requestRecordingPermissionsAsync()
    if (!permission.granted) {
      setToast({ kind: 'error', message: 'Microphone permission is required' })
      return
    }
    await setAudioModeAsync({
      playsInSilentMode: true,
      allowsRecording: true,
    })
    await audioRecorder.prepareToRecordAsync()
    audioRecorder.record()
  }

  async function bump(habitId: string, delta: number) {
    try {
      await bumpHabitDayCount({ habitId, day, delta })
      await load()
    } catch (err) {
      setToast({
        kind: 'error',
        message: err instanceof Error ? err.message : 'Could not update habit',
      })
    }
  }

  const rows = habitRowsForDay(habits, counts, day)
  const recording = recorderState.isRecording
  const noHabitsDefined = habits.length === 0
  const nothingDue = !noHabitsDefined && rows.length === 0

  return (
    <View style={{ flex: 1 }}>
      <Screen
        header={
          <>
            <TabChrome
              icon={Repeat}
              title="Habits"
              trailing={<DayControls day={day} onChange={setDay} />}
            />
            <View style={screen.card}>
              <View style={screen.iconActionRow}>
                <Pressable
                  accessibilityLabel="Edit habits"
                  accessibilityRole="button"
                  onPress={() => router.push('/manage-habits')}
                  style={({ pressed }) => [screen.iconActionButton, pressed && screen.rowPressed]}
                >
                  <Pencil color={ACTION_ICON} size={20} strokeWidth={2.25} />
                </Pressable>
                <Pressable
                  accessibilityLabel={
                    recording ? 'Stop recording and mark habits done' : 'Speak completed habits'
                  }
                  accessibilityRole="button"
                  disabled={voiceBusy}
                  onPress={() => void toggleVoice()}
                  style={({ pressed }) => [
                    screen.iconActionButton,
                    recording && screen.micButtonActive,
                    (pressed || voiceBusy) && screen.buttonDisabled,
                  ]}
                >
                  <Mic
                    color={recording ? colors.accentText : ACTION_ICON}
                    size={20}
                    strokeWidth={2.25}
                  />
                </Pressable>
              </View>
            </View>
          </>
        }
      >
        {error ? <Text style={screen.error}>{error}</Text> : null}
        <View style={screen.card}>
          {noHabitsDefined ? (
            <View style={[screen.row, screen.rowFirst]}>
              <Text style={screen.muted}>No habits yet. Tap Edit to add some.</Text>
            </View>
          ) : nothingDue ? (
            <View style={[screen.row, screen.rowFirst]}>
              <Text style={screen.muted}>Nothing due this day.</Text>
            </View>
          ) : (
            rows.map((row, index) => (
              <HabitSwipeRow
                key={row.habit.id}
                name={row.habit.name}
                done={row.done}
                target={row.target}
                complete={row.complete}
                first={index === 0}
                onIncrement={() => void bump(row.habit.id, 1)}
                onDecrement={() => void bump(row.habit.id, -1)}
              />
            ))
          )}
        </View>
      </Screen>
      <Toast
        visible={toast !== null}
        kind={toast?.kind ?? 'success'}
        message={toast?.message ?? ''}
        durationMs={toast?.kind === 'error' ? 5600 : 2800}
        onHide={() => setToast(null)}
      />
    </View>
  )
}
