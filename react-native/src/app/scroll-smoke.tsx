import { Redirect } from 'expo-router'
import { Text } from 'react-native'
import { Screen } from '../components/Screen'
import { screen } from '../components/screenStyles'

/** Dev-only tall page so scroll can be checked without signing in. */
export default function ScrollSmokeScreen() {
  if (!__DEV__) {
    return <Redirect href="/diet" />
  }

  return (
    <Screen>
      <Text style={screen.title}>Scroll smoke</Text>
      {Array.from({ length: 40 }, (_, index) => (
        <Text key={index} style={screen.rowTitle} testID={`smoke-row-${index}`}>
          Row {index + 1}
        </Text>
      ))}
    </Screen>
  )
}
