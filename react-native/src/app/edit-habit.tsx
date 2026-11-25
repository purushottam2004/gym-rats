import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router'
import { useCallback, useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { useAuth } from '../auth/AuthProvider'
import { AppTextInput } from '../components/AppTextInput'
import { Screen } from '../components/Screen'
import { Toast, type ToastKind } from '../components/Toast'
import {
  createHabit,
  loadHabits,
  updateHabit,
  type HabitRecurrence,
} from '../lib/gym'
import { WEEKDAY_LABELS, type Weekday } from '../lib/weekday'
import { useScreenStyles, useTheme } from '../theme/ThemeProvider'

const ALL_DAYS: Weekday[] = [0, 1, 2, 3, 4, 5, 6]

export default function EditHabitScreen() {
  const screen = useScreenStyles()
  const { colors } = useTheme()
  const router = useRouter()
  const { session } = useAuth()
  const userId = session?.user.id
  const { id } = useLocalSearchParams<{ id?: string }>()
  const editing = Boolean(id)

  const [name, setName] = useState('')
  const [recurrence, setRecurrence] = useState<HabitRecurrence>('per_day')
  const [frequency, setFrequency] = useState('1')
  const [weekdays, setWeekdays] = useState<Weekday[]>(ALL_DAYS)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<{ kind: ToastKind; message: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [loaded, setLoaded] = useState(!editing)

  const load = useCallback(async () => {
    if (!editing || !id || !userId) {
      setLoaded(true)
      return
    }
    try {
      const habits = await loadHabits(userId, { includeArchived: true })
      const habit = habits.find((row) => row.id === id)
      if (!habit || !habit.active) {
        setError('Habit not found')
        setLoaded(true)
        return
      }
      setName(habit.name)
      setRecurrence(habit.recurrence)
      setFrequency(String(habit.frequency))
      setWeekdays(habit.weekdays.slice() as Weekday[])
      setError(null)
      setLoaded(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load habit')
      setLoaded(true)
    }
  }, [editing, id, userId])

  useFocusEffect(
    useCallback(() => {
      void load()
    }, [load]),
  )

  function toggleWeekday(day: Weekday) {
    setWeekdays((prev) => {
      if (prev.includes(day)) {
        if (prev.length === 1) return prev
        return prev.filter((value) => value !== day)
      }
      return [...prev, day].sort((a, b) => a - b) as Weekday[]
    })
  }

  async function save() {
    const trimmed = name.trim()
    const freq = Number(frequency)
    if (!trimmed) {
      setToast({ kind: 'error', message: 'Name is required' })
      return
    }
    if (!Number.isInteger(freq) || freq < 1) {
      setToast({ kind: 'error', message: 'Frequency must be a whole number, 1 or more' })
      return
    }
    if (recurrence === 'per_day' && weekdays.length === 0) {
      setToast({ kind: 'error', message: 'Pick at least one weekday' })
      return
    }
    setBusy(true)
    try {
      if (editing && id) {
        await updateHabit({
          id,
          name: trimmed,
          recurrence,
          frequency: freq,
          weekdays,
        })
      } else {
        await createHabit({
          name: trimmed,
          recurrence,
          frequency: freq,
          weekdays,
        })
      }
      router.back()
    } catch (err) {
      setToast({
        kind: 'error',
        message: err instanceof Error ? err.message : 'Could not save habit',
      })
    } finally {
      setBusy(false)
    }
  }

  if (!loaded) {
    return (
      <Screen>
        <Text style={screen.muted}>Loading…</Text>
      </Screen>
    )
  }

  return (
    <View style={{ flex: 1 }}>
      <Screen
        footer={
          <Pressable
            accessibilityRole="button"
            disabled={busy}
            onPress={() => void save()}
            style={[screen.save, busy && screen.buttonDisabled]}
          >
            <Text style={screen.buttonText}>{editing ? 'Save' : 'Create'}</Text>
          </Pressable>
        }
      >
        <Text style={screen.title}>{editing ? 'Edit Habit' : 'New Habit'}</Text>
        {error ? <Text style={screen.error}>{error}</Text> : null}

        <Text style={screen.label}>Name</Text>
        <AppTextInput
          autoCapitalize="words"
          onChangeText={setName}
          placeholder="Morning Brush"
          style={screen.input}
          value={name}
        />

        <Text style={screen.label}>Recurrence</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          {(
            [
              { value: 'per_day' as const, label: 'Per day' },
              { value: 'per_week' as const, label: 'Per week' },
            ] as const
          ).map((option) => {
            const selected = recurrence === option.value
            return (
              <Pressable
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                key={option.value}
                onPress={() => setRecurrence(option.value)}
                style={({ pressed }) => [
                  {
                    paddingHorizontal: 16,
                    paddingVertical: 10,
                    borderRadius: 999,
                    borderWidth: 1,
                    borderColor: selected ? colors.accentSoftBorder : colors.border,
                    backgroundColor: selected ? colors.accentSoft : colors.surface,
                  },
                  pressed && { opacity: 0.85 },
                ]}
              >
                <Text
                  style={{
                    fontSize: 15,
                    fontWeight: '600',
                    color: selected ? colors.accentText : colors.text,
                  }}
                >
                  {option.label}
                </Text>
              </Pressable>
            )
          })}
        </View>

        <Text style={screen.label}>
          {recurrence === 'per_week' ? 'Times per week' : 'Times per due day'}
        </Text>
        <AppTextInput
          keyboardType="number-pad"
          onChangeText={setFrequency}
          style={screen.input}
          value={frequency}
        />

        {recurrence === 'per_day' ? (
          <>
            <Text style={screen.label}>Weekdays</Text>
            <View style={[screen.setNumberRow, { flexWrap: 'wrap' }]}>
              {WEEKDAY_LABELS.map((day) => {
                const selected = weekdays.includes(day.value)
                return (
                  <Pressable
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: selected }}
                    key={day.value}
                    onPress={() => toggleWeekday(day.value)}
                    style={({ pressed }) => [
                      screen.setNumberCircle,
                      selected && screen.setNumberCircleSelected,
                      pressed && !selected && screen.setNumberCirclePressed,
                    ]}
                  >
                    <Text
                      style={[
                        screen.setNumberCircleText,
                        selected && screen.setNumberCircleTextSelected,
                        { fontSize: 12 },
                      ]}
                    >
                      {day.short}
                    </Text>
                  </Pressable>
                )
              })}
            </View>
          </>
        ) : (
          <Text style={screen.muted}>
            Shows every day. Completions any day count toward this week (Mon–Sun).
          </Text>
        )}
      </Screen>
      <Toast
        visible={toast !== null}
        kind={toast?.kind ?? 'success'}
        message={toast?.message ?? ''}
        onHide={() => setToast(null)}
      />
    </View>
  )
}
