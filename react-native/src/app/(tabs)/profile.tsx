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
  const [minDrafts, setMinDrafts] = useState<Record<string, string>>({})
  const [maxDrafts, setMaxDrafts] = useState<Record<string, string>>({})
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
      setMinDrafts(
        Object.fromEntries(
          nextNutrients.map((nutrient) => {
            const goal = nextGoals.find((row) => row.nutrient_id === nutrient.id)
            return [nutrient.id, goal?.min_amount != null ? String(goal.min_amount) : '']
          }),
        ),
      )
      setMaxDrafts(
        Object.fromEntries(
          nextNutrients.map((nutrient) => {
            const goal = nextGoals.find((row) => row.nutrient_id === nutrient.id)
            return [nutrient.id, goal?.max_amount != null ? String(goal.max_amount) : '']
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

  function parseBound(raw: string, label: string, nutrientName: string): number | null {
    const trimmed = raw.trim()
    if (!trimmed) return null
    const amount = Number(trimmed)
    if (!(amount > 0)) throw new Error(`${nutrientName} ${label} must be greater than zero`)
    return amount
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
          const min_amount = parseBound(minDrafts[nutrient.id] ?? '', 'min', nutrient.name)
          const max_amount = parseBound(maxDrafts[nutrient.id] ?? '', 'max', nutrient.name)
          if (min_amount != null && max_amount != null && min_amount > max_amount) {
            throw new Error(`${nutrient.name} min cannot be greater than max`)
          }
          return { nutrient_id: nutrient.id, min_amount, max_amount }
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
        <Text style={screen.muted}>Optional min and/or max for the Diet summary bands.</Text>
        <View style={[screen.row, { paddingHorizontal: 4 }]}>
          <Text style={[screen.muted, screen.rowMain]}>Nutrient</Text>
          <Text style={[screen.muted, screen.goalBoundInput]}>Min</Text>
          <Text style={[screen.muted, screen.goalBoundInput]}>Max</Text>
        </View>
        <View style={screen.card}>
          {nutrients.map((nutrient, index) => (
            <View key={nutrient.id} style={[screen.row, index === 0 && screen.rowFirst]}>
              <View style={screen.rowMain}>
                <Text style={screen.rowTitle}>{nutrient.name}</Text>
                <Text style={screen.muted}>{nutrient.unit}</Text>
              </View>
              <AppTextInput
                keyboardType="decimal-pad"
                onChangeText={(value) =>
                  setMinDrafts((current) => ({ ...current, [nutrient.id]: value }))
                }
                placeholder="min"
                style={[screen.input, screen.goalBoundInput]}
                value={minDrafts[nutrient.id] ?? ''}
              />
              <AppTextInput
                keyboardType="decimal-pad"
                onChangeText={(value) =>
                  setMaxDrafts((current) => ({ ...current, [nutrient.id]: value }))
                }
                placeholder="max"
                style={[screen.input, screen.goalBoundInput]}
                value={maxDrafts[nutrient.id] ?? ''}
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
