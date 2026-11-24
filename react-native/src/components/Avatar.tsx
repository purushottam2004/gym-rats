import { Image, Text, View } from 'react-native'
import { publicImageUrl } from '../lib/gym'
import { screen } from './screenStyles'

type Props = {
  path: string | null | undefined
  name?: string | null
  size?: number
}

export function Avatar({ path, name, size = 44 }: Props) {
  const uri = publicImageUrl('avatars', path ?? null)
  const initial = (name?.trim()?.charAt(0) ?? '?').toUpperCase()
  const radius = size / 2

  if (uri) {
    return (
      <Image
        accessibilityIgnoresInvertColors
        source={{ uri }}
        style={{ width: size, height: size, borderRadius: radius, backgroundColor: '#e7e5e4' }}
      />
    )
  }

  return (
    <View style={[screen.avatarFallback, { width: size, height: size, borderRadius: radius }]}>
      <Text style={[screen.avatarInitial, { fontSize: Math.round(size * 0.4) }]}>{initial}</Text>
    </View>
  )
}
