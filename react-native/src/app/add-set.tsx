import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router'
import { Circle, CircleCheck } from 'lucide-react-native'
import { useCallback, useState } from 'react'
import { Pressable, Text, TextInput, View } from 'react-native'
import { Screen } from '../components/Screen'
import { screen } from '../components/screenStyles'
import { loadLifts, logSet, type Lift } from '../lib/gym'

const SET_NUMBERS = [1, 2, 3, 4, 5] as const

export default function AddSetScreen() {
  const { day } = useLocalSearchParams<{ day: string }>()
  const router = useRouter()
  const [lifts, setLifts] = useState<Lift[]>([])
  const [liftId, setLiftId] = useState<string | null>(null)
  const [setNumber, setSetNumber] = useState<(typeof SET_NUMBERS)[number]>(1)
  const [reps, setReps] = useState('')
  const [loadKg, setLoadKg] = useState('')
  const [error, setError] = useState<string | null>(null)

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

  return (
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
      <Pressable onPress={() => void save()} style={screen.save}>
        <Text style={screen.buttonText}>Save</Text>
      </Pressable>
    </Screen>
  )
}
