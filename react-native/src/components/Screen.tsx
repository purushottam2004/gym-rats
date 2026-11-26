import type { PropsWithChildren, ReactNode } from 'react'
import { ScrollView, View, type StyleProp, type ViewStyle } from 'react-native'
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
  return (
    <SafeAreaView style={screen.safe}>
      {header ? <View style={screen.stickyHeader}>{header}</View> : null}
      <ScrollView
        style={screen.scroll}
        contentContainerStyle={[screen.scrollContent, contentContainerStyle]}
        keyboardShouldPersistTaps="handled"
        // iOS: lock to the first scroll axis so vertical list scrolling does not
        // steal mid-gesture from horizontal row swipes (e.g. habit complete).
        directionalLockEnabled
      >
        {children}
      </ScrollView>
      {footer ? <View style={screen.stickyFooter}>{footer}</View> : null}
    </SafeAreaView>
  )
}
