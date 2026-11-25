import { MessageCircle, SmilePlus } from 'lucide-react-native'
import { useRef, useState } from 'react'
import { Animated, Image, Pressable, Text, View } from 'react-native'
import { Avatar } from './Avatar'
import { PhotoLightbox } from './PhotoLightbox'
import { TrashButton } from './TrashButton'
import { publicImageUrl, type Post } from '../lib/gym'
import {
  applyReactionChoice,
  DEFAULT_POST_REACTION,
  ensureReaction,
  summarizeReactions,
  type ReactionRow,
} from '../lib/postSocial'
import { formatRelativeTime } from '../lib/relativeTime'
import { useScreenStyles, useTheme } from '../theme/ThemeProvider'

const DOUBLE_TAP_MS = 280

type Props = {
  post: Post
  audienceLabel: string
  myUserId: string | null | undefined
  onDelete?: () => void
  onReact: (postId: string, next: ReactionRow[]) => void
  onOpenReactions: () => void
  onOpenComments: () => void
}

export function PostCard({
  post,
  audienceLabel,
  myUserId,
  onDelete,
  onReact,
  onOpenReactions,
  onOpenComments,
}: Props) {
  const screen = useScreenStyles()
  const { colors } = useTheme()
  const image = publicImageUrl('post-images', post.image_path)
  const when = formatRelativeTime(post.created_at)
  const meta = [post.author.display_name ?? 'Unnamed', audienceLabel || null, when || null]
    .filter(Boolean)
    .join(' · ')
  const summaries = summarizeReactions(post.reactions, myUserId)
  const mine = post.reactions.find((row) => row.user_id === myUserId)?.emoji ?? null
  const lastTap = useRef(0)
  const [heart] = useState(() => new Animated.Value(0))
  const [lightboxOpen, setLightboxOpen] = useState(false)

  function pulseHeart() {
    heart.setValue(0)
    Animated.sequence([
      Animated.timing(heart, { toValue: 1, duration: 140, useNativeDriver: true }),
      Animated.timing(heart, { toValue: 0, duration: 420, useNativeDriver: true }),
    ]).start()
  }

  function chooseEmoji(emoji: string) {
    if (!myUserId) return
    const next = applyReactionChoice(post.reactions, myUserId, emoji)
    onReact(post.id, next)
  }

  function onMediaPress() {
    const now = Date.now()
    if (now - lastTap.current < DOUBLE_TAP_MS) {
      lastTap.current = 0
      pulseHeart()
      if (!myUserId) return
      onReact(post.id, ensureReaction(post.reactions, myUserId, DEFAULT_POST_REACTION))
      return
    }
    lastTap.current = now
  }

  return (
    <View style={screen.postCard}>
      <Pressable
        accessibilityHint={
          image ? 'Double tap to like. Long press to view full photo.' : 'Double tap to like'
        }
        accessibilityRole="imagebutton"
        delayLongPress={350}
        onLongPress={image ? () => setLightboxOpen(true) : undefined}
        onPress={onMediaPress}
      >
        {image ? <Image source={{ uri: image }} style={screen.postImage} /> : null}
        {!image && post.body ? (
          <View style={screen.postTapBody}>
            <Text style={screen.rowTitle}>{post.body}</Text>
          </View>
        ) : null}
        <Animated.View
          pointerEvents="none"
          style={[
            screen.postHeartBurst,
            {
              opacity: heart,
              transform: [
                {
                  scale: heart.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.6, 1.15],
                  }),
                },
              ],
            },
          ]}
        >
          <Text style={screen.postHeartBurstText}>{DEFAULT_POST_REACTION}</Text>
        </Animated.View>
      </Pressable>
      <View style={screen.postBody}>
        <View style={screen.postMetaRow}>
          <Avatar name={post.author.display_name} path={post.author.avatar_path} size={40} />
          <View style={screen.rowMain}>
            {image && post.body ? <Text style={screen.rowTitle}>{post.body}</Text> : null}
            <Text style={screen.muted}>{meta}</Text>
          </View>
          {onDelete ? <TrashButton onPress={onDelete} /> : null}
        </View>
        {summaries.length > 0 ? (
          <View style={screen.reactionChipRow}>
            {summaries.map((summary) => (
              <Pressable
                accessibilityLabel={`${summary.emoji} ${summary.count}`}
                accessibilityRole="button"
                key={summary.emoji}
                onPress={() => chooseEmoji(summary.emoji)}
                style={({ pressed }) => [
                  screen.reactionChip,
                  summary.reactedByMe && screen.reactionChipMine,
                  pressed && screen.rowPressed,
                ]}
              >
                <Text style={screen.reactionChipText}>
                  {summary.emoji} {summary.count}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}
        <View style={screen.postActionRow}>
          <Pressable
            accessibilityLabel={mine ? `Your reaction ${mine}` : 'Add reaction'}
            accessibilityRole="button"
            onPress={onOpenReactions}
            style={({ pressed }) => [screen.postActionButton, pressed && screen.rowPressed]}
          >
            <SmilePlus color={colors.accent} size={18} strokeWidth={2.25} />
          </Pressable>
          <Pressable
            accessibilityLabel={
              post.comment_count > 0 ? `${post.comment_count} comments` : 'Comments'
            }
            accessibilityRole="button"
            onPress={onOpenComments}
            style={({ pressed }) => [screen.postActionButton, pressed && screen.rowPressed]}
          >
            <MessageCircle color={colors.accent} size={18} strokeWidth={2.25} />
            {post.comment_count > 0 ? (
              <Text style={screen.postActionLabel}>{post.comment_count}</Text>
            ) : null}
          </Pressable>
        </View>
      </View>
      <PhotoLightbox
        visible={lightboxOpen}
        name={post.author.display_name}
        imageUri={image}
        onClose={() => setLightboxOpen(false)}
      />
    </View>
  )
}
