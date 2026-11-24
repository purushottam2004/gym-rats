import { useRouter } from 'expo-router'
import { useState } from 'react'
import { Pressable, Text, TextInput } from 'react-native'
import { Screen } from '../components/Screen'
import { screen } from '../components/screenStyles'
import { createLift } from '../lib/gym'

export default function NewLiftScreen() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function save() {
    if (!name.trim()) {
      setError('A lift needs a name')
      return
    }
    try {
      await createLift(name)
      router.back()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not create lift'
      setError(
        /duplicate|unique/i.test(message) ? 'That lift is already in the catalog' : message,
      )
    }
  }

  return (
    <Screen>
      <Text style={screen.title}>New lift</Text>
      <Text style={screen.muted}>Shared catalog. A name only — it cannot be edited later.</Text>
      {error ? <Text style={screen.error}>{error}</Text> : null}
      <Text style={screen.label}>Name</Text>
      <TextInput onChangeText={setName} style={screen.input} value={name} />
      <Pressable onPress={() => void save()} style={screen.save}>
        <Text style={screen.buttonText}>Create lift</Text>
      </Pressable>
    </Screen>
  )
}
