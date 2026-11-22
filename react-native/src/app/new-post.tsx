import * as ImagePicker from 'expo-image-picker'
import { useFocusEffect, useRouter } from 'expo-router'
import { Circle, CircleCheck } from 'lucide-react-native'
import { useCallback, useState } from 'react'
import { Pressable, Text, TextInput, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useAuth } from '../auth/AuthProvider'
import { screen } from '../components/screenStyles'
import { createPost, loadGroups, uploadImage, type Group } from '../lib/gym'


export default function NewPostScreen() {
  const router = useRouter()
  const { session } = useAuth()
  const [body, setBody] = useState('')
  const [imageUri, setImageUri] = useState<string | null>(null)
  const [groups, setGroups] = useState<Group[]>([])
  const [profile, setProfile] = useState(true)
  const [selected, setSelected] = useState<Record<string, boolean>>({})
  const [error, setError] = useState<string | null>(null)

  useFocusEffect(
    useCallback(() => {
      void loadGroups()
        .then(setGroups)
        .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Could not load groups'))
    }, []),
  )

  async function pick() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!permission.granted) {
      setError('Photo access is required to attach a picture')
      return
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 })
    if (!result.canceled) setImageUri(result.assets[0]?.uri ?? null)
  }

  async function save() {
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
      router.back()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not post')
    }
  }

  return (
    <SafeAreaView style={screen.page}>
      <Text style={screen.title}>New post</Text>
      {error ? <Text style={screen.error}>{error}</Text> : null}
      <Text style={screen.label}>Text</Text>
      <TextInput multiline onChangeText={setBody} style={[screen.input, { minHeight: 80 }]} value={body} />
      <Pressable onPress={() => void pick()} style={screen.secondaryButton}>
        <Text style={screen.secondaryButtonText}>{imageUri ? 'Photo chosen' : 'Add a photo'}</Text>
      </Pressable>
      <Text style={screen.muted}>Who can see it</Text>
      <View style={screen.card}>
        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: profile }}
          onPress={() => setProfile((current) => !current)}
          style={({ pressed }) => [
            screen.row,
            screen.rowFirst,
            profile && screen.rowSelected,
            pressed && (profile ? screen.rowSelectedPressed : screen.rowPressed),
          ]}
        >
          <Text style={[screen.rowTitle, profile && screen.rowTitleSelected]}>Profile</Text>
          {profile ? (
            <CircleCheck color="#c2410c" size={20} strokeWidth={2.25} />
          ) : (
            <Circle color="#d6d3d1" size={20} strokeWidth={1.75} />
          )}
        </Pressable>
        {groups.map((group) => {
          const checked = Boolean(selected[group.id])
          return (
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked }}
              key={group.id}
              onPress={() => setSelected((current) => ({ ...current, [group.id]: !current[group.id] }))}
              style={({ pressed }) => [
                screen.row,
                checked && screen.rowSelected,
                pressed && (checked ? screen.rowSelectedPressed : screen.rowPressed),
              ]}
            >
              <Text style={[screen.rowTitle, checked && screen.rowTitleSelected]}>{group.name}</Text>
              {checked ? (
                <CircleCheck color="#c2410c" size={20} strokeWidth={2.25} />
              ) : (
                <Circle color="#d6d3d1" size={20} strokeWidth={1.75} />
              )}
            </Pressable>
          )
        })}
      </View>
      <Pressable onPress={() => void save()} style={screen.save}>
        <Text style={screen.buttonText}>Post</Text>
      </Pressable>
    </SafeAreaView>
  )
}
