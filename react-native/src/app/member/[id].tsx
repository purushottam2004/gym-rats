import { useFocusEffect, useLocalSearchParams } from 'expo-router'
import { useCallback, useMemo, useState } from 'react'
import { Text, View } from 'react-native'
import { DayControls } from '../../components/DayControls'
import { InfoButton } from '../../components/InfoButton'
import { InfoListModal, type InfoListRow } from '../../components/InfoListModal'
import { NutrientProgressRow } from '../../components/NutrientProgressRow'
import { OrdinalNumber } from '../../components/OrdinalNumber'
import { Screen } from '../../components/Screen'
import { useScreenStyles } from '../../theme/ThemeProvider'
import {
  loadFoods,
  loadIntakes,
  loadLifts,
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
import {
  foodBasisLabel,
  foodTypeNutrition,
  formatNutrientTotal,
  nutrientContributions,
  nutritionProgressLines,
  summarizeNutrition,
} from '../../lib/nutrition'

type InfoModalState = {
  title: string
  subtitle?: string
  rows: InfoListRow[]
  emptyMessage: string
}

export default function MemberScreen() {
  const screen = useScreenStyles()
  const { id } = useLocalSearchParams<{ id: string }>()
  const [day, setDay] = useState(localDate)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [intakes, setIntakes] = useState<Intake[]>([])
  const [sets, setSets] = useState<SetLog[]>([])
  const [goals, setGoals] = useState<NutrientGoal[]>([])
  const [error, setError] = useState<string | null>(null)
  const [infoModal, setInfoModal] = useState<InfoModalState | null>(null)

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

  function showNutrientInfo(nutrientId: string, nutrientName: string, unit: string) {
    const contributions = nutrientContributions(intakes, nutrientId)
    setInfoModal({
      title: nutrientName,
      subtitle: 'Contribution by food',
      rows: contributions.map((line) => ({
        key: line.key,
        label: `${line.foodName} · ${line.amount} ${measureLabel(line.measure)}`,
        value: `${formatNutrientTotal(line.total)} ${unit}`,
      })),
      emptyMessage: 'No foods contributed to this nutrient.',
    })
  }

  function showFoodInfo(intake: Intake) {
    const lines = foodTypeNutrition(intake.food)
    setInfoModal({
      title: intake.food.name,
      subtitle: foodBasisLabel(intake.food.measure, intake.food.basis),
      rows: lines.map((line) => ({
        key: line.id,
        label: line.name,
        value: `${formatNutrientTotal(line.total)} ${line.unit}`,
      })),
      emptyMessage: 'No nutrients defined for this food.',
    })
  }

  async function showFoodCatalog() {
    if (!id) return
    try {
      const foods = await loadFoods(id)
      setInfoModal({
        title: `${profile?.display_name ?? 'Member'}'s food catalog`,
        rows: foods.map((food) => ({
          key: food.id,
          label: food.name,
          value: measureLabel(food.measure),
        })),
        emptyMessage: 'No foods in this catalog yet.',
      })
    } catch (err) {
      setInfoModal({
        title: `${profile?.display_name ?? 'Member'}'s food catalog`,
        rows: [],
        emptyMessage: err instanceof Error ? err.message : 'Could not load this catalog',
      })
    }
  }

  async function showLiftCatalog() {
    try {
      const lifts = await loadLifts()
      setInfoModal({
        title: 'Lift catalog',
        subtitle: 'Shared by everyone',
        rows: lifts.map((lift) => ({
          key: lift.id,
          label: lift.name,
          value: '',
        })),
        emptyMessage: 'No lifts in the catalog yet.',
      })
    } catch (err) {
      setInfoModal({
        title: 'Lift catalog',
        rows: [],
        emptyMessage: err instanceof Error ? err.message : 'Could not load this catalog',
      })
    }
  }

  return (
    <View style={{ flex: 1 }}>
      <Screen
        header={
          <View style={screen.tabChrome}>
            <Text style={[screen.tabChromeTitle, { flexShrink: 1 }]} numberOfLines={1}>
              {profile?.display_name ?? 'Member'}
            </Text>
            <DayControls day={day} onChange={setDay} />
          </View>
        }
      >
        {error ? <Text style={screen.error}>{error}</Text> : null}
        <View style={screen.card}>
          <View style={[screen.row, screen.rowFirst]}>
            <Text style={[screen.muted, screen.rowMain]}>Diet</Text>
            <InfoButton onPress={() => void showFoodCatalog()} />
          </View>
          {intakes.length > 0 ? (
            intakes.map((row) => (
              <View key={row.id} style={screen.row}>
                <Text style={[screen.rowTitle, screen.rowMain]}>{row.food.name}</Text>
                <View style={screen.choiceTrail}>
                  <Text style={screen.rowMeta}>
                    {row.amount} {measureLabel(row.food.measure)}
                  </Text>
                  <InfoButton onPress={() => showFoodInfo(row)} />
                </View>
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
                <NutrientProgressRow
                  key={line.id}
                  first={index === 0}
                  line={line}
                  onInfo={() => showNutrientInfo(line.id, line.name, line.unit)}
                />
              ))}
            </View>
          </View>
        ) : null}
        <View style={screen.card}>
          <View style={[screen.row, screen.rowFirst]}>
            <Text style={[screen.muted, screen.rowMain]}>Lifts</Text>
            <InfoButton onPress={() => void showLiftCatalog()} />
          </View>
          {sets.length > 0 ? (
            sets.map((row) => (
              <View key={row.id} style={screen.row}>
                <View style={[screen.rowMain, screen.setLabelRow]}>
                  <Text style={screen.rowTitle} numberOfLines={1}>
                    {row.lift.name}
                  </Text>
                  <OrdinalNumber value={row.attempt} />
                  <Text style={screen.rowTitle}>{row.reps} reps</Text>
                </View>
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
      <InfoListModal
        visible={infoModal !== null}
        title={infoModal?.title ?? ''}
        subtitle={infoModal?.subtitle}
        rows={infoModal?.rows ?? []}
        emptyMessage={infoModal?.emptyMessage ?? ''}
        onClose={() => setInfoModal(null)}
      />
    </View>
  )
}
