import * as ImagePicker from 'expo-image-picker'
import { useFocusEffect } from 'expo-router'
import { Pencil, UserRound } from 'lucide-react-native'
import { useCallback, useState } from 'react'
import { Image, Pressable, Text, View } from 'react-native'
import { useAuth } from '../../auth/AuthProvider'
import { AppTextInput } from '../../components/AppTextInput'
import { Screen } from '../../components/Screen'
import { TabChrome } from '../../components/TabChrome'
import { screen } from '../../components/screenStyles'
import {
  loadNutrientGoals,
  loadNutrients,
  loadProfile,
  publicImageUrl,
  saveAvatarPath,
  saveDisplayName,
  saveNutrientGoals,
  uploadImage,
  type Nutrient,
  type Profile,
} from '../../lib/gym'

export default function ProfileScreen() {
  const { session, signOut } = useAuth()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [editingName, setEditingName] = useState(false)
  const [nameDraft, setNameDraft] = useState('')
  const [photoBusy, setPhotoBusy] = useState(false)
  const [nutrients, setNutrients] = useState<Nutrient[]>([])
  const [goalDrafts, setGoalDrafts] = useState<Record<string, string>>({})
  const [goalsBusy, setGoalsBusy] = useState(false)

  const load = useCallback(async () => {
    const userId = session?.user.id
    if (!userId) return
    try {
      const [nextProfile, nextNutrients, nextGoals] = await Promise.all([
        loadProfile(userId),
        loadNutrients(),
        loadNutrientGoals(userId),
      ])
      setProfile(nextProfile)
      setNameDraft(nextProfile.display_name ?? '')
      setNutrients(nextNutrients)
      setGoalDrafts(
        Object.fromEntries(
          nextNutrients.map((nutrient) => {
            const goal = nextGoals.find((row) => row.nutrient_id === nutrient.id)
            return [nutrient.id, goal ? String(goal.amount) : '']
          }),
        ),
      )
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

  async function saveGoals() {
    const userId = session?.user.id
    if (!userId || goalsBusy) return
    setGoalsBusy(true)
    setError(null)
    try {
      await saveNutrientGoals(
        userId,
        nutrients.map((nutrient) => {
          const raw = goalDrafts[nutrient.id]?.trim() ?? ''
          if (!raw) return { nutrient_id: nutrient.id, amount: null }
          const amount = Number(raw)
          if (!(amount > 0)) throw new Error(`${nutrient.name} goal must be greater than zero`)
          return { nutrient_id: nutrient.id, amount }
        }),
      )
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save goals')
    } finally {
      setGoalsBusy(false)
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

      <View style={screen.section}>
        <Text style={screen.sectionTitle}>Daily nutrient goals</Text>
        <Text style={screen.muted}>Optional targets for the Diet summary progress fill.</Text>
        <View style={screen.card}>
          {nutrients.map((nutrient, index) => (
            <View key={nutrient.id} style={[screen.row, index === 0 && screen.rowFirst]}>
              <Text style={[screen.rowTitle, screen.rowMain]}>{nutrient.name}</Text>
              <AppTextInput
                keyboardType="decimal-pad"
                onChangeText={(value) =>
                  setGoalDrafts((current) => ({ ...current, [nutrient.id]: value }))
                }
                placeholder={nutrient.unit}
                style={[screen.input, { width: 96, paddingVertical: 6 }]}
                value={goalDrafts[nutrient.id] ?? ''}
              />
            </View>
          ))}
        </View>
        <Pressable
          disabled={goalsBusy}
          onPress={() => void saveGoals()}
          style={({ pressed }) => [screen.save, goalsBusy && screen.buttonDisabled, pressed && screen.rowPressed]}
        >
          <Text style={screen.buttonText}>{goalsBusy ? 'Saving' : 'Save goals'}</Text>
        </Pressable>
      </View>

      <View style={screen.card}>
        <Pressable onPress={() => void signOut()} style={[screen.row, screen.rowFirst]}>
          <Text style={screen.rowTitle}>Sign out</Text>
        </Pressable>
      </View>
      <Text style={screen.muted}>{session?.user.email}</Text>
    </Screen>
  )
}
