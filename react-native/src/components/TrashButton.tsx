import { Trash2 } from 'lucide-react-native'
import { Pressable } from 'react-native'
import { useTheme } from '../theme/ThemeProvider'

type Props = {
  onPress: () => void
}

export function TrashButton({ onPress }: Props) {
  const { colors } = useTheme()
  return (
    <Pressable
      accessibilityLabel="Delete"
      accessibilityRole="button"
      hitSlop={8}
      onPress={onPress}
    >
      <Trash2 color={colors.danger} size={20} strokeWidth={1.75} />
    </Pressable>
  )
}
