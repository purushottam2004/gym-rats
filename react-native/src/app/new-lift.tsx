import * as ImagePicker from 'expo-image-picker'
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router'
import { Circle, CircleCheck, Pencil } from 'lucide-react-native'
import { useCallback, useMemo, useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { AppTextInput } from '../components/AppTextInput'
import { Avatar } from '../components/Avatar'
import { BrandLoader, BusyOverlay, LoadingBlock } from '../components/BrandLoader'
import { PhotoLightbox } from '../components/PhotoLightbox'
import { Screen } from '../components/Screen'
import { Toast, type ToastKind } from '../components/Toast'
import {
  createLift,
  loadCurrentUserIsAdmin,
  loadLifts,
  loadMuscles,
  saveLiftImagePath,
  updateLiftMuscle,
  updateLiftName,
  uploadImage,
  type Muscle,
} from '../lib/gym'
import { useScreenStyles, useTheme } from '../theme/ThemeProvider'

type MuscleChoice = { id: string | null; name: string }

export default function NewLiftScreen() {
  const screen = useScreenStyles()
  const { colors } = useTheme()
  const router = useRouter()
  const params = useLocalSearchParams<{ id?: string }>()
  const id = typeof params.id === 'string' ? params.id : undefined
  const editing = Boolean(id)

  const [name, setName] = useState('')
  const [savedName, setSavedName] = useState('')
  const [muscleId, setMuscleId] = useState<string | null>(null)
  const [imagePath, setImagePath] = useState<string | null>(null)
  const [muscles, setMuscles] = useState<Muscle[]>([])
  const [isAdmin, setIsAdmin] = useState(false)
  const [nameEditable, setNameEditable] = useState(false)
  const [loaded, setLoaded] = useState(!editing)
  const [busy, setBusy] = useState(false)
  const [photoBusy, setPhotoBusy] = useState(false)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<{ kind: ToastKind; message: string } | null>(null)

  const load = useCallback(async () => {
    try {
      const [nextMuscles, admin] = await Promise.all([
        loadMuscles(),
        loadCurrentUserIsAdmin(),
      ])
      setMuscles(nextMuscles)
      setIsAdmin(admin)
      if (id) {
        const lifts = await loadLifts()
        const lift = lifts.find((row) => row.id === id)
        if (!lift) {
          setError('Lift not found')
          setLoaded(true)
          return
        }
        setName(lift.name)
        setSavedName(lift.name)
        setMuscleId(lift.muscle_id)
        setImagePath(lift.image_path)
        setNameEditable(false)
      } else {
        setNameEditable(true)
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

  const muscleChoices = useMemo<MuscleChoice[]>(
    () => [{ id: null, name: 'Other lifts' }, ...muscles.map((m) => ({ id: m.id, name: m.name }))],
    [muscles],
  )

  async function save() {
    const trimmed = name.trim()
    if (!trimmed) {
      setError('A lift needs a name')
      return
    }
    setBusy(true)
    setError(null)
    try {
      if (editing && id) {
        if (isAdmin && trimmed !== savedName) {
          await updateLiftName({ id, name: trimmed })
        }
        await updateLiftMuscle({ id, muscleId })
      } else {
        await createLift({ name: trimmed, muscleId })
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

  async function changePhoto() {
    if (!editing || !id || photoBusy) return
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!permission.granted) {
      setError('Photo access is required')
      return
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    })
    if (result.canceled || !result.assets[0]) return
    setPhotoBusy(true)
    setError(null)
    try {
      const path = await uploadImage('lift-images', id, result.assets[0].uri)
      await saveLiftImagePath(id, path)
      setImagePath(path)
      setToast({ kind: 'success', message: 'Photo updated' })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update photo')
    } finally {
      setPhotoBusy(false)
    }
  }

  if (!loaded) {
    return (
      <Screen>
        <LoadingBlock label="Loading lift" />
      </Screen>
    )
  }

  const canEditName = !editing || (isAdmin && nameEditable)

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
            ? isAdmin
              ? 'Tap the pencil to rename. Change the muscle to move this lift in the catalog.'
              : 'Name is fixed. Change the muscle to move this lift in the catalog.'
            : 'Shared catalog. An Admin can rename later; anyone can change the muscle.'}
        </Text>
        {error ? <Text style={screen.error}>{error}</Text> : null}

        {editing ? (
          <View style={screen.liftPhotoHeader}>
            <Pressable
              accessibilityLabel={imagePath ? `View photo for ${name}` : `${name} has no photo`}
              accessibilityRole="button"
              disabled={!imagePath}
              onPress={() => {
                if (imagePath) setLightboxOpen(true)
              }}
            >
              <Avatar bucket="lift-images" name={name} path={imagePath} size={96} />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={photoBusy}
              onPress={() => void changePhoto()}
              style={({ pressed }) => [
                screen.button,
                photoBusy && screen.buttonDisabled,
                pressed && screen.rowPressed,
                { alignSelf: 'stretch' },
              ]}
            >
              {photoBusy ? (
                <BrandLoader size="sm" />
              ) : (
                <Text style={screen.buttonText}>{imagePath ? 'Change photo' : 'Add photo'}</Text>
              )}
            </Pressable>
          </View>
        ) : null}

        <Text style={screen.label}>Name</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          {editing && isAdmin ? (
            <Pressable
              accessibilityLabel="Edit lift name"
              accessibilityRole="button"
              hitSlop={8}
              onPress={() => setNameEditable(true)}
            >
              <Pencil color={colors.accent} size={18} strokeWidth={2.25} />
            </Pressable>
          ) : null}
          <AppTextInput
            editable={canEditName}
            onChangeText={setName}
            style={[
              screen.input,
              { flex: 1 },
              editing && !canEditName && screen.buttonDisabled,
            ]}
            value={name}
          />
        </View>

        <Text style={screen.label}>Muscle</Text>
        <View style={[screen.card, { padding: 0, overflow: 'hidden' }]}>
          <View style={screen.choiceGrid}>
            {muscleChoices.map((choice) => {
              const selected = muscleId === choice.id
              return (
                <Pressable
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  key={choice.id ?? '__other__'}
                  onPress={() => setMuscleId(choice.id)}
                  style={({ pressed }) => [
                    screen.choiceGridCell,
                    selected && screen.choiceGridCellSelected,
                    pressed && (selected ? screen.rowSelectedPressed : screen.rowPressed),
                  ]}
                >
                  <Text
                    numberOfLines={2}
                    style={[
                      screen.rowTitle,
                      { flex: 1, fontSize: 15 },
                      selected && screen.rowTitleSelected,
                    ]}
                  >
                    {choice.name}
                  </Text>
                  {selected ? (
                    <CircleCheck color={colors.accent} size={18} strokeWidth={2.25} />
                  ) : (
                    <Circle color={colors.border} size={18} strokeWidth={1.75} />
                  )}
                </Pressable>
              )
            })}
          </View>
        </View>
      </Screen>
      <PhotoLightbox
        visible={lightboxOpen}
        bucket="lift-images"
        name={name}
        path={imagePath}
        onClose={() => setLightboxOpen(false)}
      />
      <Toast
        visible={toast !== null}
        kind={toast?.kind ?? 'success'}
        message={toast?.message ?? ''}
        onHide={() => setToast(null)}
      />
      <BusyOverlay visible={photoBusy} label="Updating photo…" />
    </View>
  )
}
