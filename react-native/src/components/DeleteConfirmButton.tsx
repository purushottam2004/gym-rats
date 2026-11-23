import { Trash2 } from 'lucide-react-native'
import { Alert, Platform, Pressable } from 'react-native'
import { confirmDelete } from '../lib/confirmDelete'

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
      onPress={() =>
        confirmDelete({
          title,
          message,
          onConfirm,
          useBrowserConfirm: Platform.OS === 'web',
          nativeAlert: Alert.alert,
        })
      }
    >
      <Trash2 color="#e5484d" size={20} strokeWidth={1.75} />
    </Pressable>
  )
}
