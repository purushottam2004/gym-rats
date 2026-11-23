import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router'
import { Circle, CircleCheck } from 'lucide-react-native'
import { useCallback, useState } from 'react'
import { Pressable, Text, TextInput, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { screen } from '../components/screenStyles'
import { loadFoods, logIntake, measureLabel, type Food } from '../lib/gym'

export default function AddFoodScreen() {
  const { day } = useLocalSearchParams<{ day: string }>()
  const router = useRouter()
  const [foods, setFoods] = useState<Food[]>([])
  const [foodId, setFoodId] = useState<string | null>(null)
  const [amount, setAmount] = useState('')
  const [error, setError] = useState<string | null>(null)

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
    const value = Number(amount)
    if (!foodId || !day || !(value > 0)) {
      setError('Choose a food and an amount greater than zero')
      return
    }
    try {
      await logIntake(foodId, value, day)
      router.back()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save')
    }
  }

  return (
    <SafeAreaView style={screen.page}>
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
                key={food.id}
                onPress={() => setFoodId(food.id)}
                style={({ pressed }) => [
                  screen.row,
                  index === 0 && screen.rowFirst,
                  selectedFood && screen.rowSelected,
                  pressed && (selectedFood ? screen.rowSelectedPressed : screen.rowPressed),
                ]}
              >
                <Text style={[screen.rowTitle, selectedFood && screen.rowTitleSelected]}>{food.name}</Text>
                <View style={screen.choiceTrail}>
                  <Text style={screen.muted}>{measureLabel(food.measure)}</Text>
                  {selectedFood ? (
                    <CircleCheck color="#c2410c" size={20} strokeWidth={2.25} />
                  ) : (
                    <Circle color="#d6d3d1" size={20} strokeWidth={1.75} />
                  )}
                </View>
              </Pressable>
            )
          })}
        </View>
      ) : null}
      <Pressable
        accessibilityRole="button"
        onPress={() => router.push('/new-food')}
        style={({ pressed }) => [screen.addCard, pressed && screen.rowPressed]}
      >
        <Text style={screen.addText}>New food</Text>
      </Pressable>
      <Text style={screen.label}>Amount{selected ? ` (${measureLabel(selected.measure)})` : ''}</Text>
      <TextInput keyboardType="decimal-pad" onChangeText={setAmount} style={screen.input} value={amount} />
      <Pressable onPress={() => void save()} style={screen.save}>
        <Text style={screen.buttonText}>Save</Text>
      </Pressable>
    </SafeAreaView>
  )
}
