import type { PropsWithChildren, ReactNode } from 'react'
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useScreenStyles } from '../theme/ThemeProvider'

type Props = PropsWithChildren<{
  /** Stays fixed above the scroll area (tab chrome, action rows). */
  header?: ReactNode
  /** Stays fixed below the scroll area (primary actions like Add New Food). */
  footer?: ReactNode
  contentContainerStyle?: StyleProp<ViewStyle>
}>

/** Full-height page with scroll so long lists work on web and native. */
export function Screen({ children, header, footer, contentContainerStyle }: Props) {
  const screen = useScreenStyles()

  const scroll = (
    <ScrollView
      style={screen.scroll}
      contentContainerStyle={[screen.scrollContent, contentContainerStyle]}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
      // Keeps the focused TextInput above the keyboard and lets the list scroll
      // further once the keyboard is open (sticky footer stays usable).
      automaticallyAdjustKeyboardInsets={Platform.OS !== 'web'}
      // iOS: lock to the first scroll axis so vertical list scrolling does not
      // steal mid-gesture from horizontal row swipes (e.g. habit complete).
      directionalLockEnabled
    >
      {children}
    </ScrollView>
  )

  return (
    <SafeAreaView style={screen.safe}>
      {header ? <View style={screen.stickyHeader}>{header}</View> : null}
      {Platform.OS === 'web' ? (
        <>
          {scroll}
          {footer ? <View style={screen.stickyFooter}>{footer}</View> : null}
        </>
      ) : (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={screen.scroll}
          keyboardVerticalOffset={0}
        >
          {scroll}
          {footer ? <View style={screen.stickyFooter}>{footer}</View> : null}
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  )
}
