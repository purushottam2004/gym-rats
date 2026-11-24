import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio'
import { useFocusEffect, useRouter } from 'expo-router'
import { Dumbbell, Mic } from 'lucide-react-native'
import { useCallback, useState } from 'react'
import { Platform, Pressable, Text, View } from 'react-native'
import { useAuth } from '../../auth/AuthProvider'
import { DayControls } from '../../components/DayControls'
import { DeleteConfirmButton } from '../../components/DeleteConfirmButton'
import { OrdinalNumber } from '../../components/OrdinalNumber'
import { Screen } from '../../components/Screen'
import { TabChrome } from '../../components/TabChrome'
import { Toast, type ToastKind } from '../../components/Toast'
import { screen } from '../../components/screenStyles'
import { deleteSet, loadSets, logSetFromVoice, type SetLog } from '../../lib/gym'
import { localDate } from '../../lib/localDate'
import { ordinalSuffix } from '../../lib/ordinal'

function recordingMimeType(): string {
  return Platform.OS === 'web' ? 'audio/webm' : 'audio/mp4'
}

export default function LiftsScreen() {
  const { session } = useAuth()
  const router = useRouter()
  const userId = session?.user.id
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY)
  const recorderState = useAudioRecorderState(audioRecorder)
  const [day, setDay] = useState(localDate)
  const [rows, setRows] = useState<SetLog[]>([])
  const [error, setError] = useState<string | null>(null)
  const [voiceBusy, setVoiceBusy] = useState(false)
  const [toast, setToast] = useState<{ kind: ToastKind; message: string } | null>(null)

  const load = useCallback(async () => {
    if (!userId) return
    try {
      setRows(await loadSets(userId, day))
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load lifts')
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
        const result = await logSetFromVoice({
          day,
          audioUri: uri,
          mimeType: recordingMimeType(),
        })
        if (result.ok) {
          setToast({ kind: 'success', message: 'Set added' })
          await load()
        } else {
          setToast({ kind: 'error', message: result.error })
        }
      } catch (err) {
        const detail =
          err instanceof Error && err.message.trim()
            ? err.message.trim()
            : 'Could not add set from voice'
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

  const names = [...new Set(rows.map((row) => row.lift.name))]
  const recording = recorderState.isRecording

  return (
    <View style={{ flex: 1 }}>
      <Screen
        header={
          <>
            <TabChrome
              icon={Dumbbell}
              title="Lifts"
              trailing={<DayControls day={day} onChange={setDay} />}
            />
            <View style={screen.card}>
              <View style={[screen.addRow, screen.addRowFirst]}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => router.push({ pathname: '/add-set', params: { day } })}
                  style={screen.dietActionSide}
                >
                  <Text style={screen.addText}>Add a set</Text>
                </Pressable>
                <Pressable
                  accessibilityLabel={recording ? 'Stop recording and add set' : 'Speak a set'}
                  accessibilityRole="button"
                  disabled={voiceBusy}
                  onPress={() => void toggleVoice()}
                  style={({ pressed }) => [
                    screen.dietMicButton,
                    recording && screen.micButtonActive,
                    (pressed || voiceBusy) && screen.buttonDisabled,
                  ]}
                >
                  <Mic color={recording ? '#9a3412' : '#1c1917'} size={20} strokeWidth={2.25} />
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => router.push('/lift-catalog')}
                  style={[screen.dietActionSide, screen.dietActionSideEnd]}
                >
                  <Text style={screen.addText}>View Catalogue</Text>
                </Pressable>
              </View>
            </View>
          </>
        }
      >
        {error ? <Text style={screen.error}>{error}</Text> : null}
        {names.map((name) => (
          <View key={name} style={screen.card}>
            <View style={[screen.row, screen.rowFirst]}>
              <Text style={screen.muted}>{name}</Text>
            </View>
            {rows
              .filter((row) => row.lift.name === name)
              .map((row) => (
                <View key={row.id} style={screen.row}>
                  <View style={[screen.rowMain, screen.setLabelRow]}>
                    <OrdinalNumber value={row.attempt} />
                    <Text style={screen.rowTitle}>{row.reps} reps</Text>
                  </View>
                  <View style={screen.choiceTrail}>
                    <Text style={screen.rowMeta}>{row.load_kg} kg</Text>
                    <DeleteConfirmButton
                      title="Delete set?"
                      message={`Remove ${row.attempt}${ordinalSuffix(row.attempt)} set (${row.reps} reps · ${row.load_kg} kg)?`}
                      onConfirm={() => void deleteSet(row.id).then(load)}
                    />
                  </View>
                </View>
              ))}
          </View>
        ))}
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
