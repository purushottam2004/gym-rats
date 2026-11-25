import { Info } from 'lucide-react-native'
import { Pressable } from 'react-native'
import { useTheme } from '../theme/ThemeProvider'

type Props = {
  onPress: () => void
}

export function InfoButton({ onPress }: Props) {
  const { colors } = useTheme()
  return (
    <Pressable
      accessibilityLabel="Info"
      accessibilityRole="button"
      hitSlop={8}
      onPress={onPress}
    >
      <Info color={colors.accent} size={20} strokeWidth={1.75} />
    </Pressable>
  )
}
