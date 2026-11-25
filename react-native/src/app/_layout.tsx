import { Stack, useRouter, useSegments } from 'expo-router'
import { useEffect } from 'react'
import { ActivityIndicator, Text, View } from 'react-native'
import { AuthProvider, useAuth } from '../auth/AuthProvider'
import { ThemeProvider, useScreenStyles } from '../theme/ThemeProvider'

function Navigation() {
  const screen = useScreenStyles()
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
      <Stack.Screen name="nutrient-goals" />
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
  return (
    <ThemeProvider>
      <AuthProvider>
        <Navigation />
      </AuthProvider>
    </ThemeProvider>
  )
}
