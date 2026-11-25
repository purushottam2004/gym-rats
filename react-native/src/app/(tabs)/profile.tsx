import * as ImagePicker from 'expo-image-picker'
import { useFocusEffect, useRouter } from 'expo-router'
import { Pencil, UserRound } from 'lucide-react-native'
import { useCallback, useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { useAuth } from '../../auth/AuthProvider'
import { AppTextInput } from '../../components/AppTextInput'
import { Avatar } from '../../components/Avatar'
import { BusyOverlay, LoadingBlock } from '../../components/BrandLoader'
import { Screen } from '../../components/Screen'
import { TabChrome } from '../../components/TabChrome'
import type { AppearancePreference } from '../../theme/appearancePreference'
import { useScreenStyles, useTheme } from '../../theme/ThemeProvider'
import { loadProfile, saveAvatarPath, saveDisplayName, uploadImage, type Profile } from '../../lib/gym'

const APPEARANCE_OPTIONS: { value: AppearancePreference; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' },
]

export default function ProfileScreen() {
  const screen = useScreenStyles()
  const { colors, preference, setPreference } = useTheme()
  const { session, signOut } = useAuth()
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [hydrated, setHydrated] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editingName, setEditingName] = useState(false)
  const [nameDraft, setNameDraft] = useState('')
  const [photoBusy, setPhotoBusy] = useState(false)

  const load = useCallback(async () => {
    const userId = session?.user.id
    if (!userId) return
    try {
      const nextProfile = await loadProfile(userId)
      setProfile(nextProfile)
      setNameDraft(nextProfile.display_name ?? '')
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load profile')
    } finally {
      setHydrated(true)
    }
  }, [session])

  useFocusEffect(
    useCallback(() => {
      void load()
    }, [load]),
  )

  async function pickPhoto() {
    const userId = session?.user.id
    if (!userId || photoBusy) return
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!permission.granted) {
      setError('Photo access is required')
      return
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 })
    if (result.canceled || !result.assets[0]) return
    setPhotoBusy(true)
    setError(null)
    try {
      const path = await uploadImage('avatars', userId, result.assets[0].uri)
      await saveAvatarPath(userId, path)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save photo')
    } finally {
      setPhotoBusy(false)
    }
  }

  async function saveName() {
    const userId = session?.user.id
    if (!userId) return
    try {
      await saveDisplayName(userId, nameDraft)
      setEditingName(false)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save name')
    }
  }

  return (
    <Screen header={<TabChrome icon={UserRound} title="Profile" />}>
      {error ? <Text style={screen.error}>{error}</Text> : null}
      {!hydrated ? (
        <LoadingBlock label="Loading profile" />
      ) : (
        <>
          <View style={{ alignItems: 'center', gap: 8 }}>
            <Pressable
              accessibilityLabel="Update profile photo"
              accessibilityRole="button"
              disabled={photoBusy}
              onPress={() => void pickPhoto()}
              style={photoBusy ? screen.buttonDisabled : undefined}
            >
              <Avatar name={profile?.display_name} path={profile?.avatar_path} size={84} />
            </Pressable>
            {editingName ? (
              <View style={screen.nameEditRow}>
                <AppTextInput
                  autoFocus
                  onChangeText={setNameDraft}
                  onSubmitEditing={() => void saveName()}
                  style={screen.nameEditInput}
                  value={nameDraft}
                />
                <Pressable onPress={() => void saveName()}>
                  <Text style={screen.addText}>Save</Text>
                </Pressable>
              </View>
            ) : (
              <View style={screen.nameEditRow}>
                <Text style={screen.sectionTitle}>{profile?.display_name ?? 'Add a name'}</Text>
                <Pressable
                  accessibilityLabel="Edit name"
                  accessibilityRole="button"
                  hitSlop={8}
                  onPress={() => {
                    setNameDraft(profile?.display_name ?? '')
                    setEditingName(true)
                  }}
                >
                  <Pencil color={colors.accent} size={18} strokeWidth={2.25} />
                </Pressable>
              </View>
            )}
          </View>

          <Text style={screen.label}>Appearance</Text>
          <View style={screen.card}>
            {APPEARANCE_OPTIONS.map((option, index) => {
              const selected = preference === option.value
              return (
                <Pressable
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  key={option.value}
                  onPress={() => setPreference(option.value)}
                  style={({ pressed }) => [
                    screen.row,
                    index === 0 && screen.rowFirst,
                    selected && screen.rowSelected,
                    pressed && (selected ? screen.rowSelectedPressed : screen.rowPressed),
                  ]}
                >
                  <Text style={[screen.rowTitle, selected && screen.rowTitleSelected]}>
                    {option.label}
                  </Text>
                  {selected ? <Text style={screen.addText}>Selected</Text> : null}
                </Pressable>
              )
            })}
          </View>

          <View style={screen.card}>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push('/nutrient-goals')}
              style={({ pressed }) => [screen.row, screen.rowFirst, pressed && screen.rowPressed]}
            >
              <Text style={screen.rowTitle}>Nutrient goals</Text>
              <Text style={screen.addText}>Edit</Text>
            </Pressable>
            <Pressable onPress={() => void signOut()} style={screen.row}>
              <Text style={screen.rowTitle}>Sign out</Text>
            </Pressable>
          </View>
          <Text style={screen.muted}>{session?.user.email}</Text>
        </>
      )}
      <BusyOverlay visible={photoBusy} label="Updating photo…" />
    </Screen>
  )
}
