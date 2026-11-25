import { Modal, Pressable, Text, View } from 'react-native'
import { POST_REACTION_EMOJIS } from '../lib/postSocial'
import { useScreenStyles } from '../theme/ThemeProvider'

type Props = {
  visible: boolean
  selected?: string | null
  onPick: (emoji: string) => void
  onClose: () => void
}

export function ReactionPickerModal({ visible, selected, onPick, onClose }: Props) {
  const screen = useScreenStyles()
  return (
    <Modal animationType="fade" transparent visible={visible} onRequestClose={onClose}>
      <Pressable accessibilityRole="button" onPress={onClose} style={screen.modalBackdrop}>
        <Pressable onPress={(event) => event.stopPropagation()} style={screen.reactionPickerCard}>
          <Text style={screen.muted}>React</Text>
          <View style={screen.reactionPickerRow}>
            {POST_REACTION_EMOJIS.map((emoji) => {
              const active = selected === emoji
              return (
                <Pressable
                  accessibilityLabel={`React with ${emoji}`}
                  accessibilityRole="button"
                  key={emoji}
                  onPress={() => onPick(emoji)}
                  style={({ pressed }) => [
                    screen.reactionPickerEmoji,
                    active && screen.reactionChipMine,
                    pressed && screen.rowPressed,
                  ]}
                >
                  <Text style={screen.reactionEmojiText}>{emoji}</Text>
                </Pressable>
              )
            })}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  )
}
