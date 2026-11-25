import { Image, Text, View } from 'react-native'
import { publicImageUrl, type ImageBucket } from '../lib/gym'
import { useScreenStyles, useTheme } from '../theme/ThemeProvider'

type Props = {
  path: string | null | undefined
  name?: string | null
  size?: number
  bucket?: ImageBucket
}

export function Avatar({ path, name, size = 44, bucket = 'avatars' }: Props) {
  const screen = useScreenStyles()
  const { colors } = useTheme()
  const uri = publicImageUrl(bucket, path ?? null)
  const initial = (name?.trim()?.charAt(0) ?? '?').toUpperCase()
  const radius = size / 2

  if (uri) {
    return (
      <Image
        accessibilityIgnoresInvertColors
        source={{ uri }}
        style={{
          width: size,
          height: size,
          borderRadius: radius,
          backgroundColor: colors.avatarFallback,
        }}
      />
    )
  }

  return (
    <View style={[screen.avatarFallback, { width: size, height: size, borderRadius: radius }]}>
      <Text style={[screen.avatarInitial, { fontSize: Math.round(size * 0.4) }]}>{initial}</Text>
    </View>
  )
}
