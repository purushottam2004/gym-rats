import { useEffect } from 'react'
import { Platform, TextInput, type TextInputProps } from 'react-native'

/** Grey used for empty-field hints across the app. */
export const PLACEHOLDER_COLOR = '#a8a29e'

const WEB_PLACEHOLDER_STYLE_ID = 'gym-rats-placeholder-style'

function ensureWebPlaceholderStyles() {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return
  if (document.getElementById(WEB_PLACEHOLDER_STYLE_ID)) return
  const style = document.createElement('style')
  style.id = WEB_PLACEHOLDER_STYLE_ID
  style.textContent = `
    input::placeholder,
    textarea::placeholder {
      color: ${PLACEHOLDER_COLOR} !important;
      font-style: italic !important;
      opacity: 1;
    }
  `
  document.head.appendChild(style)
}

/**
 * TextInput with grey italic placeholders. Typed text stays normal weight/color.
 * On web, ::placeholder CSS covers italic; on native, empty fields use italic until typed.
 */
export function AppTextInput({
  style,
  value,
  defaultValue,
  placeholderTextColor,
  ...rest
}: TextInputProps) {
  useEffect(() => {
    ensureWebPlaceholderStyles()
  }, [])

  const empty = String(value ?? defaultValue ?? '').length === 0

  return (
    <TextInput
      {...rest}
      defaultValue={defaultValue}
      placeholderTextColor={placeholderTextColor ?? PLACEHOLDER_COLOR}
      style={[Platform.OS !== 'web' && empty ? { fontStyle: 'italic' } : null, style]}
      value={value}
    />
  )
}
