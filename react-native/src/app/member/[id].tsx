import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router'
import { useCallback, useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { OrdinalNumber } from '../../components/OrdinalNumber'
import { Screen } from '../../components/Screen'
import { screen } from '../../components/screenStyles'
import {
  loadIntakes,
  loadProfile,
  loadSets,
  measureLabel,
  type Intake,
  type Profile,
  type SetLog,
} from '../../lib/gym'
import { formatDay, localDate, shiftDate } from '../../lib/localDate'

export default function MemberScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const [day, setDay] = useState(localDate)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [intakes, setIntakes] = useState<Intake[]>([])
  const [sets, setSets] = useState<SetLog[]>([])
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!id) return
    try {
      const [nextProfile, nextIntakes, nextSets] = await Promise.all([
        loadProfile(id),
        loadIntakes(id, day),
        loadSets(id, day),
      ])
      setProfile(nextProfile)
      setIntakes(nextIntakes)
      setSets(nextSets)
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

  return (
    <Screen>
      <Pressable onPress={() => router.back()}>
        <Text style={screen.addText}>Back</Text>
      </Pressable>
      <Text style={screen.title}>{profile?.display_name ?? 'Member'}</Text>
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
        <View style={[screen.row, screen.rowFirst]}>
          <Text style={screen.muted}>Diet</Text>
        </View>
        {intakes.map((row) => (
          <View key={row.id} style={screen.row}>
            <Text style={screen.rowTitle}>{row.food.name}</Text>
            <Text style={screen.rowMeta}>
              {row.amount} {measureLabel(row.food.measure)}
            </Text>
          </View>
        ))}
      </View>
      <View style={screen.card}>
        <View style={[screen.row, screen.rowFirst]}>
          <Text style={screen.muted}>Lifts</Text>
        </View>
        {sets.map((row) => (
          <View key={row.id} style={screen.row}>
            <Text style={screen.rowTitle}>
              {row.lift.name} · <OrdinalNumber value={row.attempt} /> {row.reps} reps
            </Text>
            <Text style={screen.rowMeta}>{row.load_kg} kg</Text>
          </View>
        ))}
      </View>
    </Screen>
  )
}
