import type { PropsWithChildren } from 'react'
import { ScrollView, type StyleProp, type ViewStyle } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { screen } from './screenStyles'

type Props = PropsWithChildren<{
  contentContainerStyle?: StyleProp<ViewStyle>
}>

/** Full-height page with scroll so long lists work on web and native. */
export function Screen({ children, contentContainerStyle }: Props) {
  return (
    <SafeAreaView style={screen.safe}>
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
