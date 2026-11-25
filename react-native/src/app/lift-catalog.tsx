import { useFocusEffect, useRouter } from 'expo-router'
import { useCallback, useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { ConfirmModal } from '../components/ConfirmModal'
import { Screen } from '../components/Screen'
import { Toast, type ToastKind } from '../components/Toast'
import { TrashButton } from '../components/TrashButton'
import { useScreenStyles } from '../theme/ThemeProvider'
import { deleteLift, isLiftInUseError, loadLifts, type Lift } from '../lib/gym'

export default function LiftCatalogScreen() {
  const screen = useScreenStyles()
  const router = useRouter()
  const [lifts, setLifts] = useState<Lift[]>([])
  const [error, setError] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<Lift | null>(null)
  const [toast, setToast] = useState<{ kind: ToastKind; message: string } | null>(null)

  const load = useCallback(async () => {
    try {
      setLifts(await loadLifts())
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load lifts')
    }
  }, [])

  useFocusEffect(
    useCallback(() => {
      void load()
    }, [load]),
  )

  async function confirmDelete() {
    const lift = pendingDelete
    setPendingDelete(null)
    if (!lift) return
    try {
      await deleteLift(lift.id)
      await load()
      setToast({ kind: 'success', message: 'Deleted' })
    } catch (err) {
      if (isLiftInUseError(err)) {
        setToast({ kind: 'error', message: 'Can not delete, first delete all uses' })
      } else {
        setToast({
          kind: 'error',
          message: err instanceof Error ? err.message : 'Could not delete lift',
        })
      }
    }
  }

  return (
    <View style={{ flex: 1 }}>
      <Screen
        footer={
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/new-lift')}
            style={screen.save}
          >
            <Text style={screen.buttonText}>Add New Lift</Text>
          </Pressable>
        }
      >
        <Text style={screen.title}>Lift Catalog</Text>
        {error ? <Text style={screen.error}>{error}</Text> : null}
        <View style={screen.card}>
          {lifts.length > 0 ? (
            lifts.map((lift, index) => (
              <View key={lift.id} style={[screen.row, index === 0 && screen.rowFirst]}>
                <View style={screen.rowMain}>
                  <Text style={screen.rowTitle}>{lift.name}</Text>
                </View>
                <View style={screen.choiceTrail}>
                  <TrashButton onPress={() => setPendingDelete(lift)} />
                </View>
              </View>
            ))
          ) : (
            <View style={[screen.row, screen.rowFirst]}>
              <Text style={screen.muted}>No lifts in the catalog yet.</Text>
            </View>
          )}
        </View>
      </Screen>
      <ConfirmModal
        visible={pendingDelete !== null}
        title="Delete lift?"
        message={pendingDelete ? `Remove ${pendingDelete.name} from the catalog?` : ''}
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
