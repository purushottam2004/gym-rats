import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio'
import * as ImagePicker from 'expo-image-picker'
import { useFocusEffect, useRouter } from 'expo-router'
import { BookOpen, Camera, Mic, Plus, Target, Utensils } from 'lucide-react-native'
import { useCallback, useMemo, useState } from 'react'
import { Platform, Pressable, Text, View } from 'react-native'
import { useAuth } from '../../auth/AuthProvider'
import { BusyOverlay, LoadingBlock } from '../../components/BrandLoader'
import { DayControls } from '../../components/DayControls'
import { TabFeaturesButton } from '../../components/TabFeaturesButton'
import { DeleteConfirmButton } from '../../components/DeleteConfirmButton'
import { InfoButton } from '../../components/InfoButton'
import { InfoListModal, type InfoListRow } from '../../components/InfoListModal'
import { NutrientProgressRow } from '../../components/NutrientProgressRow'
import { PhotoConfirmModal } from '../../components/PhotoConfirmModal'
import { Screen } from '../../components/Screen'
import { TabChrome } from '../../components/TabChrome'
import { Toast, type ToastKind } from '../../components/Toast'
import { useScreenStyles, useTheme } from '../../theme/ThemeProvider'
import {
  deleteIntake,
  estimateFoodFromPhoto,
  loadIntakes,
  loadNutrientGoals,
  logIntakeFromVoice,
  measureLabel,
  type Intake,
  type NutrientGoal,
} from '../../lib/gym'
import { localDate } from '../../lib/localDate'
import { syncNutrientRemindersForUser } from '../../lib/nutrientReminderSync'
import {
  foodBasisLabel,
  foodTypeNutrition,
  formatNutrientTotal,
  nutrientContributions,
  nutritionProgressLines,
  nutritionSummaryTitle,
  summarizeNutrition,
} from '../../lib/nutrition'
import { formatEstimatedAmount, setOtherFoodDraft } from '../../lib/otherFoodDraft'

type InfoModalState = {
  title: string
  subtitle?: string
  rows: InfoListRow[]
  emptyMessage: string
}

function recordingMimeType(): string {
  return Platform.OS === 'web' ? 'audio/webm' : 'audio/mp4'
}

export default function DietScreen() {
  const screen = useScreenStyles()
  const { colors } = useTheme()
  const ACTION_ICON = colors.accent
  const { session } = useAuth()
  const router = useRouter()
  const userId = session?.user.id
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY)
  const recorderState = useAudioRecorderState(audioRecorder)
  const [day, setDay] = useState(localDate)
  const [rows, setRows] = useState<Intake[]>([])
  const [goals, setGoals] = useState<NutrientGoal[]>([])
  const [hydrated, setHydrated] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [infoModal, setInfoModal] = useState<InfoModalState | null>(null)
  const [voiceBusy, setVoiceBusy] = useState(false)
  const [photoBusy, setPhotoBusy] = useState(false)
  const [pendingPhoto, setPendingPhoto] = useState<{ uri: string; mimeType?: string } | null>(
    null,
  )
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
      void syncNutrientRemindersForUser(userId, day)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load diet')
    } finally {
      setHydrated(true)
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
      subtitle: foodBasisLabel(row.food.measure, row.food.basis, {
        isOther: row.food.is_other,
      }),
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

  async function captureFoodPhoto() {
    if (photoBusy || voiceBusy) return
    const permission = await ImagePicker.requestCameraPermissionsAsync()
    if (!permission.granted) {
      setToast({ kind: 'error', message: 'Camera permission is required' })
      return
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.55,
      exif: false,
    })
    if (result.canceled || !result.assets[0]?.uri) return
    const asset = result.assets[0]
    setPendingPhoto({
      uri: asset.uri,
      mimeType: asset.mimeType ?? undefined,
    })
  }

  async function continueWithPhoto() {
    const photo = pendingPhoto
    if (!photo || photoBusy) return
    setPendingPhoto(null)
    setPhotoBusy(true)
    try {
      const result = await estimateFoodFromPhoto({
        imageUri: photo.uri,
        mimeType: photo.mimeType,
      })
      if (!result.ok) {
        setToast({ kind: 'error', message: result.error })
        return
      }
      const amounts: Record<string, string> = {}
      for (const row of result.food.nutrients) {
        const formatted = formatEstimatedAmount(row.amount)
        if (formatted) amounts[row.nutrient_id] = formatted
      }
      if (Object.keys(amounts).length === 0) {
        setToast({ kind: 'error', message: 'No nutrient amounts estimated' })
        return
      }
      setOtherFoodDraft({ name: result.food.name, amounts })
      router.push({ pathname: '/log-other', params: { day } })
    } catch (err) {
      setToast({
        kind: 'error',
        message: err instanceof Error && err.message.trim() ? err.message.trim() : 'Could not estimate food',
      })
    } finally {
      setPhotoBusy(false)
    }
  }

  async function toggleVoice() {
    if (voiceBusy || photoBusy) return

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
              trailing={
                <>
                  <DayControls day={day} onChange={setDay} />
                  <TabFeaturesButton tab="diet" title="Diet features" />
                </>
              }
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
                  accessibilityLabel="Photograph food"
                  accessibilityRole="button"
                  disabled={photoBusy || voiceBusy}
                  onPress={() => void captureFoodPhoto()}
                  style={({ pressed }) => [
                    screen.iconActionButton,
                    (pressed || photoBusy || voiceBusy) && screen.buttonDisabled,
                  ]}
                >
                  <Camera color={ACTION_ICON} size={20} strokeWidth={2.25} />
                </Pressable>
                <Pressable
                  accessibilityLabel={recording ? 'Stop recording and add food' : 'Speak a food'}
                  accessibilityRole="button"
                  disabled={voiceBusy || photoBusy}
                  onPress={() => void toggleVoice()}
                  style={({ pressed }) => [
                    screen.iconActionButton,
                    recording && screen.micButtonActive,
                    (pressed || voiceBusy || photoBusy) && screen.buttonDisabled,
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
        {!hydrated ? <LoadingBlock label="Loading diet" /> : null}
        {hydrated && rows.length > 0 ? (
          <View style={screen.card}>
            {rows.map((row, index) => (
              <View key={row.id} style={[screen.row, index === 0 && screen.rowFirst]}>
                <View style={screen.rowMain}>
                  <Text style={screen.rowTitle}>{row.food.name}</Text>
                </View>
                <View style={screen.choiceTrail}>
                  {row.food.is_other ? (
                    <Text style={screen.rowMeta}>Other</Text>
                  ) : (
                    <Text style={screen.rowMeta}>
                      {row.amount} {measureLabel(row.food.measure)}
                    </Text>
                  )}
                  <DeleteConfirmButton
                    title="Delete food?"
                    message={
                      row.source_habit_name
                        ? `Remove ${row.food.name} from this day's log?\n\n${row.source_habit_name} habit will also be reduced by 1`
                        : `Remove ${row.food.name} from this day's log?`
                    }
                    onConfirm={() => void deleteIntake(row.id).then(load)}
                  />
                  <InfoButton onPress={() => showFoodInfo(row)} />
                </View>
              </View>
            ))}
          </View>
        ) : null}
        {hydrated ? (
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
        ) : null}
      </Screen>
      <InfoListModal
        visible={infoModal !== null}
        title={infoModal?.title ?? ''}
        subtitle={infoModal?.subtitle}
        rows={infoModal?.rows ?? []}
        emptyMessage={infoModal?.emptyMessage ?? ''}
        onClose={() => setInfoModal(null)}
      />
      <PhotoConfirmModal
        visible={pendingPhoto !== null}
        imageUri={pendingPhoto?.uri ?? null}
        onCancel={() => setPendingPhoto(null)}
        onRetake={() => {
          setPendingPhoto(null)
          void captureFoodPhoto()
        }}
        onContinue={() => void continueWithPhoto()}
      />
      <Toast
        visible={toast !== null}
        kind={toast?.kind ?? 'success'}
        message={toast?.message ?? ''}
        durationMs={toast?.kind === 'error' ? 5600 : 2800}
        onHide={() => setToast(null)}
      />
      <BusyOverlay
        visible={voiceBusy || photoBusy}
        label={photoBusy ? 'Estimating food…' : 'Adding food…'}
      />
    </View>
  )
}
