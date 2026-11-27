import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router'
import { Circle, CircleCheck } from 'lucide-react-native'
import { useCallback, useRef, useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { AppTextInput } from '../components/AppTextInput'
import { BusyOverlay } from '../components/BrandLoader'
import { Screen } from '../components/Screen'
import { useScreenStyles, useTheme } from '../theme/ThemeProvider'
import { useAuth } from '../auth/AuthProvider'
import { loadFoods, logIntake, measureLabel, type Food } from '../lib/gym'
import { syncNutrientRemindersForUser } from '../lib/nutrientReminderSync'

export default function AddFoodScreen() {
  const screen = useScreenStyles()
  const { colors } = useTheme()
  const { session } = useAuth()
  const { day } = useLocalSearchParams<{ day: string }>()
  const router = useRouter()
  const [foods, setFoods] = useState<Food[]>([])
  const [foodId, setFoodId] = useState<string | null>(null)
  const [amount, setAmount] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const busyRef = useRef(false)

  useFocusEffect(
    useCallback(() => {
      void loadFoods()
        .then((rows) => {
          setFoods(rows)
          setFoodId((current) => current ?? rows[0]?.id ?? null)
        })
        .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Could not load foods'))
    }, []),
  )

  const selected = foods.find((food) => food.id === foodId)

  async function save() {
    // Ref blocks double-taps before React re-renders the disabled button / overlay.
    if (busyRef.current) return
    const value = Number(amount)
    if (!foodId || !day || !(value > 0)) {
      setError('Choose a food and an amount greater than zero')
      return
    }
    busyRef.current = true
    setBusy(true)
    setError(null)
    try {
      await logIntake(foodId, value, day)
      const userId = session?.user.id
      if (userId) await syncNutrientRemindersForUser(userId)
      router.back()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save')
      setBusy(false)
      busyRef.current = false
    }
  }

  return (
    <View style={{ flex: 1 }}>
      <Screen
        footer={
          <View style={{ gap: 10 }}>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Pressable
                accessibilityRole="button"
                disabled={busy}
                onPress={() => router.push('/new-food')}
                style={({ pressed }) => [
                  screen.addCard,
                  { flex: 1, alignItems: 'center' },
                  pressed && screen.rowPressed,
                  busy && screen.buttonDisabled,
                ]}
              >
                <Text style={screen.addText}>New Catalogue</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                disabled={busy}
                onPress={() => router.replace({ pathname: '/log-other', params: { day } })}
                style={({ pressed }) => [
                  screen.addCard,
                  { flex: 1, alignItems: 'center' },
                  pressed && screen.rowPressed,
                  busy && screen.buttonDisabled,
                ]}
              >
                <Text style={screen.addText}>Other Food</Text>
              </Pressable>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Text style={[screen.label, { flexShrink: 0 }]}>
                Amount{selected ? ` (${measureLabel(selected.measure)})` : ''}
              </Text>
              <AppTextInput
                editable={!busy}
                keyboardType="decimal-pad"
                onChangeText={setAmount}
                style={[screen.input, { flex: 1 }]}
                value={amount}
              />
            </View>
            <Pressable
              accessibilityRole="button"
              disabled={busy}
              onPress={() => void save()}
              style={[screen.save, busy && screen.buttonDisabled]}
            >
              <Text style={screen.buttonText}>Save</Text>
            </Pressable>
          </View>
        }
      >
        <Text style={screen.title}>Add food</Text>
        <Text style={screen.muted}>{day}</Text>
        {error ? <Text style={screen.error}>{error}</Text> : null}
        {foods.length > 0 ? (
          <View style={screen.card}>
            {foods.map((food, index) => {
              const selectedFood = foodId === food.id
              return (
                <Pressable
                  accessibilityRole="radio"
                  accessibilityState={{ selected: selectedFood }}
                  disabled={busy}
                  key={food.id}
                  onPress={() => setFoodId(food.id)}
                  style={({ pressed }) => [
                    screen.row,
                    index === 0 && screen.rowFirst,
                    selectedFood && screen.rowSelected,
                    pressed && (selectedFood ? screen.rowSelectedPressed : screen.rowPressed),
                    busy && screen.buttonDisabled,
                  ]}
                >
                  <Text style={[screen.rowTitle, selectedFood && screen.rowTitleSelected]}>{food.name}</Text>
                  <View style={screen.choiceTrail}>
                    <Text style={screen.muted}>{measureLabel(food.measure)}</Text>
                    {selectedFood ? (
                      <CircleCheck color={colors.accent} size={20} strokeWidth={2.25} />
                    ) : (
                      <Circle color={colors.border} size={20} strokeWidth={1.75} />
                    )}
                  </View>
                </Pressable>
              )
            })}
          </View>
        ) : null}
      </Screen>
      <BusyOverlay visible={busy} label="Saving…" />
    </View>
  )
}
