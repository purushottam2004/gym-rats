import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio'
import { useFocusEffect, useRouter } from 'expo-router'
import { BookOpen, Mic, Plus, Target, Utensils } from 'lucide-react-native'
import { useCallback, useMemo, useState } from 'react'
import { Platform, Pressable, Text, View } from 'react-native'
import { useAuth } from '../../auth/AuthProvider'
import { DayControls } from '../../components/DayControls'
import { DeleteConfirmButton } from '../../components/DeleteConfirmButton'
import { InfoButton } from '../../components/InfoButton'
import { InfoListModal, type InfoListRow } from '../../components/InfoListModal'
import { NutrientProgressRow } from '../../components/NutrientProgressRow'
import { Screen } from '../../components/Screen'
import { TabChrome } from '../../components/TabChrome'
import { Toast, type ToastKind } from '../../components/Toast'
import { screen } from '../../components/screenStyles'
import {
  deleteIntake,
  loadIntakes,
  loadNutrientGoals,
  logIntakeFromVoice,
  measureLabel,
  type Intake,
  type NutrientGoal,
} from '../../lib/gym'
import { localDate } from '../../lib/localDate'
import {
  foodBasisLabel,
  foodTypeNutrition,
  formatNutrientTotal,
  nutrientContributions,
  nutritionProgressLines,
  nutritionSummaryTitle,
  summarizeNutrition,
} from '../../lib/nutrition'

type InfoModalState = {
  title: string
  subtitle?: string
  rows: InfoListRow[]
  emptyMessage: string
}

const ACTION_ICON = '#c2410c'

function recordingMimeType(): string {
  return Platform.OS === 'web' ? 'audio/webm' : 'audio/mp4'
}

export default function DietScreen() {
  const { session } = useAuth()
  const router = useRouter()
  const userId = session?.user.id
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY)
  const recorderState = useAudioRecorderState(audioRecorder)
  const [day, setDay] = useState(localDate)
  const [rows, setRows] = useState<Intake[]>([])
  const [goals, setGoals] = useState<NutrientGoal[]>([])
  const [error, setError] = useState<string | null>(null)
  const [infoModal, setInfoModal] = useState<InfoModalState | null>(null)
  const [voiceBusy, setVoiceBusy] = useState(false)
  const [toast, setToast] = useState<{ kind: ToastKind; message: string } | null>(null)
  const today = localDate()
  const progress = useMemo(
    () => nutritionProgressLines(summarizeNutrition(rows), goals),
    [rows, goals],
  )

  const load = useCallback(async () => {
    if (!userId) return
    try {
      const [nextRows, nextGoals] = await Promise.all([
        loadIntakes(userId, day),
        loadNutrientGoals(userId),
      ])
      setRows(nextRows)
      setGoals(nextGoals)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load diet')
    }
  }, [userId, day])

  useFocusEffect(
    useCallback(() => {
      void load()
    }, [load]),
  )

  function showFoodInfo(row: Intake) {
    const lines = foodTypeNutrition(row.food)
    setInfoModal({
      title: row.food.name,
      subtitle: foodBasisLabel(row.food.measure, row.food.basis),
      rows: lines.map((line) => ({
        key: line.id,
        label: line.name,
        value: `${formatNutrientTotal(line.total)} ${line.unit}`,
      })),
      emptyMessage: 'No nutrients defined for this food.',
    })
  }

  function showNutrientInfo(nutrientId: string, nutrientName: string, unit: string) {
    const contributions = nutrientContributions(rows, nutrientId)
    setInfoModal({
      title: nutrientName,
      subtitle: 'Contribution by food',
      rows: contributions.map((line) => ({
        key: line.key,
        label: `${line.foodName} · ${line.amount} ${measureLabel(line.measure)}`,
        value: `${formatNutrientTotal(line.total)} ${unit}`,
      })),
      emptyMessage: 'No foods contributed to this nutrient.',
    })
  }

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
        const result = await logIntakeFromVoice({
          day,
          audioUri: uri,
          mimeType: recordingMimeType(),
        })
        if (result.ok) {
          setToast({ kind: 'success', message: 'Food added' })
          await load()
        } else {
          setToast({ kind: 'error', message: result.error })
        }
      } catch (err) {
        const detail =
          err instanceof Error && err.message.trim()
            ? err.message.trim()
            : 'Could not add food from voice'
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

  return (
    <View style={{ flex: 1 }}>
      <Screen
        header={
          <>
            <TabChrome
              icon={Utensils}
              title="Diet"
              trailing={<DayControls day={day} onChange={setDay} />}
            />
            <View style={screen.card}>
              <View style={screen.iconActionRow}>
                <Pressable
                  accessibilityLabel="Add food"
                  accessibilityRole="button"
                  onPress={() => router.push({ pathname: '/add-food', params: { day } })}
                  style={({ pressed }) => [screen.iconActionButton, pressed && screen.rowPressed]}
                >
                  <Plus color={ACTION_ICON} size={22} strokeWidth={2.25} />
                </Pressable>
                <Pressable
                  accessibilityLabel="Nutrient goals"
                  accessibilityRole="button"
                  onPress={() => router.push('/nutrient-goals')}
                  style={({ pressed }) => [screen.iconActionButton, pressed && screen.rowPressed]}
                >
                  <Target color={ACTION_ICON} size={20} strokeWidth={2.25} />
                </Pressable>
                <Pressable
                  accessibilityLabel="View catalog"
                  accessibilityRole="button"
                  onPress={() => router.push('/food-catalog')}
                  style={({ pressed }) => [screen.iconActionButton, pressed && screen.rowPressed]}
                >
                  <BookOpen color={ACTION_ICON} size={20} strokeWidth={2.25} />
                </Pressable>
                <Pressable
                  accessibilityLabel={recording ? 'Stop recording and add food' : 'Speak a food'}
                  accessibilityRole="button"
                  disabled={voiceBusy}
                  onPress={() => void toggleVoice()}
                  style={({ pressed }) => [
                    screen.iconActionButton,
                    recording && screen.micButtonActive,
                    (pressed || voiceBusy) && screen.buttonDisabled,
                  ]}
                >
                  <Mic color={recording ? '#9a3412' : ACTION_ICON} size={20} strokeWidth={2.25} />
                </Pressable>
              </View>
            </View>
          </>
        }
      >
        {error ? <Text style={screen.error}>{error}</Text> : null}
        {rows.length > 0 ? (
          <View style={screen.card}>
            {rows.map((row, index) => (
              <View key={row.id} style={[screen.row, index === 0 && screen.rowFirst]}>
                <View style={screen.rowMain}>
                  <Text style={screen.rowTitle}>{row.food.name}</Text>
                </View>
                <View style={screen.choiceTrail}>
                  <Text style={screen.rowMeta}>
                    {row.amount} {measureLabel(row.food.measure)}
                  </Text>
                  <DeleteConfirmButton
                    title="Delete food?"
                    message={`Remove ${row.food.name} from this day's log?`}
                    onConfirm={() => void deleteIntake(row.id).then(load)}
                  />
                  <InfoButton onPress={() => showFoodInfo(row)} />
                </View>
              </View>
            ))}
          </View>
        ) : null}
        <View style={screen.section}>
          <Text style={screen.sectionTitle}>{nutritionSummaryTitle(day, today)}</Text>
          <View style={screen.card}>
            {progress.length > 0 ? (
              progress.map((line, index) => (
                <NutrientProgressRow
                  key={line.id}
                  first={index === 0}
                  line={line}
                  onInfo={() => showNutrientInfo(line.id, line.name, line.unit)}
                />
              ))
            ) : (
              <View style={[screen.row, screen.rowFirst]}>
                <Text style={screen.muted}>No nutrition logged for this day.</Text>
              </View>
            )}
          </View>
        </View>
      </Screen>
      <InfoListModal
        visible={infoModal !== null}
        title={infoModal?.title ?? ''}
        subtitle={infoModal?.subtitle}
        rows={infoModal?.rows ?? []}
        emptyMessage={infoModal?.emptyMessage ?? ''}
        onClose={() => setInfoModal(null)}
      />
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
