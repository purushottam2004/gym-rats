import { Dimensions, Image, Modal, Pressable, Text, View } from 'react-native'
import { Avatar } from './Avatar'
import { useScreenStyles } from '../theme/ThemeProvider'

type Props = {
  visible: boolean
  name?: string | null
  path?: string | null
  bucket?: 'avatars' | 'group-avatars' | 'lift-images'
  /** Full-bleed image URL (e.g. post photo). When set, Avatar path/bucket are ignored. */
  imageUri?: string | null
  onClose: () => void
}

/** Full-screen photo peek (WhatsApp-style). Tap anywhere to dismiss. */
export function PhotoLightbox({
  visible,
  name,
  path,
  bucket = 'avatars',
  imageUri,
  onClose,
}: Props) {
  const screen = useScreenStyles()
  const window = Dimensions.get('window')

  return (
    <Modal animationType="fade" transparent visible={visible} onRequestClose={onClose}>
      <Pressable
        accessibilityLabel="Close photo"
        accessibilityRole="button"
        onPress={onClose}
        style={screen.photoLightboxBackdrop}
      >
        {imageUri ? (
          <Image
            accessibilityLabel={name ? `${name} photo` : 'Photo'}
            resizeMode="contain"
            source={{ uri: imageUri }}
            style={{ width: window.width, height: window.height }}
            {...({
              draggable: false,
              onContextMenu: (event: { preventDefault: () => void }) => event.preventDefault(),
            } as object)}
          />
        ) : (
          <View style={screen.photoLightboxBody}>
            <Avatar bucket={bucket} name={name} path={path} size={220} />
            {name ? <Text style={screen.photoLightboxName}>{name}</Text> : null}
          </View>
        )}
      </Pressable>
    </Modal>
  )
}
