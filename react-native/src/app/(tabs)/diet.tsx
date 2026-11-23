import { useFocusEffect, useRouter } from 'expo-router'
import { useCallback, useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { useAuth } from '../../auth/AuthProvider'
import { DeleteConfirmButton } from '../../components/DeleteConfirmButton'
import { Screen } from '../../components/Screen'
import { screen } from '../../components/screenStyles'
import { deleteIntake, loadIntakes, measureLabel, type Intake } from '../../lib/gym'
import { formatDay, localDate, shiftDate } from '../../lib/localDate'

export default function DietScreen() {
  const { session } = useAuth()
  const router = useRouter()
  const userId = session?.user.id
  const [day, setDay] = useState(localDate)
  const [rows, setRows] = useState<Intake[]>([])
  const [error, setError] = useState<string | null>(null)

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
            </View>
          </View>
        ))}
        <Pressable
          onPress={() => router.push({ pathname: '/add-food', params: { day } })}
          style={screen.add}
        >
          <Text style={screen.addText}>Add food</Text>
        </Pressable>
      </View>
    </Screen>
  )
}
