import { useFocusEffect, useRouter } from 'expo-router'
import { useCallback, useMemo, useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { useAuth } from '../auth/AuthProvider'
import { ConfirmModal } from '../components/ConfirmModal'
import { Screen } from '../components/Screen'
import { Toast, type ToastKind } from '../components/Toast'
import { TrashButton } from '../components/TrashButton'
import {
  archiveHabit,
  loadHabitDayCounts,
  loadHabitSections,
  loadHabits,
  reorderHabits,
  type Habit,
  type HabitSection,
} from '../lib/gym'
import { syncHabitReminderNotifications } from '../lib/habitReminderNotifications'
import { formatReminderTime } from '../lib/habitReminders'
import { habitManageGroups } from '../lib/habitSchedule'
import { localDate } from '../lib/localDate'
import { useScreenStyles } from '../theme/ThemeProvider'

function scheduleLabel(habit: Habit): string {
  const base =
    habit.recurrence === 'per_week'
      ? `${habit.frequency}× / week`
      : `${habit.frequency}× · ${
          habit.weekdays.length === 7
            ? 'every day'
            : `${habit.weekdays.length} weekday${habit.weekdays.length === 1 ? '' : 's'}`
        }`
  const parts = [base]
  if (habit.food?.name && habit.food_amount != null) {
    parts.push(`logs ${habit.food.name}`)
  }
  if (habit.remind_enabled && habit.remind_first_time) {
    const first = formatReminderTime(habit.remind_first_time)
    const every =
      habit.remind_every_minutes != null ? ` then every ${habit.remind_every_minutes}m` : ''
    parts.push(`remind ${first}${every}`)
  }
  return parts.join(' · ')
}

export default function ManageHabitsScreen() {
  const screen = useScreenStyles()
  const router = useRouter()
  const { session } = useAuth()
  const userId = session?.user.id
  const [habits, setHabits] = useState<Habit[]>([])
  const [sections, setSections] = useState<HabitSection[]>([])
  const [error, setError] = useState<string | null>(null)
  const [pendingArchive, setPendingArchive] = useState<Habit | null>(null)
  const [toast, setToast] = useState<{ kind: ToastKind; message: string } | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    if (!userId) return
    try {
      const [nextHabits, nextSections] = await Promise.all([
        loadHabits(userId),
        loadHabitSections(userId),
      ])
      setHabits(nextHabits)
      setSections(nextSections)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load habits')
    }
  }, [userId])

  useFocusEffect(
    useCallback(() => {
      void load()
    }, [load]),
  )

  const groups = useMemo(() => habitManageGroups(habits, sections), [habits, sections])

  async function confirmArchive() {
    const habit = pendingArchive
    setPendingArchive(null)
    if (!habit) return
    try {
      await archiveHabit(habit.id)
      await load()
      if (userId) {
        try {
          const [nextHabits, nextCounts] = await Promise.all([
            loadHabits(userId),
            loadHabitDayCounts(userId, localDate()),
          ])
          await syncHabitReminderNotifications({ habits: nextHabits, counts: nextCounts })
        } catch {
          // Archive succeeded; reminder cancel is best-effort.
        }
      }
      setToast({ kind: 'success', message: 'Archived' })
    } catch (err) {
      setToast({
        kind: 'error',
        message: err instanceof Error ? err.message : 'Could not archive habit',
      })
    }
  }

  /** Reorder within one section only; change section from Edit Habit. */
  async function move(groupKey: string, habitId: string, direction: -1 | 1) {
    const group = groups.find((row) => row.key === groupKey)
    if (!group || busy) return
    const index = group.habits.findIndex((habit) => habit.id === habitId)
    const nextIndex = index + direction
    if (index < 0 || nextIndex < 0 || nextIndex >= group.habits.length) return

    const groupOrdered = group.habits.slice()
    const [item] = groupOrdered.splice(index, 1)
    groupOrdered.splice(nextIndex, 0, item)

    const orderedIds = groups.flatMap((row) =>
      row.key === groupKey ? groupOrdered.map((habit) => habit.id) : row.habits.map((habit) => habit.id),
    )
    setHabits(
      orderedIds
        .map((id) => habits.find((habit) => habit.id === id))
        .filter((habit): habit is Habit => Boolean(habit)),
    )
    setBusy(true)
    try {
      await reorderHabits(orderedIds)
      await load()
    } catch (err) {
      setToast({
        kind: 'error',
        message: err instanceof Error ? err.message : 'Could not reorder',
      })
      await load()
    } finally {
      setBusy(false)
    }
  }

  return (
    <View style={{ flex: 1 }}>
      <Screen
        footer={
          <View style={{ gap: 10 }}>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push('/manage-habit-sections')}
              style={screen.save}
            >
              <Text style={screen.buttonText}>Manage Sections</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push('/edit-habit')}
              style={screen.save}
            >
              <Text style={screen.buttonText}>Add Habit</Text>
            </Pressable>
          </View>
        }
      >
        <Text style={screen.title}>Habits</Text>
        <Text style={screen.muted}>
          Create, reorder, and archive habits. Group them under sections like lifts.
        </Text>
        {error ? <Text style={screen.error}>{error}</Text> : null}
        {habits.length === 0 && sections.length === 0 ? (
          <View style={screen.card}>
            <View style={[screen.row, screen.rowFirst]}>
              <Text style={screen.muted}>No habits yet.</Text>
            </View>
          </View>
        ) : (
          groups.map((group) => (
            <View key={group.key} style={screen.card}>
              <View style={[screen.row, screen.rowFirst]}>
                <Text style={screen.muted}>{group.title}</Text>
              </View>
              {group.habits.length > 0 ? (
                group.habits.map((habit, index) => (
                  <View key={habit.id} style={screen.row}>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() =>
                        router.push({ pathname: '/edit-habit', params: { id: habit.id } })
                      }
                      style={screen.rowMain}
                    >
                      <Text style={screen.rowTitle}>{habit.name}</Text>
                      <Text style={screen.muted}>{scheduleLabel(habit)}</Text>
                    </Pressable>
                    <View style={screen.choiceTrail}>
                      <Pressable
                        accessibilityLabel={`Move ${habit.name} up`}
                        disabled={index === 0 || busy}
                        onPress={() => void move(group.key, habit.id, -1)}
                        style={({ pressed }) => [
                          screen.iconActionButton,
                          (pressed || index === 0) && screen.buttonDisabled,
                        ]}
                      >
                        <Text style={screen.rowMeta}>↑</Text>
                      </Pressable>
                      <Pressable
                        accessibilityLabel={`Move ${habit.name} down`}
                        disabled={index === group.habits.length - 1 || busy}
                        onPress={() => void move(group.key, habit.id, 1)}
                        style={({ pressed }) => [
                          screen.iconActionButton,
                          (pressed || index === group.habits.length - 1) && screen.buttonDisabled,
                        ]}
                      >
                        <Text style={screen.rowMeta}>↓</Text>
                      </Pressable>
                      <TrashButton onPress={() => setPendingArchive(habit)} />
                    </View>
                  </View>
                ))
              ) : (
                <View style={screen.row}>
                  <Text style={screen.muted}>No habits in this section.</Text>
                </View>
              )}
            </View>
          ))
        )}
      </Screen>
      <ConfirmModal
        visible={pendingArchive !== null}
        title="Archive habit?"
        message={
          pendingArchive
            ? `Hide ${pendingArchive.name} from your list? Past day counts stay.`
            : ''
        }
        onCancel={() => setPendingArchive(null)}
        onConfirm={() => void confirmArchive()}
      />
      <Toast
        visible={toast !== null}
        kind={toast?.kind ?? 'success'}
        message={toast?.message ?? ''}
        onHide={() => setToast(null)}
      />
    </View>
  )
}
