import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio'
import { useFocusEffect, useRouter } from 'expo-router'
import { Mic, Pencil, Repeat } from 'lucide-react-native'
import { useCallback, useMemo, useRef, useState } from 'react'
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native'
import { useAuth } from '../../auth/AuthProvider'
import { BusyOverlay, LoadingBlock } from '../../components/BrandLoader'
import { DayControls } from '../../components/DayControls'
import { ProfileAvatarButton } from '../../components/ProfileAvatarButton'
import { HabitProgressFill } from '../../components/HabitProgressFill'
import { HabitSectionHeader } from '../../components/HabitSectionHeader'
import { HabitSwipeRow } from '../../components/HabitSwipeRow'
import { Screen } from '../../components/Screen'
import { TabChrome } from '../../components/TabChrome'
import { Toast, type ToastKind } from '../../components/Toast'
import {
  bumpHabitDayCount,
  completeHabitsFromVoice,
  loadHabitDayCounts,
  loadHabitSections,
  loadHabits,
  type Habit,
  type HabitDayCount,
  type HabitSection,
} from '../../lib/gym'
import { habitSectionProgress } from '../../lib/habitProgress'
import { syncHabitReminderNotifications } from '../../lib/habitReminderNotifications'
import {
  isHabitReminderMutedOnDay,
  loadHabitReminderMuteByDay,
  pruneHabitReminderMutesBefore,
  saveHabitReminderMuteByDay,
  setHabitReminderMutedOnDay,
  type HabitReminderMuteByDay,
} from '../../lib/habitReminderMute'
import { formatHabitCompletedAt } from '../../lib/habitReminders'
import { applyHabitDayCountDelta, habitSectionCardsForDay } from '../../lib/habitSchedule'
import { localDate } from '../../lib/localDate'
import { syncNutrientRemindersForUser } from '../../lib/nutrientReminderSync'
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
  const [sections, setSections] = useState<HabitSection[]>([])
  const [counts, setCounts] = useState<HabitDayCount[]>([])
  const countsRef = useRef<HabitDayCount[]>([])
  const replaceCounts = useCallback((next: HabitDayCount[]) => {
    countsRef.current = next
    setCounts(next)
  }, [])
  const [hydrated, setHydrated] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [voiceBusy, setVoiceBusy] = useState(false)
  const [toast, setToast] = useState<{ kind: ToastKind; message: string } | null>(null)
  const [reminderMutes, setReminderMutes] = useState<HabitReminderMuteByDay>(() =>
    pruneHabitReminderMutesBefore(loadHabitReminderMuteByDay(), localDate()),
  )

  const load = useCallback(async () => {
    if (!userId) return
    try {
      const [nextHabits, nextSections, nextCounts] = await Promise.all([
        loadHabits(userId),
        loadHabitSections(userId),
        loadHabitDayCounts(userId, day),
      ])
      setHabits(nextHabits)
      setSections(nextSections)
      replaceCounts(nextCounts)
      const mutes = pruneHabitReminderMutesBefore(loadHabitReminderMuteByDay(), localDate())
      setReminderMutes(mutes)
      saveHabitReminderMuteByDay(mutes)
      setError(null)
      void syncHabitReminderNotifications({ habits: nextHabits, counts: nextCounts })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load habits')
    } finally {
      setHydrated(true)
    }
  }, [userId, day, replaceCounts])

  function toggleReminderMuteForDay(habitId: string) {
    const next = setHabitReminderMutedOnDay(
      reminderMutes,
      habitId,
      day,
      !isHabitReminderMutedOnDay(reminderMutes, habitId, day),
    )
    setReminderMutes(next)
    saveHabitReminderMuteByDay(next)
    void syncHabitReminderNotifications({ habits, counts: countsRef.current })
  }

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
    const habit = habits.find((row) => row.id === habitId)
    if (!habit) return

    // Optimistic UI first (posts reactions pattern): patch counts, then DB, revert on failure.
    const previous = countsRef.current
    const optimistic = applyHabitDayCountDelta({
      habit,
      counts: previous,
      day,
      delta,
    })
    replaceCounts(optimistic)
    void syncHabitReminderNotifications({ habits, counts: optimistic })

    try {
      const result = await bumpHabitDayCount({ habitId, day, delta })
      if (result.foodLogError) {
        setToast({
          kind: 'error',
          message: `Habit updated, but food was not logged: ${result.foodLogError}`,
        })
      } else if (userId && (result.foodLogged || delta < 0)) {
        // Food link +1 logs intake; −1 may delete it — either way refresh nutrient nags.
        void syncNutrientRemindersForUser(userId)
      }
    } catch (err) {
      if (countsRef.current === optimistic) {
        replaceCounts(previous)
        void syncHabitReminderNotifications({ habits, counts: previous })
      } else {
        // A later swipe already moved state; resync from the server.
        await load()
      }
      setToast({
        kind: 'error',
        message: err instanceof Error ? err.message : 'Could not update habit',
      })
    }
  }

  const cards = habitSectionCardsForDay(habits, sections, counts, day)
  const dayParts = useMemo(
    () => cards.flatMap((card) => card.rows.map((row) => ({ done: row.done, target: row.target }))),
    [cards],
  )
  const dayProgress = habitSectionProgress(dayParts)
  const recording = recorderState.isRecording
  const noHabitsDefined = habits.length === 0
  const nothingDue = !noHabitsDefined && cards.length === 0

  return (
    <View style={{ flex: 1 }}>
      <Screen
        header={
          <>
            <TabChrome
              icon={Repeat}
              title="Habits"
              featuresTab="habits"
              featuresTitle="Habits features"
              trailing={
                <>
                  <DayControls day={day} onChange={setDay} />
                  <ProfileAvatarButton />
                </>
              }
            />
            <View
              style={[
                screen.card,
                styles.actionCard,
                {
                  borderLeftWidth: dayProgress.ratio > 0 ? 3 : 0,
                  borderLeftColor:
                    dayProgress.ratio > 0 ? colors.habitCompleteBorder : 'transparent',
                },
              ]}
            >
              <HabitProgressFill parts={dayParts} />
              <View style={[screen.iconActionRow, styles.actionRow]}>
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
                {dayProgress.target > 0 ? (
                  <Text
                    style={[
                      screen.rowMeta,
                      styles.dayTotal,
                      (dayProgress.complete || dayProgress.ratio > 0) && {
                        color: colors.habitCompleteText,
                        fontWeight: '700',
                      },
                    ]}
                  >
                    {dayProgress.done}/{dayProgress.target}
                  </Text>
                ) : null}
              </View>
            </View>
          </>
        }
      >
        {error ? <Text style={screen.error}>{error}</Text> : null}
        {!hydrated ? (
          <LoadingBlock label="Loading habits" />
        ) : noHabitsDefined ? (
          <View style={screen.card}>
            <View style={[screen.row, screen.rowFirst]}>
              <Text style={screen.muted}>No habits yet. Tap Edit to add some.</Text>
            </View>
          </View>
        ) : nothingDue ? (
          <View style={screen.card}>
            <View style={[screen.row, screen.rowFirst]}>
              <Text style={screen.muted}>Nothing due this day.</Text>
            </View>
          </View>
        ) : (
          cards.map((card) => (
            <View key={card.key} style={screen.card}>
              <HabitSectionHeader
                title={card.title}
                parts={card.rows.map((row) => ({ done: row.done, target: row.target }))}
              />
              {card.rows.map((row) => (
                <HabitSwipeRow
                  key={row.habit.id}
                  name={row.habit.name}
                  done={row.done}
                  target={row.target}
                  complete={row.complete}
                  completedLabel={formatHabitCompletedAt(row.completed_at)}
                  reminderMute={{
                    muted: isHabitReminderMutedOnDay(reminderMutes, row.habit.id, day),
                    remindersConfigured: row.habit.remind_enabled,
                    onToggle: () => toggleReminderMuteForDay(row.habit.id),
                  }}
                  onIncrement={() => void bump(row.habit.id, 1)}
                  onDecrement={() => void bump(row.habit.id, -1)}
                />
              ))}
            </View>
          ))
        )}
      </Screen>
      <Toast
        visible={toast !== null}
        kind={toast?.kind ?? 'success'}
        message={toast?.message ?? ''}
        durationMs={toast?.kind === 'error' ? 5600 : 2800}
        onHide={() => setToast(null)}
      />
      <BusyOverlay visible={voiceBusy} label="Updating habits…" />
    </View>
  )
}

const styles = StyleSheet.create({
  actionCard: {
    position: 'relative',
  },
  actionRow: {
    zIndex: 1,
    justifyContent: 'flex-start',
  },
  dayTotal: {
    marginLeft: 'auto',
  },
})
