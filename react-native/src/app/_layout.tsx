import { Stack, useRouter, useSegments } from 'expo-router'
import { useEffect } from 'react'
import { ActivityIndicator, Platform, Text, View } from 'react-native'
import { AuthProvider, useAuth } from '../auth/AuthProvider'
import { PLACEHOLDER_COLOR } from '../components/AppTextInput'
import { screen } from '../components/screenStyles'

const WEB_PLACEHOLDER_STYLE_ID = 'gym-rats-placeholder-style'

function ensureWebPlaceholderStyles() {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return
  if (document.getElementById(WEB_PLACEHOLDER_STYLE_ID)) return
  const style = document.createElement('style')
  style.id = WEB_PLACEHOLDER_STYLE_ID
  style.textContent = `
    input::placeholder,
    textarea::placeholder {
      color: ${PLACEHOLDER_COLOR} !important;
      font-style: italic !important;
      opacity: 1;
    }
  `
  document.head.appendChild(style)
}

function Navigation() {
  const { ready, session, configError } = useAuth()
  const segments = useSegments()
  const router = useRouter()

  useEffect(() => {
    if (!ready || configError) return
    const onLogin = segments[0] === 'login'
    const onScrollSmoke = __DEV__ && segments[0] === 'scroll-smoke'
    const onChromePreview = __DEV__ && segments[0] === 'chrome-preview'
    if (!session && !onLogin && !onScrollSmoke && !onChromePreview) router.replace('/login')
    if (session && onLogin) router.replace('/diet')
  }, [ready, session, configError, segments, router])

  if (!ready) {
    return (
      <View style={screen.centered}>
        <ActivityIndicator />
      </View>
    )
  }

  if (configError) {
    return (
      <View style={screen.centered}>
        <Text style={screen.error}>{configError}</Text>
      </View>
    )
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="login" />
      <Stack.Screen name="scroll-smoke" />
      <Stack.Screen name="chrome-preview" />
      <Stack.Screen name="index" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="add-food" />
      <Stack.Screen name="food-catalog" />
      <Stack.Screen name="new-food" />
      <Stack.Screen name="add-set" />
      <Stack.Screen name="lift-catalog" />
      <Stack.Screen name="weekday-lifts" />
      <Stack.Screen name="new-lift" />
      <Stack.Screen name="new-group" />
      <Stack.Screen name="new-post" />
      <Stack.Screen name="edit-name" />
      <Stack.Screen name="edit-photo" />
      <Stack.Screen name="group/[id]" />
      <Stack.Screen name="member/[id]" />
    </Stack>
  )
}

export default function RootLayout() {
  useEffect(() => {
    ensureWebPlaceholderStyles()
  }, [])

  return (
    <AuthProvider>
      <Navigation />
    </AuthProvider>
  )
}
