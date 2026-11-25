import { useFocusEffect, useRouter } from 'expo-router'
import { useCallback, useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { useAuth } from '../auth/AuthProvider'
import { ConfirmModal } from '../components/ConfirmModal'
import { Screen } from '../components/Screen'
import { Toast, type ToastKind } from '../components/Toast'
import { TrashButton } from '../components/TrashButton'
import {
  archiveHabit,
  loadHabits,
  reorderHabits,
  type Habit,
} from '../lib/gym'
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
  if (habit.food?.name && habit.food_amount != null) {
    return `${base} · logs ${habit.food.name}`
  }
  return base
}

export default function ManageHabitsScreen() {
  const screen = useScreenStyles()
  const router = useRouter()
  const { session } = useAuth()
  const userId = session?.user.id
  const [habits, setHabits] = useState<Habit[]>([])
  const [error, setError] = useState<string | null>(null)
  const [pendingArchive, setPendingArchive] = useState<Habit | null>(null)
  const [toast, setToast] = useState<{ kind: ToastKind; message: string } | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    if (!userId) return
    try {
      setHabits(await loadHabits(userId))
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

  async function confirmArchive() {
    const habit = pendingArchive
    setPendingArchive(null)
    if (!habit) return
    try {
      await archiveHabit(habit.id)
      await load()
      setToast({ kind: 'success', message: 'Archived' })
    } catch (err) {
      setToast({
        kind: 'error',
        message: err instanceof Error ? err.message : 'Could not archive habit',
      })
    }
  }

  async function move(index: number, direction: -1 | 1) {
    const nextIndex = index + direction
    if (nextIndex < 0 || nextIndex >= habits.length || busy) return
    const ordered = habits.slice()
    const [item] = ordered.splice(index, 1)
    ordered.splice(nextIndex, 0, item)
    setHabits(ordered)
    setBusy(true)
    try {
      await reorderHabits(ordered.map((habit) => habit.id))
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
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/edit-habit')}
            style={screen.save}
          >
            <Text style={screen.buttonText}>Add Habit</Text>
          </Pressable>
        }
      >
        <Text style={screen.title}>Habits</Text>
        <Text style={screen.muted}>Create, reorder, and archive your personal habits.</Text>
        {error ? <Text style={screen.error}>{error}</Text> : null}
        <View style={screen.card}>
          {habits.length > 0 ? (
            habits.map((habit, index) => (
              <View key={habit.id} style={[screen.row, index === 0 && screen.rowFirst]}>
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
                    onPress={() => void move(index, -1)}
                    style={({ pressed }) => [
                      screen.iconActionButton,
                      (pressed || index === 0) && screen.buttonDisabled,
                    ]}
                  >
                    <Text style={screen.rowMeta}>↑</Text>
                  </Pressable>
                  <Pressable
                    accessibilityLabel={`Move ${habit.name} down`}
                    disabled={index === habits.length - 1 || busy}
                    onPress={() => void move(index, 1)}
                    style={({ pressed }) => [
                      screen.iconActionButton,
                      (pressed || index === habits.length - 1) && screen.buttonDisabled,
                    ]}
                  >
                    <Text style={screen.rowMeta}>↓</Text>
                  </Pressable>
                  <TrashButton onPress={() => setPendingArchive(habit)} />
                </View>
              </View>
            ))
          ) : (
            <View style={[screen.row, screen.rowFirst]}>
              <Text style={screen.muted}>No habits yet.</Text>
            </View>
          )}
        </View>
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
