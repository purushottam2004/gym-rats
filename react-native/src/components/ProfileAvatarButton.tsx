import { useFocusEffect, useRouter } from 'expo-router'
import { useCallback, useState } from 'react'
import { Pressable, StyleSheet } from 'react-native'
import { useAuth } from '../auth/AuthProvider'
import { loadProfile, type Profile } from '../lib/gym'
import { Avatar } from './Avatar'

/** Trailing chrome control — opens Profile (moved off the tab bar). */
export function ProfileAvatarButton() {
  const router = useRouter()
  const { session } = useAuth()
  const [profile, setProfile] = useState<Profile | null>(null)

  useFocusEffect(
    useCallback(() => {
      const userId = session?.user.id
      if (!userId) return
      void loadProfile(userId)
        .then(setProfile)
        .catch(() => setProfile(null))
    }, [session?.user.id]),
  )

  return (
    <Pressable
      accessibilityLabel="Open profile"
      accessibilityRole="button"
      hitSlop={6}
      onPress={() => router.push('/profile')}
      style={styles.hit}
    >
      <Avatar name={profile?.display_name} path={profile?.avatar_path} size={28} />
    </Pressable>
  )
}

const styles = StyleSheet.create({
  hit: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
