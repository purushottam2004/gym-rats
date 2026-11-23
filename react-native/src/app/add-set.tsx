import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio'
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router'
import { Circle, CircleCheck, Mic } from 'lucide-react-native'
import { useCallback, useState } from 'react'
import { Platform, Pressable, Text, TextInput, View } from 'react-native'
import { Screen } from '../components/Screen'
import { Toast, type ToastKind } from '../components/Toast'
import { screen } from '../components/screenStyles'
import { loadLifts, logSet, logSetFromVoice, type Lift } from '../lib/gym'

const SET_NUMBERS = [1, 2, 3, 4, 5] as const

function recordingMimeType(): string {
  return Platform.OS === 'web' ? 'audio/webm' : 'audio/mp4'
}

export default function AddSetScreen() {
  const { day } = useLocalSearchParams<{ day: string }>()
  const router = useRouter()
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY)
  const recorderState = useAudioRecorderState(audioRecorder)
  const [lifts, setLifts] = useState<Lift[]>([])
  const [liftId, setLiftId] = useState<string | null>(null)
  const [setNumber, setSetNumber] = useState<(typeof SET_NUMBERS)[number]>(1)
  const [reps, setReps] = useState('')
  const [loadKg, setLoadKg] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [voiceBusy, setVoiceBusy] = useState(false)
  const [toast, setToast] = useState<{ kind: ToastKind; message: string } | null>(null)

  useFocusEffect(
    useCallback(() => {
      void loadLifts()
        .then((rows) => {
          setLifts(rows)
          setLiftId((current) => current ?? rows[0]?.id ?? null)
        })
        .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Could not load lifts'))
    }, []),
  )

  async function save() {
    const repsValue = Number(reps)
    const loadValue = Number(loadKg)
    if (!liftId || !day) {
      setError('Pick a lift and day first')
      return
    }
    if (!Number.isInteger(repsValue) || repsValue < 1) {
      setError('Reps are a whole number, 1 or more')
      return
    }
    if (!(loadValue >= 0)) {
      setError('Kilograms cannot be negative')
      return
    }
    try {
      await logSet({ liftId, day, attempt: setNumber, reps: repsValue, loadKg: loadValue })
      router.back()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save')
    }
  }

  async function toggleVoice() {
    if (voiceBusy) return
    if (!day) {
      setToast({ kind: 'error', message: 'Pick a day first' })
      return
    }

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
          setTimeout(() => router.back(), 600)
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

  const recording = recorderState.isRecording
  const speakLabel = voiceBusy ? 'Adding set…' : recording ? 'Stop & add set' : 'Speak a set'

  return (
    <View style={{ flex: 1 }}>
      <Screen>
        <Text style={screen.title}>Add a set</Text>
        <Text style={screen.muted}>{day}</Text>
        {error ? <Text style={screen.error}>{error}</Text> : null}
        {lifts.length > 0 ? (
          <View style={screen.card}>
            {lifts.map((lift, index) => {
              const selectedLift = liftId === lift.id
              return (
                <Pressable
                  accessibilityRole="radio"
                  accessibilityState={{ selected: selectedLift }}
                  key={lift.id}
                  onPress={() => setLiftId(lift.id)}
                  style={({ pressed }) => [
                    screen.row,
                    index === 0 && screen.rowFirst,
                    selectedLift && screen.rowSelected,
                    pressed && (selectedLift ? screen.rowSelectedPressed : screen.rowPressed),
                  ]}
                >
                  <Text style={[screen.rowTitle, selectedLift && screen.rowTitleSelected]}>{lift.name}</Text>
                  {selectedLift ? (
                    <CircleCheck color="#c2410c" size={20} strokeWidth={2.25} />
                  ) : (
                    <Circle color="#d6d3d1" size={20} strokeWidth={1.75} />
                  )}
                </Pressable>
              )
            })}
          </View>
        ) : null}
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/new-lift')}
          style={({ pressed }) => [screen.addCard, pressed && screen.rowPressed]}
        >
          <Text style={screen.addText}>New lift</Text>
        </Pressable>
        <Text style={screen.label}>Set Number</Text>
        <View style={screen.setNumberRow}>
          {SET_NUMBERS.map((n) => {
            const selected = setNumber === n
            return (
              <Pressable
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                key={n}
                onPress={() => setSetNumber(n)}
                style={({ pressed }) => [
                  screen.setNumberCircle,
                  selected && screen.setNumberCircleSelected,
                  pressed && !selected && screen.setNumberCirclePressed,
                ]}
              >
                <Text style={[screen.setNumberCircleText, selected && screen.setNumberCircleTextSelected]}>{n}</Text>
              </Pressable>
            )
          })}
        </View>
        <Text style={screen.label}>Reps</Text>
        <TextInput keyboardType="number-pad" onChangeText={setReps} style={screen.input} value={reps} />
        <Text style={screen.label}>Kilograms</Text>
        <TextInput keyboardType="decimal-pad" onChangeText={setLoadKg} style={screen.input} value={loadKg} />
        <Pressable
          accessibilityRole="button"
          disabled={voiceBusy}
          onPress={() => void toggleVoice()}
          style={({ pressed }) => [
            screen.speakButton,
            recording && screen.speakButtonActive,
            (pressed || voiceBusy) && screen.buttonDisabled,
          ]}
        >
          <Mic color={recording ? '#9a3412' : '#1c1917'} size={20} strokeWidth={2.25} />
          <Text style={[screen.speakButtonText, recording && screen.speakButtonTextActive]}>{speakLabel}</Text>
        </Pressable>
        <Pressable onPress={() => void save()} style={screen.save}>
          <Text style={screen.buttonText}>Save</Text>
        </Pressable>
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
