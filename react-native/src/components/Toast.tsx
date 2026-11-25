import { CheckCircle2, CircleAlert } from 'lucide-react-native'
import { useEffect } from 'react'
import { Text, View } from 'react-native'
import { useScreenStyles } from '../theme/ThemeProvider'

export type ToastKind = 'success' | 'error'

type Props = {
  visible: boolean
  kind: ToastKind
  message: string
  onHide: () => void
  durationMs?: number
}

export function Toast({ visible, kind, message, onHide, durationMs = 2800 }: Props) {
  const screen = useScreenStyles()
  useEffect(() => {
    if (!visible) return
    const timer = setTimeout(onHide, durationMs)
    return () => clearTimeout(timer)
  }, [visible, durationMs, onHide, message, kind])

  if (!visible) return null

  const success = kind === 'success'

  return (
    <View
      pointerEvents="none"
      style={[screen.toast, success ? screen.toastSuccess : screen.toastError]}
    >
      {success ? (
        <CheckCircle2 color="#15803d" size={20} strokeWidth={2} />
      ) : (
        <CircleAlert color="#b91c1c" size={20} strokeWidth={2} />
      )}
      <Text style={[screen.toastText, success ? screen.toastTextSuccess : screen.toastTextError]}>
        {message}
      </Text>
    </View>
  )
}
