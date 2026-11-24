import type { PropsWithChildren, ReactNode } from 'react'
import { ScrollView, View, type StyleProp, type ViewStyle } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { screen } from './screenStyles'

type Props = PropsWithChildren<{
  /** Stays fixed above the scroll area (tab chrome, action rows). */
  header?: ReactNode
  contentContainerStyle?: StyleProp<ViewStyle>
}>

/** Full-height page with scroll so long lists work on web and native. */
export function Screen({ children, header, contentContainerStyle }: Props) {
  return (
    <SafeAreaView style={screen.safe}>
      {header ? <View style={screen.stickyHeader}>{header}</View> : null}
      <ScrollView
        style={screen.scroll}
        contentContainerStyle={[screen.scrollContent, contentContainerStyle]}
        keyboardShouldPersistTaps="handled"
      >
        {children}
      </ScrollView>
    </SafeAreaView>
  )
}
