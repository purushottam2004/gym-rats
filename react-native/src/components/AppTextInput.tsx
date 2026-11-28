import { forwardRef, type ComponentRef } from 'react'
import { Platform, TextInput, type TextInputProps } from 'react-native'
import { useTheme } from '../theme/ThemeProvider'

export type AppTextInputRef = ComponentRef<typeof TextInput>

/**
 * TextInput with grey italic placeholders. Typed text stays normal weight/color.
 * On web, ::placeholder CSS is synced by ThemeProvider; on native, empty fields use italic until typed.
 */
export const AppTextInput = forwardRef<AppTextInputRef, TextInputProps>(function AppTextInput(
  { style, value, defaultValue, placeholderTextColor, ...rest },
  ref,
) {
  const { colors } = useTheme()
  const empty = String(value ?? defaultValue ?? '').length === 0

  return (
    <TextInput
      {...rest}
      ref={ref}
      defaultValue={defaultValue}
      placeholderTextColor={placeholderTextColor ?? colors.placeholder}
      style={[Platform.OS !== 'web' && empty ? { fontStyle: 'italic' } : null, style]}
      value={value}
    />
  )
})
