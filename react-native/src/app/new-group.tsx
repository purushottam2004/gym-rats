import { useRouter } from 'expo-router'
import { useState } from 'react'
import { Pressable, Text } from 'react-native'
import { AppTextInput } from '../components/AppTextInput'
import { Screen } from '../components/Screen'
import { screen } from '../components/screenStyles'
import { createGroup } from '../lib/gym'

export default function NewGroupScreen() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function save() {
    try {
      const group = await createGroup(name)
      router.replace({ pathname: '/group/[id]', params: { id: group.id } })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create group')
    }
  }

  return (
    <Screen>
      <Text style={screen.title}>New group</Text>
      <Text style={screen.muted}>You name it. A code is issued when you create it.</Text>
      {error ? <Text style={screen.error}>{error}</Text> : null}
      <Text style={screen.label}>Name</Text>
      <AppTextInput onChangeText={setName} style={screen.input} value={name} />
      <Pressable onPress={() => void save()} style={screen.save}>
        <Text style={screen.buttonText}>Create group</Text>
      </Pressable>
    </Screen>
  )
}
