import { useFocusEffect, useRouter } from 'expo-router'
import { useCallback, useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { useAuth } from '../auth/AuthProvider'
import { ConfirmModal } from '../components/ConfirmModal'
import { Screen } from '../components/Screen'
import { Toast, type ToastKind } from '../components/Toast'
import { TrashButton } from '../components/TrashButton'
import {
  deleteHabitSection,
  loadHabitSections,
  reorderHabitSections,
  type HabitSection,
} from '../lib/gym'
import { useScreenStyles } from '../theme/ThemeProvider'

export default function ManageHabitSectionsScreen() {
  const screen = useScreenStyles()
  const router = useRouter()
  const { session } = useAuth()
  const userId = session?.user.id
  const [sections, setSections] = useState<HabitSection[]>([])
  const [error, setError] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<HabitSection | null>(null)
  const [toast, setToast] = useState<{ kind: ToastKind; message: string } | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    if (!userId) return
    try {
      setSections(await loadHabitSections(userId))
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load sections')
    }
  }, [userId])

  useFocusEffect(
    useCallback(() => {
      void load()
    }, [load]),
  )

  async function confirmDelete() {
    const section = pendingDelete
    setPendingDelete(null)
    if (!section) return
    try {
      await deleteHabitSection(section.id)
      await load()
      setToast({ kind: 'success', message: 'Deleted — habits moved to Other' })
    } catch (err) {
      setToast({
        kind: 'error',
        message: err instanceof Error ? err.message : 'Could not delete section',
      })
    }
  }

  async function move(index: number, direction: -1 | 1) {
    const nextIndex = index + direction
    if (nextIndex < 0 || nextIndex >= sections.length || busy) return
    const ordered = sections.slice()
    const [item] = ordered.splice(index, 1)
    ordered.splice(nextIndex, 0, item)
    setSections(ordered)
    setBusy(true)
    try {
      await reorderHabitSections(ordered.map((section) => section.id))
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
            onPress={() => router.push('/edit-habit-section')}
            style={screen.save}
          >
            <Text style={screen.buttonText}>Add Section</Text>
          </Pressable>
        }
      >
        <Text style={screen.title}>Habit Sections</Text>
        <Text style={screen.muted}>
          Named groups for the Habits day view. Unassigned habits stay under Other habits.
        </Text>
        {error ? <Text style={screen.error}>{error}</Text> : null}
        <View style={screen.card}>
          {sections.length > 0 ? (
            sections.map((section, index) => (
              <View key={section.id} style={[screen.row, index === 0 && screen.rowFirst]}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() =>
                    router.push({ pathname: '/edit-habit-section', params: { id: section.id } })
                  }
                  style={screen.rowMain}
                >
                  <Text style={screen.rowTitle}>{section.name}</Text>
                </Pressable>
                <View style={screen.choiceTrail}>
                  <Pressable
                    accessibilityLabel={`Move ${section.name} up`}
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
                    accessibilityLabel={`Move ${section.name} down`}
                    disabled={index === sections.length - 1 || busy}
                    onPress={() => void move(index, 1)}
                    style={({ pressed }) => [
                      screen.iconActionButton,
                      (pressed || index === sections.length - 1) && screen.buttonDisabled,
                    ]}
                  >
                    <Text style={screen.rowMeta}>↓</Text>
                  </Pressable>
                  <TrashButton onPress={() => setPendingDelete(section)} />
                </View>
              </View>
            ))
          ) : (
            <View style={[screen.row, screen.rowFirst]}>
              <Text style={screen.muted}>No sections yet.</Text>
            </View>
          )}
        </View>
      </Screen>
      <ConfirmModal
        visible={pendingDelete !== null}
        title="Delete section?"
        message={
          pendingDelete
            ? `Remove ${pendingDelete.name}? Habits in it move to Other habits.`
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
