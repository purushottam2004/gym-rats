import { Trash2 } from 'lucide-react-native'
import { Pressable } from 'react-native'

type Props = {
  onPress: () => void
}

export function TrashButton({ onPress }: Props) {
  return (
    <Pressable
      accessibilityLabel="Delete"
      accessibilityRole="button"
      hitSlop={8}
      onPress={onPress}
    >
      <Trash2 color="#e5484d" size={20} strokeWidth={1.75} />
    </Pressable>
  )
}
