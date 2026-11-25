import * as ImagePicker from 'expo-image-picker'
import { useFocusEffect, useRouter } from 'expo-router'
import { Pencil, UserRound } from 'lucide-react-native'
import { useCallback, useState } from 'react'
import { Image, Pressable, Text, View } from 'react-native'
import { useAuth } from '../../auth/AuthProvider'
import { AppTextInput } from '../../components/AppTextInput'
import { Screen } from '../../components/Screen'
import { TabChrome } from '../../components/TabChrome'
import { screen } from '../../components/screenStyles'
import { loadProfile, publicImageUrl, saveAvatarPath, saveDisplayName, uploadImage, type Profile } from '../../lib/gym'

export default function ProfileScreen() {
  const { session, signOut } = useAuth()
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
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

  const photo = publicImageUrl('avatars', profile?.avatar_path ?? null)

  return (
    <Screen header={<TabChrome icon={UserRound} title="Profile" />}>
      {error ? <Text style={screen.error}>{error}</Text> : null}
      <View style={{ alignItems: 'center', gap: 8 }}>
        <Pressable
          accessibilityLabel="Update profile photo"
          accessibilityRole="button"
          disabled={photoBusy}
          onPress={() => void pickPhoto()}
          style={photoBusy ? screen.buttonDisabled : undefined}
        >
          {photo ? (
            <Image source={{ uri: photo }} style={{ width: 84, height: 84, borderRadius: 42 }} />
          ) : (
            <View style={{ width: 84, height: 84, borderRadius: 42, backgroundColor: '#e7e5e4' }} />
          )}
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
              <Pencil color="#c2410c" size={18} strokeWidth={2.25} />
            </Pressable>
          </View>
        )}
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
    </Screen>
  )
}
