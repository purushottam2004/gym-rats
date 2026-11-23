export type ConfirmDeleteButtons = {
  text: string
  style?: 'cancel' | 'destructive' | 'default'
  onPress?: () => void
}[]

type ConfirmDeleteOptions = {
  title: string
  message: string
  onConfirm: () => void
  /** When true, use the browser confirm dialog (web). */
  useBrowserConfirm: boolean
  browserConfirm?: (text: string) => boolean
  nativeAlert?: (title: string, message: string, buttons: ConfirmDeleteButtons) => void
}

/** Shared confirm path so web can use window.confirm (Alert.alert is a no-op there). */
export function confirmDelete({
  title,
  message,
  onConfirm,
  useBrowserConfirm,
  browserConfirm = (text) =>
    typeof globalThis.confirm === 'function' ? globalThis.confirm(text) : false,
  nativeAlert,
}: ConfirmDeleteOptions): void {
  if (useBrowserConfirm) {
    if (browserConfirm([title, message].filter(Boolean).join('\n\n'))) {
      onConfirm()
    }
    return
  }

  nativeAlert?.(title, message, [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete', style: 'destructive', onPress: onConfirm },
  ])
}
