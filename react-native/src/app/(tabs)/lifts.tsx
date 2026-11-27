import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio'
import { useFocusEffect, useRouter } from 'expo-router'
import { BookOpen, CalendarDays, Dumbbell, Mic, Plus } from 'lucide-react-native'
import { useCallback, useState } from 'react'
import { Platform, Pressable, Text, View } from 'react-native'
import { useAuth } from '../../auth/AuthProvider'
import { AddSetModal } from '../../components/AddSetModal'
import { BusyOverlay, LoadingBlock } from '../../components/BrandLoader'
import { DayControls } from '../../components/DayControls'
import { ProfileAvatarButton } from '../../components/ProfileAvatarButton'
import { DeleteConfirmButton } from '../../components/DeleteConfirmButton'
import { OrdinalNumber } from '../../components/OrdinalNumber'
import { Screen } from '../../components/Screen'
import { TabChrome } from '../../components/TabChrome'
import { Toast, type ToastKind } from '../../components/Toast'
import { useScreenStyles, useTheme } from '../../theme/ThemeProvider'
import {
  deleteSet,
  loadSets,
  loadWeekdayLifts,
  logSetFromVoice,
  type Lift,
  type SetLog,
} from '../../lib/gym'
import { liftCardsForDay } from '../../lib/liftCards'
import { localDate } from '../../lib/localDate'
import { nextSetAttempt, type SetAttempt } from '../../lib/nextSetAttempt'
import { ordinalSuffix } from '../../lib/ordinal'
import {
  defaultSimilarDayLinks,
  loadSimilarDayLinks,
  type SimilarDayLinks,
} from '../../lib/similarDayJump'
import { weekdayFromDay } from '../../lib/weekday'

type AddTarget = {
  liftId: string
  liftName: string
  initialAttempt: SetAttempt
}

function recordingMimeType(): string {
  return Platform.OS === 'web' ? 'audio/webm' : 'audio/mp4'
}

export default function LiftsScreen() {
  const screen = useScreenStyles()
  const { colors } = useTheme()
  const ACTION_ICON = colors.accent
  const { session } = useAuth()
  const router = useRouter()
  const userId = session?.user.id
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY)
  const recorderState = useAudioRecorderState(audioRecorder)
  const [day, setDay] = useState(localDate)
  const [rows, setRows] = useState<SetLog[]>([])
  const [planned, setPlanned] = useState<Lift[]>([])
  const [similarLinks, setSimilarLinks] = useState<SimilarDayLinks>(defaultSimilarDayLinks)
  const [hydrated, setHydrated] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [voiceBusy, setVoiceBusy] = useState(false)
  const [toast, setToast] = useState<{ kind: ToastKind; message: string } | null>(null)
  const [addTarget, setAddTarget] = useState<AddTarget | null>(null)

  const load = useCallback(async () => {
    if (!userId) return
    try {
      const [loadedSets, planRows] = await Promise.all([
        loadSets(userId, day),
        loadWeekdayLifts(userId, weekdayFromDay(day)),
      ])
      setRows(loadedSets)
      setPlanned(planRows)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load lifts')
    } finally {
      setHydrated(true)
    }
  }, [userId, day])

  useFocusEffect(
    useCallback(() => {
      setSimilarLinks(loadSimilarDayLinks())
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

  const cards = liftCardsForDay(rows, planned)
  const recording = recorderState.isRecording

  return (
    <View style={{ flex: 1 }}>
      <Screen
        header={
          <>
            <TabChrome
              icon={Dumbbell}
              title="Lifts"
              featuresTab="lifts"
              featuresTitle="Lifts features"
              trailing={
                <>
                  <DayControls day={day} onChange={setDay} similarLinks={similarLinks} />
                  <ProfileAvatarButton />
                </>
              }
            />
            <View style={screen.card}>
              <View style={screen.iconActionRow}>
                <Pressable
                  accessibilityLabel="Add a set"
                  accessibilityRole="button"
                  onPress={() => router.push({ pathname: '/add-set', params: { day } })}
                  style={({ pressed }) => [screen.iconActionButton, pressed && screen.rowPressed]}
                >
                  <Plus color={ACTION_ICON} size={22} strokeWidth={2.25} />
                </Pressable>
                <Pressable
                  accessibilityLabel="Week plan"
                  accessibilityRole="button"
                  onPress={() =>
                    router.push({
                      pathname: '/weekday-lifts',
                      params: { day, weekday: String(weekdayFromDay(day)) },
                    })
                  }
                  style={({ pressed }) => [screen.iconActionButton, pressed && screen.rowPressed]}
                >
                  <CalendarDays color={ACTION_ICON} size={20} strokeWidth={2.25} />
                </Pressable>
                <Pressable
                  accessibilityLabel="View catalogue"
                  accessibilityRole="button"
                  onPress={() => router.push('/lift-catalog')}
                  style={({ pressed }) => [screen.iconActionButton, pressed && screen.rowPressed]}
                >
                  <BookOpen color={ACTION_ICON} size={20} strokeWidth={2.25} />
                </Pressable>
                <Pressable
                  accessibilityLabel={recording ? 'Stop recording and add set' : 'Speak a set'}
                  accessibilityRole="button"
                  disabled={voiceBusy}
                  onPress={() => void toggleVoice()}
                  style={({ pressed }) => [
                    screen.iconActionButton,
                    recording && screen.micButtonActive,
                    (pressed || voiceBusy) && screen.buttonDisabled,
                  ]}
                >
                  <Mic color={recording ? colors.accentText : ACTION_ICON} size={20} strokeWidth={2.25} />
                </Pressable>
              </View>
            </View>
          </>
        }
      >
        {error ? <Text style={screen.error}>{error}</Text> : null}
        {!hydrated ? (
          <LoadingBlock label="Loading lifts" />
        ) : (
          cards.map(({ lift, rows: liftRows }) => (
            <View key={lift.id} style={screen.card}>
              <View style={[screen.row, screen.rowFirst]}>
                <Text style={screen.muted}>{lift.name}</Text>
                <Pressable
                  accessibilityLabel={`Add set for ${lift.name}`}
                  accessibilityRole="button"
                  hitSlop={8}
                  onPress={() =>
                    setAddTarget({
                      liftId: lift.id,
                      liftName: lift.name,
                      initialAttempt: nextSetAttempt(liftRows.map((row) => row.attempt)),
                    })
                  }
                >
                  <Plus color={colors.accent} size={22} strokeWidth={2.25} />
                </Pressable>
              </View>
              {liftRows.map((row) => (
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
          ))
        )}
      </Screen>
      {addTarget ? (
        <AddSetModal
          key={`${addTarget.liftId}-${addTarget.initialAttempt}-${day}`}
          visible
          liftId={addTarget.liftId}
          liftName={addTarget.liftName}
          day={day}
          initialAttempt={addTarget.initialAttempt}
          onCancel={() => setAddTarget(null)}
          onSaved={() => {
            setAddTarget(null)
            setToast({ kind: 'success', message: 'Set added' })
            void load()
          }}
        />
      ) : null}
      <Toast
        visible={toast !== null}
        kind={toast?.kind ?? 'success'}
        message={toast?.message ?? ''}
        durationMs={toast?.kind === 'error' ? 5600 : 2800}
        onHide={() => setToast(null)}
      />
      <BusyOverlay visible={voiceBusy} label="Adding set…" />
    </View>
  )
}
