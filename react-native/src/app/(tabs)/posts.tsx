import { useFocusEffect, useRouter } from 'expo-router'
import { Image as ImageIcon, Plus } from 'lucide-react-native'
import { useCallback, useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { useAuth } from '../../auth/AuthProvider'
import { LoadingBlock } from '../../components/BrandLoader'
import { ConfirmModal } from '../../components/ConfirmModal'
import { DayControls } from '../../components/DayControls'
import { ProfileAvatarButton } from '../../components/ProfileAvatarButton'
import { PostCard } from '../../components/PostCard'
import { PostCommentsModal } from '../../components/PostCommentsModal'
import { ReactionPickerModal } from '../../components/ReactionPickerModal'
import { Screen } from '../../components/Screen'
import { TabChrome } from '../../components/TabChrome'
import { useScreenStyles, useTheme } from '../../theme/ThemeProvider'
import {
  clearPostReaction,
  deletePost,
  loadGroups,
  loadPosts,
  loadProfile,
  setPostReaction,
  type Post,
  type Profile,
} from '../../lib/gym'
import { localDate } from '../../lib/localDate'
import { applyReactionChoice, type ReactionRow } from '../../lib/postSocial'

export default function PostsScreen() {
  const screen = useScreenStyles()
  const { colors } = useTheme()
  const { session } = useAuth()
  const router = useRouter()
  const myUserId = session?.user.id
  const [day, setDay] = useState(localDate)
  const [posts, setPosts] = useState<Post[]>([])
  const [names, setNames] = useState<Record<string, string>>({})
  const [myProfile, setMyProfile] = useState<Profile | null>(null)
  const [hydrated, setHydrated] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<Post | null>(null)
  const [reactPostId, setReactPostId] = useState<string | null>(null)
  const [commentsPostId, setCommentsPostId] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const [nextPosts, groups, profile] = await Promise.all([
        loadPosts(day),
        loadGroups(),
        myUserId ? loadProfile(myUserId) : Promise.resolve(null),
      ])
      setPosts(nextPosts)
      setNames(Object.fromEntries(groups.map((group) => [group.id, group.name])))
      setMyProfile(profile)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load posts')
    } finally {
      setHydrated(true)
    }
  }, [day, myUserId])

  useFocusEffect(
    useCallback(() => {
      void load()
    }, [load]),
  )

  function audienceLabel(post: Post): string {
    return post.audiences
      .map((item) => (item.kind === 'profile' ? 'Profile' : names[item.group_id ?? ''] ?? 'Group'))
      .join(' · ')
  }

  const updateCommentCount = useCallback((postId: string, count: number) => {
    setPosts((current) =>
      current.map((post) => (post.id === postId ? { ...post, comment_count: count } : post)),
    )
  }, [])

  function patchReactions(postId: string, next: ReactionRow[]) {
    setPosts((current) =>
      current.map((post) => (post.id === postId ? { ...post, reactions: next } : post)),
    )
  }

  async function commitReaction(postId: string, next: ReactionRow[]) {
    if (!myUserId) return
    const previous = posts.find((post) => post.id === postId)?.reactions ?? []
    patchReactions(postId, next)
    const mine = next.find((row) => row.user_id === myUserId)
    try {
      if (mine) await setPostReaction(postId, mine.emoji)
      else await clearPostReaction(postId)
    } catch (err) {
      patchReactions(postId, previous)
      setError(err instanceof Error ? err.message : 'Could not update reaction')
    }
  }

  const reactTarget = posts.find((post) => post.id === reactPostId) ?? null
  const myReaction = reactTarget?.reactions.find((row) => row.user_id === myUserId)?.emoji ?? null

  return (
    <View style={{ flex: 1 }}>
      <Screen
        header={
          <>
            <TabChrome
              icon={ImageIcon}
              title="Posts"
              featuresTab="posts"
              featuresTitle="Posts features"
              trailing={
                <>
                  <DayControls day={day} onChange={setDay} />
                  <ProfileAvatarButton />
                </>
              }
            />
            <View style={screen.card}>
              <View style={screen.iconActionRow}>
                <Pressable
                  accessibilityLabel="New post"
                  accessibilityRole="button"
                  onPress={() => router.push('/new-post')}
                  style={({ pressed }) => [screen.iconActionButton, pressed && screen.rowPressed]}
                >
                  <Plus color={colors.accent} size={22} strokeWidth={2.25} />
                </Pressable>
              </View>
            </View>
          </>
        }
      >
        {error ? <Text style={screen.error}>{error}</Text> : null}
        {!hydrated ? (
          <LoadingBlock label="Loading posts" />
        ) : (
          <>
            {posts.length === 0 && !error ? (
              <Text style={screen.muted}>No posts for this day.</Text>
            ) : null}
            {posts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                audienceLabel={audienceLabel(post)}
                myUserId={myUserId}
                myProfile={myProfile}
                onDelete={
                  post.user_id === myUserId ? () => setPendingDelete(post) : undefined
                }
                onReact={(postId, next) => void commitReaction(postId, next)}
                onOpenReactions={() => setReactPostId(post.id)}
                onOpenComments={() => setCommentsPostId(post.id)}
              />
            ))}
          </>
        )}
      </Screen>
      <ConfirmModal
        visible={pendingDelete !== null}
        title="Delete post?"
        message="Remove this post? This cannot be undone."
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          const post = pendingDelete
          setPendingDelete(null)
          if (post) void deletePost(post.id).then(load)
        }}
      />
      <ReactionPickerModal
        visible={reactPostId !== null}
        selected={myReaction}
        onClose={() => setReactPostId(null)}
        onPick={(emoji) => {
          const postId = reactPostId
          setReactPostId(null)
          if (!postId || !myUserId) return
          const current = posts.find((post) => post.id === postId)?.reactions ?? []
          const next = applyReactionChoice(current, myUserId, emoji, myProfile)
          void commitReaction(postId, next)
        }}
      />
      <PostCommentsModal
        key={commentsPostId ?? 'closed'}
        visible={commentsPostId !== null}
        postId={commentsPostId}
        myUserId={myUserId}
        onClose={() => setCommentsPostId(null)}
        onCountChange={updateCommentCount}
      />
    </View>
  )
}
