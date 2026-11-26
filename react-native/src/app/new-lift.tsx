import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router'
import { Circle, CircleCheck } from 'lucide-react-native'
import { useCallback, useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { AppTextInput } from '../components/AppTextInput'
import { LoadingBlock } from '../components/BrandLoader'
import { Screen } from '../components/Screen'
import { Toast, type ToastKind } from '../components/Toast'
import {
  createLift,
  loadLifts,
  loadMuscles,
  updateLiftMuscle,
  type Muscle,
} from '../lib/gym'
import { useScreenStyles, useTheme } from '../theme/ThemeProvider'

export default function NewLiftScreen() {
  const screen = useScreenStyles()
  const { colors } = useTheme()
  const router = useRouter()
  const params = useLocalSearchParams<{ id?: string }>()
  const id = typeof params.id === 'string' ? params.id : undefined
  const editing = Boolean(id)

  const [name, setName] = useState('')
  const [muscleId, setMuscleId] = useState<string | null>(null)
  const [muscles, setMuscles] = useState<Muscle[]>([])
  const [loaded, setLoaded] = useState(!editing)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<{ kind: ToastKind; message: string } | null>(null)

  const load = useCallback(async () => {
    try {
      const nextMuscles = await loadMuscles()
      setMuscles(nextMuscles)
      if (id) {
        const lifts = await loadLifts()
        const lift = lifts.find((row) => row.id === id)
        if (!lift) {
          setError('Lift not found')
          setLoaded(true)
          return
        }
        setName(lift.name)
        setMuscleId(lift.muscle_id)
      }
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load')
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
    if (!editing && !name.trim()) {
      setError('A lift needs a name')
      return
    }
    setBusy(true)
    setError(null)
    try {
      if (editing && id) {
        await updateLiftMuscle({ id, muscleId })
      } else {
        await createLift({ name, muscleId })
      }
      router.back()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not save lift'
      if (/duplicate|unique/i.test(message)) {
        setError('That lift is already in the catalog')
      } else {
        setToast({ kind: 'error', message })
        setError(message)
      }
    } finally {
      setBusy(false)
    }
  }

  if (!loaded) {
    return (
      <Screen>
        <LoadingBlock label="Loading lift" />
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
            <Text style={screen.buttonText}>{editing ? 'Save' : 'Create lift'}</Text>
          </Pressable>
        }
      >
        <Text style={screen.title}>{editing ? 'Edit Lift' : 'New lift'}</Text>
        <Text style={screen.muted}>
          {editing
            ? 'Name is fixed. Change the muscle to move this lift in the catalog.'
            : 'Shared catalog. The name cannot be edited later; the muscle can.'}
        </Text>
        {error ? <Text style={screen.error}>{error}</Text> : null}

        <Text style={screen.label}>Name</Text>
        <AppTextInput
          editable={!editing}
          onChangeText={setName}
          style={[screen.input, editing && screen.buttonDisabled]}
          value={name}
        />

        <Text style={screen.label}>Muscle</Text>
        <View style={screen.card}>
          <Pressable
            accessibilityRole="radio"
            accessibilityState={{ selected: muscleId == null }}
            onPress={() => setMuscleId(null)}
            style={({ pressed }) => [
              screen.row,
              screen.rowFirst,
              muscleId == null && screen.rowSelected,
              pressed && (muscleId == null ? screen.rowSelectedPressed : screen.rowPressed),
            ]}
          >
            <Text style={[screen.rowTitle, muscleId == null && screen.rowTitleSelected]}>
              Other lifts
            </Text>
            {muscleId == null ? (
              <CircleCheck color={colors.accent} size={20} strokeWidth={2.25} />
            ) : (
              <Circle color={colors.border} size={20} strokeWidth={1.75} />
            )}
          </Pressable>
          {muscles.map((muscle) => {
            const selected = muscleId === muscle.id
            return (
              <Pressable
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                key={muscle.id}
                onPress={() => setMuscleId(muscle.id)}
                style={({ pressed }) => [
                  screen.row,
                  selected && screen.rowSelected,
                  pressed && (selected ? screen.rowSelectedPressed : screen.rowPressed),
                ]}
              >
                <Text style={[screen.rowTitle, selected && screen.rowTitleSelected]}>
                  {muscle.name}
                </Text>
                {selected ? (
                  <CircleCheck color={colors.accent} size={20} strokeWidth={2.25} />
                ) : (
                  <Circle color={colors.border} size={20} strokeWidth={1.75} />
                )}
              </Pressable>
            )
          })}
        </View>
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
