import { useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { useAuth } from '../auth/AuthProvider'
import { AppTextInput } from '../components/AppTextInput'
import { Screen } from '../components/Screen'
import { useScreenStyles } from '../theme/ThemeProvider'
import { loadNutrients, logOtherIntake, type Nutrient } from '../lib/gym'
import { syncNutrientRemindersForUser } from '../lib/nutrientReminderSync'
import { consumeOtherFoodDraft, type OtherFoodDraft } from '../lib/otherFoodDraft'

function takeInitialDraft(): OtherFoodDraft | null {
  return consumeOtherFoodDraft()
}

export default function LogOtherScreen() {
  const screen = useScreenStyles()
  const { session } = useAuth()
  const { day } = useLocalSearchParams<{ day: string }>()
  const router = useRouter()
  const [draft] = useState(takeInitialDraft)
  const [name, setName] = useState(() => draft?.name ?? '')
  const [nutrients, setNutrients] = useState<Nutrient[]>([])
  const [amounts, setAmounts] = useState<Record<string, string>>(() => draft?.amounts ?? {})
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const fromPhoto = draft != null

  useEffect(() => {
    void loadNutrients()
      .then(setNutrients)
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : 'Could not load nutrients'),
      )
  }, [])

  async function save() {
    if (!day) {
      setError('Missing day')
      return
    }
    try {
      setSaving(true)
      const chosen = nutrients.flatMap((nutrient) => {
        const raw = amounts[nutrient.id]?.trim()
        if (!raw) return []
        const amount = Number(raw)
        if (!(amount >= 0)) throw new Error(`${nutrient.name} cannot be negative`)
        if (!(amount > 0)) return []
        return [{ nutrient_id: nutrient.id, amount }]
      })
      if (chosen.length === 0) {
        setError('Enter at least one nutrient amount')
        return
      }
      await logOtherIntake({ name, day, nutrients: chosen })
      const userId = session?.user.id
      if (userId) void syncNutrientRemindersForUser(userId, day)
      router.back()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Screen
      footer={
        <Pressable
          accessibilityRole="button"
          disabled={saving}
          onPress={() => void save()}
          style={[screen.save, saving && screen.buttonDisabled]}
        >
          <Text style={screen.buttonText}>{saving ? 'Saving…' : 'Save'}</Text>
        </Pressable>
      }
    >
      <Text style={screen.title}>Other</Text>
      <Text style={screen.muted}>
        {fromPhoto
          ? 'Review the photo estimate, edit anything that looks off, then save. Not added to your catalog.'
          : 'One-off nutrients for this day only. Not added to your food catalog.'}
      </Text>
      {error ? <Text style={screen.error}>{error}</Text> : null}
      <Text style={screen.label}>Name (optional)</Text>
      <AppTextInput
        onChangeText={setName}
        placeholder="Other"
        style={screen.input}
        value={name}
      />
      <Text style={screen.muted}>Amounts are totals for this entry.</Text>
      <View style={screen.card}>
        {nutrients.map((nutrient, index) => (
          <View key={nutrient.id} style={[screen.row, index === 0 && screen.rowFirst]}>
            <Text style={screen.rowTitle}>{nutrient.name}</Text>
            <AppTextInput
              keyboardType="decimal-pad"
              onChangeText={(value) =>
                setAmounts((current) => ({ ...current, [nutrient.id]: value }))
              }
              placeholder={nutrient.unit}
              style={[screen.input, { width: 90, paddingVertical: 6 }]}
              value={amounts[nutrient.id] ?? ''}
            />
          </View>
        ))}
      </View>
    </Screen>
  )
}
