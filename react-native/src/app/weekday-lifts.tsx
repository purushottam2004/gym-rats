import { useFocusEffect, useLocalSearchParams } from 'expo-router'
import { useCallback, useMemo, useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { useAuth } from '../auth/AuthProvider'
import { Screen } from '../components/Screen'
import { Toast, type ToastKind } from '../components/Toast'
import { TrashButton } from '../components/TrashButton'
import { useScreenStyles } from '../theme/ThemeProvider'
import {
  addWeekdayLift,
  loadLifts,
  loadMuscles,
  loadWeekdayLifts,
  removeWeekdayLift,
  type Lift,
  type Muscle,
} from '../lib/gym'
import { liftCatalogGroupsWithLifts } from '../lib/liftCatalog'
import { localDate } from '../lib/localDate'
import {
  defaultSimilarDayLinks,
  loadSimilarDayLinks,
  saveSimilarDayLinks,
  withSimilarDayLink,
  type SimilarDayLinks,
} from '../lib/similarDayJump'
import { weekdayFromDay, WEEKDAY_LABELS, type Weekday } from '../lib/weekday'

function parseWeekday(raw: string | undefined): Weekday {
  const n = Number(raw)
  if (Number.isInteger(n) && n >= 0 && n <= 6) return n as Weekday
  return weekdayFromDay(
    typeof raw === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : localDate(),
  )
}

export default function WeekdayLiftsScreen() {
  const screen = useScreenStyles()
  const { session } = useAuth()
  const userId = session?.user.id
  const params = useLocalSearchParams<{ weekday?: string; day?: string }>()
  const initial = parseWeekday(params.weekday ?? params.day)
  const [weekday, setWeekday] = useState<Weekday>(initial)
  const [planned, setPlanned] = useState<Lift[]>([])
  const [catalog, setCatalog] = useState<Lift[]>([])
  const [muscles, setMuscles] = useState<Muscle[]>([])
  const [similarLinks, setSimilarLinks] = useState<SimilarDayLinks>(defaultSimilarDayLinks)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<{ kind: ToastKind; message: string } | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!userId) return
    try {
      const [planRows, catalogRows, muscleRows] = await Promise.all([
        loadWeekdayLifts(userId, weekday),
        loadLifts(),
        loadMuscles(),
      ])
      setPlanned(planRows)
      setCatalog(catalogRows)
      setMuscles(muscleRows)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load week plan')
    }
  }, [userId, weekday])

  useFocusEffect(
    useCallback(() => {
      setSimilarLinks(loadSimilarDayLinks())
      void load()
    }, [load]),
  )

  function updateSimilarLink(patch: Partial<{ prev: Weekday; next: Weekday }>) {
    setSimilarLinks((current) => {
      const next = withSimilarDayLink(current, weekday, patch)
      saveSimilarDayLinks(next)
      return next
    })
  }

  const plannedIds = useMemo(() => new Set(planned.map((lift) => lift.id)), [planned])
  const available = useMemo(
    () => catalog.filter((lift) => !plannedIds.has(lift.id)),
    [catalog, plannedIds],
  )
  const availableGroups = useMemo(
    () => liftCatalogGroupsWithLifts(available, muscles),
    [available, muscles],
  )

  async function addLift(lift: Lift) {
    if (!userId || busyId) return
    setBusyId(lift.id)
    try {
      await addWeekdayLift({ userId, weekday, liftId: lift.id })
      await load()
      setToast({ kind: 'success', message: 'Added to plan' })
    } catch (err) {
      setToast({
        kind: 'error',
        message: err instanceof Error ? err.message : 'Could not add lift',
      })
    } finally {
      setBusyId(null)
    }
  }

  async function removeLift(lift: Lift) {
    if (!userId || busyId) return
    setBusyId(lift.id)
    try {
      await removeWeekdayLift({ userId, weekday, liftId: lift.id })
      await load()
      setToast({ kind: 'success', message: 'Removed from plan' })
    } catch (err) {
      setToast({
        kind: 'error',
        message: err instanceof Error ? err.message : 'Could not remove lift',
      })
    } finally {
      setBusyId(null)
    }
  }

  return (
    <View style={{ flex: 1 }}>
      <Screen>
        <Text style={screen.title}>Week plan</Text>
        <Text style={screen.muted}>Lifts shown on each weekday even before you log a set.</Text>
        {error ? <Text style={screen.error}>{error}</Text> : null}
        <View style={[screen.setNumberRow, { flexWrap: 'wrap' }]}>
          {WEEKDAY_LABELS.map((day) => {
            const selected = weekday === day.value
            return (
              <Pressable
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                key={day.value}
                onPress={() => setWeekday(day.value)}
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
        <Text style={screen.sectionTitle}>{WEEKDAY_LABELS[weekday]?.long}</Text>
        <View style={screen.card}>
          {planned.length > 0 ? (
            planned.map((lift, index) => (
              <View key={lift.id} style={[screen.row, index === 0 && screen.rowFirst]}>
                <View style={screen.rowMain}>
                  <Text style={screen.rowTitle}>{lift.name}</Text>
                </View>
                <TrashButton onPress={() => void removeLift(lift)} />
              </View>
            ))
          ) : (
            <View style={[screen.row, screen.rowFirst]}>
              <Text style={screen.muted}>No lifts planned for this day.</Text>
            </View>
          )}
        </View>
        <Text style={screen.sectionTitle}>Similar day jumps</Text>
        <Text style={screen.muted}>
          Lifts {'<<'} and {'>>'} jump to these weekdays for quick comparison. Same weekday means last /
          next week.
        </Text>
        <Text style={screen.label}>Previous ({'<<'})</Text>
        <View style={[screen.setNumberRow, { flexWrap: 'wrap' }]}>
          {WEEKDAY_LABELS.map((day) => {
            const selected = similarLinks[weekday].prev === day.value
            return (
              <Pressable
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                key={`prev-${day.value}`}
                onPress={() => updateSimilarLink({ prev: day.value })}
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
        <Text style={screen.label}>Next ({'>>'})</Text>
        <View style={[screen.setNumberRow, { flexWrap: 'wrap' }]}>
          {WEEKDAY_LABELS.map((day) => {
            const selected = similarLinks[weekday].next === day.value
            return (
              <Pressable
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                key={`next-${day.value}`}
                onPress={() => updateSimilarLink({ next: day.value })}
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
        <Text style={screen.label}>Add from catalog</Text>
        {availableGroups.length > 0 ? (
          availableGroups.map((group) => (
            <View key={group.key} style={screen.card}>
              <View style={[screen.row, screen.rowFirst]}>
                <Text style={screen.muted}>{group.title}</Text>
              </View>
              {group.lifts.map((lift) => (
                <Pressable
                  accessibilityRole="button"
                  disabled={busyId !== null}
                  key={lift.id}
                  onPress={() => void addLift(lift as Lift)}
                  style={({ pressed }) => [
                    screen.row,
                    pressed && screen.rowPressed,
                    busyId === lift.id && screen.buttonDisabled,
                  ]}
                >
                  <Text style={screen.rowTitle}>{lift.name}</Text>
                  <Text style={screen.addText}>Add</Text>
                </Pressable>
              ))}
            </View>
          ))
        ) : (
          <View style={screen.card}>
            <View style={[screen.row, screen.rowFirst]}>
              <Text style={screen.muted}>
                {catalog.length === 0
                  ? 'Add lifts in the catalog first.'
                  : 'Every catalog lift is already on this day.'}
              </Text>
            </View>
          </View>
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
