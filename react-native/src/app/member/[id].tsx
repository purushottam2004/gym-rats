import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router'
import { useCallback, useMemo, useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { DayControls } from '../../components/DayControls'
import { NutrientProgressRow } from '../../components/NutrientProgressRow'
import { OrdinalNumber } from '../../components/OrdinalNumber'
import { Screen } from '../../components/Screen'
import { screen } from '../../components/screenStyles'
import {
  loadIntakes,
  loadNutrientGoals,
  loadProfile,
  loadSets,
  measureLabel,
  type Intake,
  type NutrientGoal,
  type Profile,
  type SetLog,
} from '../../lib/gym'
import { localDate } from '../../lib/localDate'
import { nutritionProgressLines, summarizeNutrition } from '../../lib/nutrition'

export default function MemberScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const [day, setDay] = useState(localDate)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [intakes, setIntakes] = useState<Intake[]>([])
  const [sets, setSets] = useState<SetLog[]>([])
  const [goals, setGoals] = useState<NutrientGoal[]>([])
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!id) return
    try {
      const [nextProfile, nextIntakes, nextSets, nextGoals] = await Promise.all([
        loadProfile(id),
        loadIntakes(id, day),
        loadSets(id, day),
        loadNutrientGoals(id),
      ])
      setProfile(nextProfile)
      setIntakes(nextIntakes)
      setSets(nextSets)
      setGoals(nextGoals)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not open this person')
    }
  }, [id, day])

  useFocusEffect(
    useCallback(() => {
      void load()
    }, [load]),
  )

  const today = localDate()
  const progress = useMemo(
    () => nutritionProgressLines(summarizeNutrition(intakes), goals),
    [intakes, goals],
  )

  return (
    <Screen
      header={
        <>
          <Pressable onPress={() => router.back()}>
            <Text style={screen.addText}>Back</Text>
          </Pressable>
          <View style={screen.tabChrome}>
            <Text style={[screen.tabChromeTitle, { flexShrink: 1 }]} numberOfLines={1}>
              {profile?.display_name ?? 'Member'}
            </Text>
            <DayControls day={day} onChange={setDay} />
          </View>
        </>
      }
    >
      {error ? <Text style={screen.error}>{error}</Text> : null}
      <View style={screen.card}>
        <View style={[screen.row, screen.rowFirst]}>
          <Text style={screen.muted}>Diet</Text>
        </View>
        {intakes.length > 0 ? (
          intakes.map((row) => (
            <View key={row.id} style={screen.row}>
              <Text style={screen.rowTitle}>{row.food.name}</Text>
              <Text style={screen.rowMeta}>
                {row.amount} {measureLabel(row.food.measure)}
              </Text>
            </View>
          ))
        ) : (
          <View style={screen.row}>
            <Text style={screen.muted}>No food logged for this day.</Text>
          </View>
        )}
      </View>
      {progress.length > 0 ? (
        <View style={screen.section}>
          <Text style={screen.sectionTitle}>
            {day === today ? "Today's Nutrition Summary" : "Day's Nutrition Summary"}
          </Text>
          <View style={screen.card}>
            {progress.map((line, index) => (
              <NutrientProgressRow key={line.id} first={index === 0} line={line} />
            ))}
          </View>
        </View>
      ) : null}
      <View style={screen.card}>
        <View style={[screen.row, screen.rowFirst]}>
          <Text style={screen.muted}>Lifts</Text>
        </View>
        {sets.length > 0 ? (
          sets.map((row) => (
            <View key={row.id} style={screen.row}>
              <Text style={screen.rowTitle}>
                {row.lift.name} · <OrdinalNumber value={row.attempt} /> {row.reps} reps
              </Text>
              <Text style={screen.rowMeta}>{row.load_kg} kg</Text>
            </View>
          ))
        ) : (
          <View style={screen.row}>
            <Text style={screen.muted}>No sets logged for this day.</Text>
          </View>
        )}
      </View>
    </Screen>
  )
}
