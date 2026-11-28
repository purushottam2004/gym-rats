import { useFocusEffect, useRouter } from 'expo-router'
import { Pencil } from 'lucide-react-native'
import { useCallback, useMemo, useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { Avatar } from '../components/Avatar'
import { LoadingBlock } from '../components/BrandLoader'
import { ConfirmModal } from '../components/ConfirmModal'
import { PhotoLightbox } from '../components/PhotoLightbox'
import { Screen } from '../components/Screen'
import { Toast, type ToastKind } from '../components/Toast'
import { TrashButton } from '../components/TrashButton'
import {
  deleteLift,
  isLiftInUseError,
  loadCurrentUserIsAdmin,
  loadLifts,
  loadMuscles,
  type Lift,
  type Muscle,
} from '../lib/gym'
import { liftCatalogGroups } from '../lib/liftCatalog'
import { useScreenStyles, useTheme } from '../theme/ThemeProvider'

export default function LiftCatalogScreen() {
  const screen = useScreenStyles()
  const { colors } = useTheme()
  const router = useRouter()
  const [lifts, setLifts] = useState<Lift[]>([])
  const [muscles, setMuscles] = useState<Muscle[]>([])
  const [isAdmin, setIsAdmin] = useState(false)
  const [hydrated, setHydrated] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<Lift | null>(null)
  const [lightboxLift, setLightboxLift] = useState<Lift | null>(null)
  const [toast, setToast] = useState<{ kind: ToastKind; message: string } | null>(null)

  const load = useCallback(async () => {
    try {
      const [nextLifts, nextMuscles, admin] = await Promise.all([
        loadLifts(),
        loadMuscles(),
        loadCurrentUserIsAdmin(),
      ])
      setLifts(nextLifts)
      setMuscles(nextMuscles)
      setIsAdmin(admin)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load lifts')
    } finally {
      setHydrated(true)
    }
  }, [])

  useFocusEffect(
    useCallback(() => {
      void load()
    }, [load]),
  )

  const groups = useMemo(() => liftCatalogGroups(lifts, muscles), [lifts, muscles])

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
          <View style={{ gap: 10 }}>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push('/manage-muscles')}
              style={screen.save}
            >
              <Text style={screen.buttonText}>Manage Muscles</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push('/new-lift')}
              style={screen.save}
            >
              <Text style={screen.buttonText}>Add New Lift</Text>
            </Pressable>
          </View>
        }
      >
        <Text style={screen.title}>Lift Catalog</Text>
        <Text style={screen.muted}>Lifts grouped by muscle. Unassigned lifts stay under Other lifts.</Text>
        {error ? <Text style={screen.error}>{error}</Text> : null}
        {!hydrated ? (
          <LoadingBlock label="Loading lifts" />
        ) : lifts.length === 0 && muscles.length === 0 ? (
          <View style={screen.card}>
            <View style={[screen.row, screen.rowFirst]}>
              <Text style={screen.muted}>No lifts in the catalog yet.</Text>
            </View>
          </View>
        ) : (
          groups.map((group) => (
            <View key={group.key} style={screen.card}>
              <View style={[screen.row, screen.rowFirst]}>
                <Text style={screen.muted}>{group.title}</Text>
              </View>
              {group.lifts.length > 0 ? (
                group.lifts.map((lift) => (
                  <View key={lift.id} style={screen.row}>
                    <View style={screen.memberRow}>
                      <Pressable
                        accessibilityLabel={
                          lift.image_path
                            ? `View photo for ${lift.name}`
                            : `${lift.name} has no photo`
                        }
                        accessibilityRole="button"
                        disabled={!lift.image_path}
                        hitSlop={4}
                        onPress={() => {
                          if (lift.image_path) {
                            setLightboxLift({
                              id: lift.id,
                              name: lift.name,
                              muscle_id: lift.muscle_id,
                              image_path: lift.image_path,
                            })
                          }
                        }}
                      >
                        <Avatar
                          bucket="lift-images"
                          name={lift.name}
                          path={lift.image_path}
                          size={36}
                        />
                      </Pressable>
                      <Pressable
                        accessibilityRole="button"
                        onPress={() =>
                          router.push({ pathname: '/new-lift', params: { id: lift.id } })
                        }
                        style={screen.rowMain}
                      >
                        <Text style={screen.rowTitle}>{lift.name}</Text>
                      </Pressable>
                    </View>
                    <View style={screen.choiceTrail}>
                      {isAdmin ? (
                        <Pressable
                          accessibilityLabel={`Edit ${lift.name}`}
                          accessibilityRole="button"
                          hitSlop={8}
                          onPress={() =>
                            router.push({ pathname: '/new-lift', params: { id: lift.id } })
                          }
                        >
                          <Pencil color={colors.accent} size={18} strokeWidth={2.25} />
                        </Pressable>
                      ) : null}
                      <TrashButton
                        onPress={() =>
                          setPendingDelete({
                            id: lift.id,
                            name: lift.name,
                            muscle_id: lift.muscle_id,
                            image_path: lift.image_path ?? null,
                          })
                        }
                      />
                    </View>
                  </View>
                ))
              ) : (
                <View style={screen.row}>
                  <Text style={screen.muted}>No lifts in this muscle yet.</Text>
                </View>
              )}
            </View>
          ))
        )}
      </Screen>
      <ConfirmModal
        visible={pendingDelete !== null}
        title="Delete lift?"
        message={pendingDelete ? `Remove ${pendingDelete.name} from the catalog?` : ''}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => void confirmDelete()}
      />
      <PhotoLightbox
        visible={lightboxLift !== null}
        bucket="lift-images"
        name={lightboxLift?.name}
        path={lightboxLift?.image_path}
        onClose={() => setLightboxLift(null)}
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
