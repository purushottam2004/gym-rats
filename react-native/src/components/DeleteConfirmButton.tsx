import { Trash2 } from 'lucide-react-native'
import { Alert, Pressable } from 'react-native'

type Props = {
  title: string
  message: string
  onConfirm: () => void
}

export function DeleteConfirmButton({ title, message, onConfirm }: Props) {
  return (
    <Pressable
      accessibilityLabel="Delete"
      accessibilityRole="button"
      hitSlop={8}
      onPress={() => {
        Alert.alert(title, message, [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Delete', style: 'destructive', onPress: onConfirm },
        ])
      }}
    >
      <Trash2 color="#e5484d" size={20} strokeWidth={1.75} />
    </Pressable>
  )
}
