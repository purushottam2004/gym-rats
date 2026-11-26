import { Image } from 'expo-image'
import { Modal, Pressable, Text, View } from 'react-native'
import { useScreenStyles } from '../theme/ThemeProvider'

type Props = {
  visible: boolean
  imageUri: string | null
  onRetake: () => void
  onContinue: () => void
  onCancel: () => void
}

export function PhotoConfirmModal({ visible, imageUri, onRetake, onContinue, onCancel }: Props) {
  const screen = useScreenStyles()
  return (
    <Modal animationType="fade" transparent visible={visible} onRequestClose={onCancel}>
      <View style={screen.modalBackdrop}>
        <View style={screen.confirmCard}>
          <Text style={screen.sectionTitle}>Use this photo?</Text>
          <Text style={screen.body}>We will estimate nutrients and open Other so you can edit before saving.</Text>
          {imageUri ? (
            <Image
              accessibilityLabel="Captured food photo"
              contentFit="cover"
              source={{ uri: imageUri }}
              style={screen.photoConfirmPreview}
            />
          ) : null}
          <View style={screen.confirmActions}>
            <Pressable
              accessibilityRole="button"
              onPress={onRetake}
              style={({ pressed }) => [screen.confirmCancel, pressed && screen.rowPressed]}
            >
              <Text style={screen.secondaryButtonText}>Retake</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={onContinue}
              style={({ pressed }) => [screen.confirmPrimary, pressed && screen.rowPressed]}
            >
              <Text style={screen.confirmPrimaryText}>Continue</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  )
}
