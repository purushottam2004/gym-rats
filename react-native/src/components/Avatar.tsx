import { Image } from 'expo-image'
import { Text, View } from 'react-native'
import { publicImageUrl, type ImageBucket } from '../lib/gym'
import {
  imageOwnerCacheKey,
  peekCachedImageUri,
  rememberCachedImageUri,
} from '../lib/imageUriCache'
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
  const cacheKey = path ? imageOwnerCacheKey(bucket, path) : null
  const previousUri = cacheKey ? peekCachedImageUri(cacheKey) : null
  const placeholderUri = previousUri && previousUri !== uri ? previousUri : null

  if (uri) {
    return (
      <Image
        accessibilityLabel={name ? `${name} avatar` : 'Avatar'}
        cachePolicy="memory-disk"
        contentFit="cover"
        onLoad={() => {
          if (cacheKey) rememberCachedImageUri(cacheKey, uri)
        }}
        placeholder={placeholderUri ? { uri: placeholderUri } : undefined}
        placeholderContentFit="cover"
        recyclingKey={cacheKey ?? uri}
        source={{ uri }}
        style={{
          width: size,
          height: size,
          borderRadius: radius,
          backgroundColor: colors.avatarFallback,
        }}
        transition={{ duration: 180, skipOnCacheHit: 'all' }}
      />
    )
  }

  return (
    <View style={[screen.avatarFallback, { width: size, height: size, borderRadius: radius }]}>
      <Text style={[screen.avatarInitial, { fontSize: Math.round(size * 0.4) }]}>{initial}</Text>
    </View>
  )
}
