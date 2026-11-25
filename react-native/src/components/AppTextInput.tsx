import { Platform, TextInput, type TextInputProps } from 'react-native'
import { useTheme } from '../theme/ThemeProvider'

/**
 * TextInput with grey italic placeholders. Typed text stays normal weight/color.
 * On web, ::placeholder CSS is synced by ThemeProvider; on native, empty fields use italic until typed.
 */
export function AppTextInput({
  style,
  value,
  defaultValue,
  placeholderTextColor,
  ...rest
}: TextInputProps) {
  const { colors } = useTheme()
  const empty = String(value ?? defaultValue ?? '').length === 0

  return (
    <TextInput
      {...rest}
      defaultValue={defaultValue}
      placeholderTextColor={placeholderTextColor ?? colors.placeholder}
      style={[Platform.OS !== 'web' && empty ? { fontStyle: 'italic' } : null, style]}
      value={value}
    />
  )
}
