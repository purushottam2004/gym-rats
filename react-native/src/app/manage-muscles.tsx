import { useFocusEffect, useRouter } from 'expo-router'
import { Pencil } from 'lucide-react-native'
import { useCallback, useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { ConfirmModal } from '../components/ConfirmModal'
import { Screen } from '../components/Screen'
import { Toast, type ToastKind } from '../components/Toast'
import { TrashButton } from '../components/TrashButton'
import {
  deleteMuscle,
  loadCurrentUserIsAdmin,
  loadMuscles,
  reorderMuscles,
  type Muscle,
} from '../lib/gym'
import { useScreenStyles, useTheme } from '../theme/ThemeProvider'

export default function ManageMusclesScreen() {
  const screen = useScreenStyles()
  const { colors } = useTheme()
  const router = useRouter()
  const [muscles, setMuscles] = useState<Muscle[]>([])
  const [isAdmin, setIsAdmin] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<Muscle | null>(null)
  const [toast, setToast] = useState<{ kind: ToastKind; message: string } | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    try {
      const [nextMuscles, admin] = await Promise.all([loadMuscles(), loadCurrentUserIsAdmin()])
      setMuscles(nextMuscles)
      setIsAdmin(admin)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load muscles')
    }
  }, [])

  useFocusEffect(
    useCallback(() => {
      void load()
    }, [load]),
  )

  async function confirmDelete() {
    const muscle = pendingDelete
    setPendingDelete(null)
    if (!muscle) return
    try {
      await deleteMuscle(muscle.id)
      await load()
      setToast({ kind: 'success', message: 'Deleted — lifts moved to Other' })
    } catch (err) {
      setToast({
        kind: 'error',
        message: err instanceof Error ? err.message : 'Could not delete muscle',
      })
    }
  }

  async function move(index: number, direction: -1 | 1) {
    const nextIndex = index + direction
    if (nextIndex < 0 || nextIndex >= muscles.length || busy) return
    const ordered = muscles.slice()
    const [item] = ordered.splice(index, 1)
    ordered.splice(nextIndex, 0, item)
    setMuscles(ordered)
    setBusy(true)
    try {
      await reorderMuscles(ordered.map((muscle) => muscle.id))
    } catch (err) {
      setToast({
        kind: 'error',
        message: err instanceof Error ? err.message : 'Could not reorder',
      })
      await load()
    } finally {
      setBusy(false)
    }
  }

  return (
    <View style={{ flex: 1 }}>
      <Screen
        footer={
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/edit-muscle')}
            style={screen.save}
          >
            <Text style={screen.buttonText}>Add Muscle</Text>
          </Pressable>
        }
      >
        <Text style={screen.title}>Muscles</Text>
        <Text style={screen.muted}>
          Named groups for the Lift catalog. Unassigned lifts stay under Other lifts.
          Anyone can add or reorder; only an Admin can rename or delete.
        </Text>
        {error ? <Text style={screen.error}>{error}</Text> : null}
        <View style={screen.card}>
          {muscles.length > 0 ? (
            muscles.map((muscle, index) => (
              <View key={muscle.id} style={[screen.row, index === 0 && screen.rowFirst]}>
                <Text style={[screen.rowTitle, screen.rowMain]}>{muscle.name}</Text>
                <View style={screen.choiceTrail}>
                  <Pressable
                    accessibilityLabel={`Move ${muscle.name} up`}
                    disabled={index === 0 || busy}
                    onPress={() => void move(index, -1)}
                    style={({ pressed }) => [
                      screen.iconActionButton,
                      (pressed || index === 0) && screen.buttonDisabled,
                    ]}
                  >
                    <Text style={screen.rowMeta}>↑</Text>
                  </Pressable>
                  <Pressable
                    accessibilityLabel={`Move ${muscle.name} down`}
                    disabled={index === muscles.length - 1 || busy}
                    onPress={() => void move(index, 1)}
                    style={({ pressed }) => [
                      screen.iconActionButton,
                      (pressed || index === muscles.length - 1) && screen.buttonDisabled,
                    ]}
                  >
                    <Text style={screen.rowMeta}>↓</Text>
                  </Pressable>
                  {isAdmin ? (
                    <Pressable
                      accessibilityLabel={`Rename ${muscle.name}`}
                      accessibilityRole="button"
                      hitSlop={8}
                      onPress={() =>
                        router.push({ pathname: '/edit-muscle', params: { id: muscle.id } })
                      }
                    >
                      <Pencil color={colors.accent} size={18} strokeWidth={2.25} />
                    </Pressable>
                  ) : null}
                  {isAdmin ? <TrashButton onPress={() => setPendingDelete(muscle)} /> : null}
                </View>
              </View>
            ))
          ) : (
            <View style={[screen.row, screen.rowFirst]}>
              <Text style={screen.muted}>No muscles yet.</Text>
            </View>
          )}
        </View>
      </Screen>
      <ConfirmModal
        visible={pendingDelete !== null}
        title="Delete muscle?"
        message={
          pendingDelete
            ? `Remove ${pendingDelete.name}? Lifts in it move to Other lifts.`
            : ''
        }
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => void confirmDelete()}
      />
      <Toast
        visible={toast !== null}
        kind={toast?.kind ?? 'success'}
        message={toast?.message ?? ''}
        onHide={() => setToast(null)}
      />
    </View>
  )
}
