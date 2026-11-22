import { useState } from 'react'
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useAuth } from '../auth/AuthProvider'

export default function LoginScreen() {
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSignIn() {
    setLoading(true)
    setError(null)
    if (!email.trim() || !password) {
      setError('Enter the email and password you were given.')
      setLoading(false)
      return
    }
    try {
      const message = await signIn(email.trim(), password)
      if (message) setError(message)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not sign in.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <SafeAreaView style={styles.page}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.fill}
      >
        <View style={styles.block}>
          <Text style={styles.mark}>Gym Rats</Text>
          <Text style={styles.lead}>Sign in with the email and password you were given.</Text>
          <View style={styles.card}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              onChangeText={setEmail}
              placeholder="you@email.com"
              placeholderTextColor="#a8a29e"
              style={styles.input}
              textContentType="username"
              value={email}
            />
            <Text style={styles.label}>Password</Text>
            <TextInput
              autoCapitalize="none"
              onChangeText={setPassword}
              placeholder="Password"
              placeholderTextColor="#a8a29e"
              secureTextEntry
              style={styles.input}
              textContentType="password"
              value={password}
            />
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Pressable
              accessibilityRole="button"
              disabled={loading}
              onPress={() => void handleSignIn()}
              style={[styles.button, loading && styles.buttonDisabled]}
            >
              <Text style={styles.buttonText}>{loading ? 'Signing in' : 'Sign in'}</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: '#f5f5f4',
  },
  fill: {
    flex: 1,
  },
  block: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingBottom: 32,
  },
  mark: {
    fontSize: 40,
    fontWeight: '700',
    letterSpacing: -1,
    color: '#1c1917',
  },
  lead: {
    marginTop: 8,
    maxWidth: 280,
    fontSize: 16,
    lineHeight: 22,
    color: '#78716c',
  },
  card: {
    marginTop: 28,
    padding: 16,
    borderRadius: 20,
    backgroundColor: '#ffffff',
    gap: 8,
  },
  label: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: '600',
    color: '#78716c',
  },
  input: {
    borderRadius: 12,
    backgroundColor: '#fafaf9',
    borderWidth: 1,
    borderColor: '#e7e5e4',
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 17,
    color: '#1c1917',
  },
  error: {
    marginTop: 4,
    fontSize: 14,
    lineHeight: 20,
    color: '#b91c1c',
  },
  button: {
    marginTop: 8,
    borderRadius: 14,
    backgroundColor: '#1c1917',
    paddingVertical: 16,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.45,
  },
  buttonText: {
    color: '#fafaf9',
    fontSize: 17,
    fontWeight: '600',
  },
})
