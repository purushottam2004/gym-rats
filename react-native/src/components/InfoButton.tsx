import { Info } from 'lucide-react-native'
import { Pressable } from 'react-native'

type Props = {
  onPress: () => void
}

export function InfoButton({ onPress }: Props) {
  return (
    <Pressable
      accessibilityLabel="Info"
      accessibilityRole="button"
      hitSlop={8}
      onPress={onPress}
    >
      <Info color="#c2410c" size={20} strokeWidth={1.75} />
    </Pressable>
  )
}
