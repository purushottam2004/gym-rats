import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router'
import { useCallback, useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { AppTextInput } from '../components/AppTextInput'
import { BrandLoader, LoadingBlock } from '../components/BrandLoader'
import { Screen } from '../components/Screen'
import { Toast, type ToastKind } from '../components/Toast'
import { createMuscle, loadMuscles, updateMuscle } from '../lib/gym'
import { useScreenStyles } from '../theme/ThemeProvider'

export default function EditMuscleScreen() {
  const screen = useScreenStyles()
  const router = useRouter()
  const params = useLocalSearchParams<{ id?: string }>()
  const id = typeof params.id === 'string' ? params.id : undefined
  const editing = Boolean(id)

  const [name, setName] = useState('')
  const [loaded, setLoaded] = useState(!editing)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<{ kind: ToastKind; message: string } | null>(null)

  const load = useCallback(async () => {
    if (!id) {
      setLoaded(true)
      return
    }
    try {
      const muscles = await loadMuscles()
      const muscle = muscles.find((row) => row.id === id)
      if (!muscle) {
        setError('Muscle not found')
      } else {
        setName(muscle.name)
        setError(null)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load muscle')
    } finally {
      setLoaded(true)
    }
  }, [id])

  useFocusEffect(
    useCallback(() => {
      void load()
    }, [load]),
  )

  async function save() {
    const trimmed = name.trim()
    if (!trimmed) {
      setError('A muscle needs a name')
      return
    }
    setBusy(true)
    try {
      if (editing && id) {
        await updateMuscle({ id, name: trimmed })
      } else {
        await createMuscle(trimmed)
      }
      router.back()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not save muscle'
      setToast({
        kind: 'error',
        message: /duplicate|unique/i.test(message) ? 'That muscle already exists' : message,
      })
    } finally {
      setBusy(false)
    }
  }

  if (!loaded) {
    return (
      <Screen>
        <LoadingBlock label="Loading muscle" />
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
            {busy ? (
              <BrandLoader size="sm" />
            ) : (
              <Text style={screen.buttonText}>{editing ? 'Save' : 'Create'}</Text>
            )}
          </Pressable>
        }
      >
        <Text style={screen.title}>{editing ? 'Edit Muscle' : 'New Muscle'}</Text>
        <Text style={screen.muted}>Shared catalog name for grouping lifts.</Text>
        {error ? <Text style={screen.error}>{error}</Text> : null}
        <Text style={screen.label}>Name</Text>
        <AppTextInput
          autoCapitalize="words"
          onChangeText={setName}
          placeholder="Chest"
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
