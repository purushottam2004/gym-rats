import { useFocusEffect, useRouter } from 'expo-router'
import { Image as ImageIcon } from 'lucide-react-native'
import { useCallback, useState } from 'react'
import { Image, Pressable, Text, View } from 'react-native'
import { useAuth } from '../../auth/AuthProvider'
import { ConfirmModal } from '../../components/ConfirmModal'
import { Screen } from '../../components/Screen'
import { TabChrome } from '../../components/TabChrome'
import { TrashButton } from '../../components/TrashButton'
import { screen } from '../../components/screenStyles'
import { deletePost, loadGroups, loadPosts, publicImageUrl, type Post } from '../../lib/gym'

export default function PostsScreen() {
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
      <Screen>
        <TabChrome
          icon={ImageIcon}
          title="Posts"
          trailing={
            <Pressable onPress={() => router.push('/new-post')}>
              <Text style={screen.addText}>New</Text>
            </Pressable>
          }
        />
        {error ? <Text style={screen.error}>{error}</Text> : null}
        {posts.map((post) => {
          const audience = post.audiences
            .map((item) => (item.kind === 'profile' ? 'Profile' : names[item.group_id ?? ''] ?? 'Group'))
            .join(' · ')
          const image = publicImageUrl('post-images', post.image_path)
          const own = post.user_id === session?.user.id
          return (
            <View key={post.id} style={{ gap: 8 }}>
              {image ? (
                <Image source={{ uri: image }} style={{ height: 220, borderRadius: 16, backgroundColor: '#e7e5e4' }} />
              ) : null}
              <View style={screen.dayRow}>
                <View style={screen.rowMain}>
                  {post.body ? <Text style={screen.rowTitle}>{post.body}</Text> : null}
                  <Text style={screen.muted}>
                    {post.author.display_name ?? 'Unnamed'}
                    {audience ? ` · ${audience}` : ''}
                  </Text>
                </View>
                {own ? <TrashButton onPress={() => setPendingDelete(post)} /> : null}
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
