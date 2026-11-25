import { useFocusEffect } from 'expo-router'
import { useCallback, useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { useAuth } from '../auth/AuthProvider'
import { AppTextInput } from '../components/AppTextInput'
import { Screen } from '../components/Screen'
import { useScreenStyles } from '../theme/ThemeProvider'
import {
  loadNutrientGoals,
  loadNutrients,
  saveNutrientGoals,
  type Nutrient,
} from '../lib/gym'

export default function NutrientGoalsScreen() {
  const screen = useScreenStyles()
  const { session } = useAuth()
  const userId = session?.user.id
  const [nutrients, setNutrients] = useState<Nutrient[]>([])
  const [minDrafts, setMinDrafts] = useState<Record<string, string>>({})
  const [maxDrafts, setMaxDrafts] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    if (!userId) return
    try {
      const [nextNutrients, nextGoals] = await Promise.all([
        loadNutrients(),
        loadNutrientGoals(userId),
      ])
      setNutrients(nextNutrients)
      setMinDrafts(
        Object.fromEntries(
          nextNutrients.map((nutrient) => {
            const goal = nextGoals.find((row) => row.nutrient_id === nutrient.id)
            return [nutrient.id, goal?.min_amount != null ? String(goal.min_amount) : '']
          }),
        ),
      )
      setMaxDrafts(
        Object.fromEntries(
          nextNutrients.map((nutrient) => {
            const goal = nextGoals.find((row) => row.nutrient_id === nutrient.id)
            return [nutrient.id, goal?.max_amount != null ? String(goal.max_amount) : '']
          }),
        ),
      )
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load goals')
    }
  }, [userId])

  useFocusEffect(
    useCallback(() => {
      void load()
    }, [load]),
  )

  function parseBound(raw: string, label: string, nutrientName: string): number | null {
    const trimmed = raw.trim()
    if (!trimmed) return null
    const amount = Number(trimmed)
    if (!(amount > 0)) throw new Error(`${nutrientName} ${label} must be greater than zero`)
    return amount
  }

  async function saveGoals() {
    if (!userId || busy) return
    setBusy(true)
    setError(null)
    try {
      await saveNutrientGoals(
        userId,
        nutrients.map((nutrient) => {
          const min_amount = parseBound(minDrafts[nutrient.id] ?? '', 'min', nutrient.name)
          const max_amount = parseBound(maxDrafts[nutrient.id] ?? '', 'max', nutrient.name)
          if (min_amount != null && max_amount != null && min_amount > max_amount) {
            throw new Error(`${nutrient.name} min cannot be greater than max`)
          }
          return { nutrient_id: nutrient.id, min_amount, max_amount }
        }),
      )
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save goals')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Screen
      footer={
        <Pressable
          accessibilityRole="button"
          disabled={busy}
          onPress={() => void saveGoals()}
          style={({ pressed }) => [screen.save, busy && screen.buttonDisabled, pressed && screen.rowPressed]}
        >
          <Text style={screen.buttonText}>{busy ? 'Saving' : 'Save goals'}</Text>
        </Pressable>
      }
    >
      <Text style={screen.title}>Nutrient goals</Text>
      <Text style={screen.muted}>Optional min and/or max for the Diet summary bands.</Text>
      {error ? <Text style={screen.error}>{error}</Text> : null}
      <View style={screen.card}>
        <View style={[screen.row, screen.rowFirst, screen.goalHeaderRow]}>
          <Text style={[screen.muted, screen.rowMain]}>Nutrient</Text>
          <Text style={[screen.muted, screen.goalBoundCol]}>Min</Text>
          <Text style={[screen.muted, screen.goalBoundCol]}>Max</Text>
        </View>
        {nutrients.map((nutrient) => (
          <View key={nutrient.id} style={screen.row}>
            <View style={screen.rowMain}>
              <Text style={screen.rowTitle}>{nutrient.name}</Text>
              <Text style={screen.muted}>{nutrient.unit}</Text>
            </View>
            <AppTextInput
              keyboardType="decimal-pad"
              onChangeText={(value) =>
                setMinDrafts((current) => ({ ...current, [nutrient.id]: value }))
              }
              placeholder="min"
              style={[screen.input, screen.goalBoundInput]}
              value={minDrafts[nutrient.id] ?? ''}
            />
            <AppTextInput
              keyboardType="decimal-pad"
              onChangeText={(value) =>
                setMaxDrafts((current) => ({ ...current, [nutrient.id]: value }))
              }
              placeholder="max"
              style={[screen.input, screen.goalBoundInput]}
              value={maxDrafts[nutrient.id] ?? ''}
            />
          </View>
        ))}
      </View>
    </Screen>
  )
}
