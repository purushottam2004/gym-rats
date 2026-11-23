import { useFocusEffect, useRouter } from 'expo-router'
import { useCallback, useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { useAuth } from '../../auth/AuthProvider'
import { DeleteConfirmButton } from '../../components/DeleteConfirmButton'
import { InfoButton } from '../../components/InfoButton'
import { InfoListModal, type InfoListRow } from '../../components/InfoListModal'
import { Screen } from '../../components/Screen'
import { screen } from '../../components/screenStyles'
import { deleteIntake, loadIntakes, measureLabel, type Intake } from '../../lib/gym'
import { formatDay, localDate, shiftDate } from '../../lib/localDate'
import {
  foodBasisLabel,
  foodTypeNutrition,
  formatNutrientTotal,
  nutrientContributions,
  nutritionSummaryTitle,
  summarizeNutrition,
} from '../../lib/nutrition'

type InfoModalState = {
  title: string
  subtitle?: string
  rows: InfoListRow[]
  emptyMessage: string
}

export default function DietScreen() {
  const { session } = useAuth()
  const router = useRouter()
  const userId = session?.user.id
  const [day, setDay] = useState(localDate)
  const [rows, setRows] = useState<Intake[]>([])
  const [error, setError] = useState<string | null>(null)
  const [infoModal, setInfoModal] = useState<InfoModalState | null>(null)
  const today = localDate()
  const summary = summarizeNutrition(rows)

  const load = useCallback(async () => {
    if (!userId) return
    try {
      setRows(await loadIntakes(userId, day))
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load diet')
    }
  }, [userId, day])

  useFocusEffect(
    useCallback(() => {
      void load()
    }, [load]),
  )

  function showFoodInfo(row: Intake) {
    const lines = foodTypeNutrition(row.food)
    setInfoModal({
      title: row.food.name,
      subtitle: foodBasisLabel(row.food.measure, row.food.basis),
      rows: lines.map((line) => ({
        key: line.id,
        label: line.name,
        value: `${formatNutrientTotal(line.total)} ${line.unit}`,
      })),
      emptyMessage: 'No nutrients defined for this food.',
    })
  }

  function showNutrientInfo(nutrientId: string, nutrientName: string, unit: string) {
    const contributions = nutrientContributions(rows, nutrientId)
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

  return (
    <Screen>
      <Text style={screen.title}>Diet</Text>
      <View style={screen.dayRow}>
        <Pressable onPress={() => setDay((current) => shiftDate(current, -1))}>
          <Text style={screen.addText}>Previous</Text>
        </Pressable>
        <Text style={screen.body}>{formatDay(day)}</Text>
        <Pressable onPress={() => setDay((current) => shiftDate(current, 1))}>
          <Text style={screen.addText}>Next</Text>
        </Pressable>
      </View>
      {error ? <Text style={screen.error}>{error}</Text> : null}
      <View style={screen.card}>
        {rows.map((row, index) => (
          <View key={row.id} style={[screen.row, index === 0 && screen.rowFirst]}>
            <View style={screen.rowMain}>
              <Text style={screen.rowTitle}>{row.food.name}</Text>
            </View>
            <View style={screen.choiceTrail}>
              <Text style={screen.rowMeta}>
                {row.amount} {measureLabel(row.food.measure)}
              </Text>
              <DeleteConfirmButton
                title="Delete food?"
                message={`Remove ${row.food.name} from this day's log?`}
                onConfirm={() => void deleteIntake(row.id).then(load)}
              />
              <InfoButton onPress={() => showFoodInfo(row)} />
            </View>
          </View>
        ))}
        <View style={screen.addRow}>
          <Pressable onPress={() => router.push({ pathname: '/add-food', params: { day } })}>
            <Text style={screen.addText}>Add food</Text>
          </Pressable>
          <Pressable onPress={() => router.push('/food-catalog')}>
            <Text style={screen.addText}>View Catalog</Text>
          </Pressable>
        </View>
      </View>
      <View style={screen.section}>
        <Text style={screen.sectionTitle}>{nutritionSummaryTitle(day, today)}</Text>
        <View style={screen.card}>
          {summary.length > 0 ? (
            summary.map((line, index) => (
              <View key={line.id} style={[screen.row, index === 0 && screen.rowFirst]}>
                <Text style={[screen.rowTitle, screen.rowMain]}>{line.name}</Text>
                <View style={screen.choiceTrail}>
                  <Text style={screen.rowMeta}>
                    {formatNutrientTotal(line.total)} {line.unit}
                  </Text>
                  <InfoButton onPress={() => showNutrientInfo(line.id, line.name, line.unit)} />
                </View>
              </View>
            ))
          ) : (
            <View style={[screen.row, screen.rowFirst]}>
              <Text style={screen.muted}>No nutrition logged for this day.</Text>
            </View>
          )}
        </View>
      </View>
      <InfoListModal
        visible={infoModal !== null}
        title={infoModal?.title ?? ''}
        subtitle={infoModal?.subtitle}
        rows={infoModal?.rows ?? []}
        emptyMessage={infoModal?.emptyMessage ?? ''}
        onClose={() => setInfoModal(null)}
      />
    </Screen>
  )
}
