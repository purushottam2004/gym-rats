import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router'
import { Circle, CircleCheck } from 'lucide-react-native'
import { useCallback, useMemo, useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { AppTextInput } from '../components/AppTextInput'
import { Screen } from '../components/Screen'
import { useScreenStyles, useTheme } from '../theme/ThemeProvider'
import { loadLifts, loadMuscles, logSet, type Lift, type Muscle } from '../lib/gym'
import { liftCatalogGroupsWithLifts } from '../lib/liftCatalog'

const SET_NUMBERS = [1, 2, 3, 4, 5] as const

export default function AddSetScreen() {
  const screen = useScreenStyles()
  const { colors } = useTheme()
  const { day } = useLocalSearchParams<{ day: string }>()
  const router = useRouter()
  const [lifts, setLifts] = useState<Lift[]>([])
  const [muscles, setMuscles] = useState<Muscle[]>([])
  const [liftId, setLiftId] = useState<string | null>(null)
  const [setNumber, setSetNumber] = useState<(typeof SET_NUMBERS)[number]>(1)
  const [reps, setReps] = useState('')
  const [loadKg, setLoadKg] = useState('')
  const [error, setError] = useState<string | null>(null)

  useFocusEffect(
    useCallback(() => {
      void Promise.all([loadLifts(), loadMuscles()])
        .then(([nextLifts, nextMuscles]) => {
          setLifts(nextLifts)
          setMuscles(nextMuscles)
          setLiftId((current) => current ?? nextLifts[0]?.id ?? null)
        })
        .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Could not load lifts'))
    }, []),
  )

  const groups = useMemo(() => liftCatalogGroupsWithLifts(lifts, muscles), [lifts, muscles])

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

  return (
    <Screen
      footer={
        <View style={{ gap: 10 }}>
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
                  <Text
                    style={[
                      screen.setNumberCircleText,
                      selected && screen.setNumberCircleTextSelected,
                    ]}
                  >
                    {n}
                  </Text>
                </Pressable>
              )
            })}
          </View>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1, gap: 6 }}>
              <Text style={screen.label}>Reps</Text>
              <AppTextInput
                keyboardType="number-pad"
                onChangeText={setReps}
                style={screen.input}
                value={reps}
              />
            </View>
            <View style={{ flex: 1, gap: 6 }}>
              <Text style={screen.label}>Kilograms</Text>
              <AppTextInput
                keyboardType="decimal-pad"
                onChangeText={setLoadKg}
                style={screen.input}
                value={loadKg}
              />
            </View>
          </View>
          {error ? <Text style={screen.error}>{error}</Text> : null}
          <Pressable onPress={() => void save()} style={screen.save}>
            <Text style={screen.buttonText}>Save</Text>
          </Pressable>
        </View>
      }
    >
      <Text style={screen.title}>Add a set</Text>
      <Text style={screen.muted}>{day}</Text>
      {groups.map((group) => (
        <View key={group.key} style={screen.card}>
          <View style={[screen.row, screen.rowFirst]}>
            <Text style={screen.muted}>{group.title}</Text>
          </View>
          {group.lifts.map((lift) => {
            const selectedLift = liftId === lift.id
            return (
              <Pressable
                accessibilityRole="radio"
                accessibilityState={{ selected: selectedLift }}
                key={lift.id}
                onPress={() => setLiftId(lift.id)}
                style={({ pressed }) => [
                  screen.row,
                  selectedLift && screen.rowSelected,
                  pressed && (selectedLift ? screen.rowSelectedPressed : screen.rowPressed),
                ]}
              >
                <Text style={[screen.rowTitle, selectedLift && screen.rowTitleSelected]}>
                  {lift.name}
                </Text>
                {selectedLift ? (
                  <CircleCheck color={colors.accent} size={20} strokeWidth={2.25} />
                ) : (
                  <Circle color={colors.border} size={20} strokeWidth={1.75} />
                )}
              </Pressable>
            )
          })}
        </View>
      ))}
    </Screen>
  )
}
