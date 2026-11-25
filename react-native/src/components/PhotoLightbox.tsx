import { Modal, Pressable, Text, View } from 'react-native'
import { Avatar } from './Avatar'
import { useScreenStyles } from '../theme/ThemeProvider'

type Props = {
  visible: boolean
  name?: string | null
  path?: string | null
  bucket?: 'avatars' | 'group-avatars'
  onClose: () => void
}

/** Full-screen photo peek (WhatsApp-style). Tap anywhere to dismiss. */
export function PhotoLightbox({
  visible,
  name,
  path,
  bucket = 'avatars',
  onClose,
}: Props) {
  const screen = useScreenStyles()
  return (
    <Modal animationType="fade" transparent visible={visible} onRequestClose={onClose}>
      <Pressable
        accessibilityLabel="Close photo"
        accessibilityRole="button"
        onPress={onClose}
        style={screen.photoLightboxBackdrop}
      >
        <View style={screen.photoLightboxBody}>
          <Avatar bucket={bucket} name={name} path={path} size={220} />
          {name ? <Text style={screen.photoLightboxName}>{name}</Text> : null}
        </View>
      </Pressable>
    </Modal>
  )
}
