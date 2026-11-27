import * as ImagePicker from 'expo-image-picker'
import { useFocusEffect, useRouter } from 'expo-router'
import { Circle, CircleCheck } from 'lucide-react-native'
import { useCallback, useRef, useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { AppTextInput } from '../components/AppTextInput'
import { BusyOverlay } from '../components/BrandLoader'
import { Toast, type ToastKind } from '../components/Toast'
import { useAuth } from '../auth/AuthProvider'
import { Screen } from '../components/Screen'
import { useScreenStyles, useTheme } from '../theme/ThemeProvider'
import { createPost, loadGroups, uploadImage, type Group } from '../lib/gym'

export default function NewPostScreen() {
  const screen = useScreenStyles()
  const { colors } = useTheme()
  const router = useRouter()
  const { session } = useAuth()
  const [body, setBody] = useState('')
  const [imageUri, setImageUri] = useState<string | null>(null)
  const [groups, setGroups] = useState<Group[]>([])
  const [profile, setProfile] = useState(true)
  const [selected, setSelected] = useState<Record<string, boolean>>({})
  const [busy, setBusy] = useState(false)
  const busyRef = useRef(false)
  const [toast, setToast] = useState<{ kind: ToastKind; message: string } | null>(null)

  useFocusEffect(
    useCallback(() => {
      void loadGroups()
        .then(setGroups)
        .catch((err: unknown) =>
          setToast({
            kind: 'error',
            message: err instanceof Error ? err.message : 'Could not load groups',
          }),
        )
    }, []),
  )

  async function pick() {
    if (busy) return
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!permission.granted) {
      setToast({ kind: 'error', message: 'Photo access is required to attach a picture' })
      return
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 })
    if (!result.canceled) setImageUri(result.assets[0]?.uri ?? null)
  }

  async function save() {
    // Ref blocks double-taps before React re-renders the disabled button.
    if (busyRef.current) return
    busyRef.current = true
    setBusy(true)
    try {
      const userId = session?.user.id
      if (!userId) throw new Error('Not signed in')
      const imagePath = imageUri ? await uploadImage('post-images', userId, imageUri) : null
      await createPost({
        body,
        imagePath,
        profile,
        groupIds: groups.filter((group) => selected[group.id]).map((group) => group.id),
      })
      setBusy(false)
      busyRef.current = false
      setToast({ kind: 'success', message: 'Posted' })
      setTimeout(() => {
        router.back()
      }, 600)
    } catch (err) {
      setBusy(false)
      busyRef.current = false
      setToast({
        kind: 'error',
        message: err instanceof Error ? err.message : 'Could not post',
      })
    }
  }

  return (
    <View style={{ flex: 1 }}>
      <Screen>
        <Text style={screen.title}>New post</Text>
        <Text style={screen.label}>Text</Text>
        <AppTextInput
          editable={!busy}
          multiline
          onChangeText={setBody}
          style={[screen.input, { minHeight: 80 }]}
          value={body}
        />
        <Pressable
          disabled={busy}
          onPress={() => void pick()}
          style={[screen.secondaryButton, busy && screen.buttonDisabled]}
        >
          <Text style={screen.secondaryButtonText}>{imageUri ? 'Photo chosen' : 'Add a photo'}</Text>
        </Pressable>
        <Text style={screen.muted}>Who can see it</Text>
        <Text style={screen.body}>
          Profile shares with people in any of your groups. A group-only post is visible only to
          members of that group.
        </Text>
        <View style={screen.card}>
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: profile }}
            disabled={busy}
            onPress={() => setProfile((current) => !current)}
            style={({ pressed }) => [
              screen.row,
              screen.rowFirst,
              profile && screen.rowSelected,
              pressed && (profile ? screen.rowSelectedPressed : screen.rowPressed),
              busy && screen.buttonDisabled,
            ]}
          >
            <Text style={[screen.rowTitle, profile && screen.rowTitleSelected]}>Profile</Text>
            {profile ? (
              <CircleCheck color={colors.accent} size={20} strokeWidth={2.25} />
            ) : (
              <Circle color={colors.border} size={20} strokeWidth={1.75} />
            )}
          </Pressable>
          {groups.map((group) => {
            const checked = Boolean(selected[group.id])
            return (
              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked }}
                disabled={busy}
                key={group.id}
                onPress={() =>
                  setSelected((current) => ({ ...current, [group.id]: !current[group.id] }))
                }
                style={({ pressed }) => [
                  screen.row,
                  checked && screen.rowSelected,
                  pressed && (checked ? screen.rowSelectedPressed : screen.rowPressed),
                  busy && screen.buttonDisabled,
                ]}
              >
                <Text style={[screen.rowTitle, checked && screen.rowTitleSelected]}>{group.name}</Text>
                {checked ? (
                  <CircleCheck color={colors.accent} size={20} strokeWidth={2.25} />
                ) : (
                  <Circle color={colors.border} size={20} strokeWidth={1.75} />
                )}
              </Pressable>
            )
          })}
        </View>
        <Pressable
          accessibilityRole="button"
          disabled={busy}
          onPress={() => void save()}
          style={[screen.save, busy && screen.buttonDisabled]}
        >
          <Text style={screen.buttonText}>Post</Text>
        </Pressable>
      </Screen>
      <BusyOverlay visible={busy} label="Posting…" />
      <Toast
        visible={toast != null}
        kind={toast?.kind ?? 'error'}
        message={toast?.message ?? ''}
        onHide={() => setToast(null)}
      />
    </View>
  )
}
