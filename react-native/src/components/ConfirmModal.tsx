import { Modal, Pressable, Text, View } from 'react-native'
import { screen } from './screenStyles'

type Props = {
  visible: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmModal({
  visible,
  title,
  message,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
}: Props) {
  return (
    <Modal animationType="fade" transparent visible={visible} onRequestClose={onCancel}>
      <View style={screen.modalBackdrop}>
        <View style={screen.confirmCard}>
          <Text style={screen.sectionTitle}>{title}</Text>
          <Text style={screen.body}>{message}</Text>
          <View style={screen.confirmActions}>
            <Pressable
              accessibilityRole="button"
              onPress={onCancel}
              style={({ pressed }) => [screen.confirmCancel, pressed && screen.rowPressed]}
            >
              <Text style={screen.secondaryButtonText}>{cancelLabel}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={onConfirm}
              style={({ pressed }) => [screen.confirmDelete, pressed && screen.rowPressed]}
            >
              <Text style={screen.leaveText}>{confirmLabel}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  )
}
