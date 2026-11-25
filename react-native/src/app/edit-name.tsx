import { useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { Pressable, Text } from 'react-native'
import { AppTextInput } from '../components/AppTextInput'
import { Screen } from '../components/Screen'
import { useAuth } from '../auth/AuthProvider'
import { useScreenStyles } from '../theme/ThemeProvider'
import { loadProfile, saveDisplayName } from '../lib/gym'

export default function EditNameScreen() {
  const screen = useScreenStyles()
  const { session } = useAuth()
  const router = useRouter()
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const userId = session?.user.id
    if (!userId) return
    void loadProfile(userId)
      .then((profile) => setName(profile.display_name ?? ''))
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Could not load name'))
  }, [session?.user.id])

  async function save() {
    const userId = session?.user.id
    if (!userId) return
    try {
      await saveDisplayName(userId, name)
      router.back()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save')
    }
  }

  return (
    <Screen>
      <Text style={screen.title}>Edit name</Text>
      {error ? <Text style={screen.error}>{error}</Text> : null}
      <Text style={screen.label}>Display name</Text>
      <AppTextInput onChangeText={setName} style={screen.input} value={name} />
      <Pressable onPress={() => void save()} style={screen.save}>
        <Text style={screen.buttonText}>Save</Text>
      </Pressable>
    </Screen>
  )
}
