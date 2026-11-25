import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router'
import { useCallback, useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { useAuth } from '../auth/AuthProvider'
import { AppTextInput } from '../components/AppTextInput'
import { Screen } from '../components/Screen'
import { Toast, type ToastKind } from '../components/Toast'
import { createHabitSection, loadHabitSections, updateHabitSection } from '../lib/gym'
import { useScreenStyles } from '../theme/ThemeProvider'

export default function EditHabitSectionScreen() {
  const screen = useScreenStyles()
  const router = useRouter()
  const { session } = useAuth()
  const userId = session?.user.id
  const { id } = useLocalSearchParams<{ id?: string }>()
  const editing = Boolean(id)

  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<{ kind: ToastKind; message: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [loaded, setLoaded] = useState(!editing)

  const load = useCallback(async () => {
    if (!userId || !editing || !id) {
      setLoaded(true)
      return
    }
    try {
      const sections = await loadHabitSections(userId)
      const section = sections.find((row) => row.id === id)
      if (!section) {
        setError('Section not found')
        setLoaded(true)
        return
      }
      setName(section.name)
      setError(null)
      setLoaded(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load section')
      setLoaded(true)
    }
  }, [editing, id, userId])

  useFocusEffect(
    useCallback(() => {
      void load()
    }, [load]),
  )

  async function save() {
    const trimmed = name.trim()
    if (!trimmed) {
      setToast({ kind: 'error', message: 'Name is required' })
      return
    }
    setBusy(true)
    try {
      if (editing && id) {
        await updateHabitSection({ id, name: trimmed })
      } else {
        await createHabitSection(trimmed)
      }
      router.back()
    } catch (err) {
      setToast({
        kind: 'error',
        message: err instanceof Error ? err.message : 'Could not save section',
      })
    } finally {
      setBusy(false)
    }
  }

  if (!loaded) {
    return (
      <Screen>
        <Text style={screen.muted}>Loading…</Text>
      </Screen>
    )
  }

  return (
    <View style={{ flex: 1 }}>
      <Screen
        footer={
          <Pressable
            accessibilityRole="button"
            disabled={busy}
            onPress={() => void save()}
            style={[screen.save, busy && screen.buttonDisabled]}
          >
            <Text style={screen.buttonText}>{editing ? 'Save' : 'Create'}</Text>
          </Pressable>
        }
      >
        <Text style={screen.title}>{editing ? 'Edit Section' : 'New Section'}</Text>
        {error ? <Text style={screen.error}>{error}</Text> : null}
        <Text style={screen.label}>Name</Text>
        <AppTextInput
          autoCapitalize="words"
          onChangeText={setName}
          placeholder="Hygiene"
          style={screen.input}
          value={name}
        />
      </Screen>
      <Toast
        visible={toast !== null}
        kind={toast?.kind ?? 'success'}
        message={toast?.message ?? ''}
        onHide={() => setToast(null)}
      />
    </View>
  )
}
