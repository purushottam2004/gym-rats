import { Image } from 'expo-image'
import { Modal, Pressable, Text, View } from 'react-native'
import { useScreenStyles } from '../theme/ThemeProvider'

type Props = {
  visible: boolean
  imageUri: string | null
  onRetake: () => void
  onContinue: () => void
  onCancel: () => void
  /** Optional third action (e.g. book multi-photo TOC). */
  onTakeMore?: () => void
  takeMoreLabel?: string
  /** Defaults to the Diet food-estimate copy. */
  body?: string
  /** Shown under the title when multiple photos are queued. */
  photoCount?: number
}

export function PhotoConfirmModal({
  visible,
  imageUri,
  onRetake,
  onContinue,
  onCancel,
  onTakeMore,
  takeMoreLabel = 'Take more pictures',
  body = 'We will estimate nutrients and open Other so you can edit before saving.',
  photoCount,
}: Props) {
  const screen = useScreenStyles()
  return (
    <Modal animationType="fade" transparent visible={visible} onRequestClose={onCancel}>
      <View style={screen.modalBackdrop}>
        <View style={screen.confirmCard}>
          <Text style={screen.sectionTitle}>Use this photo?</Text>
          {photoCount != null && photoCount > 1 ? (
            <Text style={screen.muted}>{photoCount} photos ready</Text>
          ) : null}
          <Text style={screen.body}>{body}</Text>
          {imageUri ? (
            <Image
              accessibilityLabel="Captured photo"
              contentFit="cover"
              source={{ uri: imageUri }}
              style={screen.photoConfirmPreview}
            />
          ) : null}
          <View style={{ gap: 10, marginTop: 4 }}>
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
                <Text style={screen.confirmPrimaryText}>Submit</Text>
              </Pressable>
            </View>
            {onTakeMore ? (
              <Pressable
                accessibilityRole="button"
                onPress={onTakeMore}
                style={({ pressed }) => [screen.secondaryButton, pressed && screen.rowPressed]}
              >
                <Text style={screen.secondaryButtonText}>{takeMoreLabel}</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </View>
    </Modal>
  )
}
