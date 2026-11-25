import { Modal, Pressable, Text, View } from 'react-native'
import { AppTextInput } from './AppTextInput'
import { BrandLoader } from './BrandLoader'
import { useScreenStyles } from '../theme/ThemeProvider'

type Props = {
  visible: boolean
  code: string
  busy?: boolean
  error?: string | null
  onChangeCode: (value: string) => void
  onJoin: () => void
  onCancel: () => void
}

export function JoinGroupModal({
  visible,
  code,
  busy = false,
  error,
  onChangeCode,
  onJoin,
  onCancel,
}: Props) {
  const screen = useScreenStyles()
  return (
    <Modal animationType="fade" transparent visible={visible} onRequestClose={onCancel}>
      <View style={screen.modalBackdrop}>
        <View style={screen.confirmCard}>
          <Text style={screen.sectionTitle}>Join group</Text>
          <Text style={screen.body}>Enter an invite code to join.</Text>
          <AppTextInput
            autoCapitalize="characters"
            autoFocus
            editable={!busy}
            onChangeText={onChangeCode}
            placeholder="Invite code"
            style={screen.input}
            value={code}
          />
          {error ? <Text style={screen.error}>{error}</Text> : null}
          <View style={screen.confirmActions}>
            <Pressable
              accessibilityRole="button"
              disabled={busy}
              onPress={onCancel}
              style={({ pressed }) => [screen.confirmCancel, pressed && screen.rowPressed]}
            >
              <Text style={screen.secondaryButtonText}>Cancel</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={busy || code.trim().length === 0}
              onPress={onJoin}
              style={({ pressed }) => [
                screen.confirmPrimary,
                (busy || code.trim().length === 0) && screen.buttonDisabled,
                pressed && screen.rowPressed,
              ]}
            >
              {busy ? (
                <BrandLoader size="sm" />
              ) : (
                <Text style={screen.confirmPrimaryText}>Join</Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  )
}
