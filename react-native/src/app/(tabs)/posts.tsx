import { useFocusEffect, useRouter } from 'expo-router'
import { Image as ImageIcon } from 'lucide-react-native'
import { useCallback, useState } from 'react'
import { Image, Pressable, Text, View } from 'react-native'
import { useAuth } from '../../auth/AuthProvider'
import { Avatar } from '../../components/Avatar'
import { ConfirmModal } from '../../components/ConfirmModal'
import { Screen } from '../../components/Screen'
import { TabChrome } from '../../components/TabChrome'
import { TrashButton } from '../../components/TrashButton'
import { useScreenStyles } from '../../theme/ThemeProvider'
import { deletePost, loadGroups, loadPosts, publicImageUrl, type Post } from '../../lib/gym'
import { formatRelativeTime } from '../../lib/relativeTime'

export default function PostsScreen() {
  const screen = useScreenStyles()
  const { session } = useAuth()
  const router = useRouter()
  const [posts, setPosts] = useState<Post[]>([])
  const [names, setNames] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<Post | null>(null)

  const load = useCallback(async () => {
    try {
      const [nextPosts, groups] = await Promise.all([loadPosts(), loadGroups()])
      setPosts(nextPosts)
      setNames(Object.fromEntries(groups.map((group) => [group.id, group.name])))
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load posts')
    }
  }, [])

  useFocusEffect(
    useCallback(() => {
      void load()
    }, [load]),
  )

  return (
    <View style={{ flex: 1 }}>
      <Screen
        header={
          <TabChrome
            icon={ImageIcon}
            title="Posts"
            trailing={
              <Pressable onPress={() => router.push('/new-post')}>
                <Text style={screen.addText}>New</Text>
              </Pressable>
            }
          />
        }
      >
        {error ? <Text style={screen.error}>{error}</Text> : null}
        {posts.map((post) => {
          const audience = post.audiences
            .map((item) => (item.kind === 'profile' ? 'Profile' : names[item.group_id ?? ''] ?? 'Group'))
            .join(' · ')
          const image = publicImageUrl('post-images', post.image_path)
          const own = post.user_id === session?.user.id
          const when = formatRelativeTime(post.created_at)
          const meta = [post.author.display_name ?? 'Unnamed', audience || null, when || null]
            .filter(Boolean)
            .join(' · ')
          return (
            <View key={post.id} style={screen.postCard}>
              {image ? <Image source={{ uri: image }} style={screen.postImage} /> : null}
              <View style={screen.postBody}>
                <View style={screen.postMetaRow}>
                  <Avatar name={post.author.display_name} path={post.author.avatar_path} size={40} />
                  <View style={screen.rowMain}>
                    {post.body ? <Text style={screen.rowTitle}>{post.body}</Text> : null}
                    <Text style={screen.muted}>{meta}</Text>
                  </View>
                  {own ? <TrashButton onPress={() => setPendingDelete(post)} /> : null}
                </View>
              </View>
            </View>
          )
        })}
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
    </View>
  )
}
