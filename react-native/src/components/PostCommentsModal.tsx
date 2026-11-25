import { X } from 'lucide-react-native'
import { useEffect, useState } from 'react'
import { Modal, Pressable, ScrollView, Text, View } from 'react-native'
import { AppTextInput } from './AppTextInput'
import { Avatar } from './Avatar'
import { TrashButton } from './TrashButton'
import {
  addPostComment,
  deletePostComment,
  loadPostComments,
  type PostComment,
} from '../lib/gym'
import { formatRelativeTime } from '../lib/relativeTime'
import { useScreenStyles, useTheme } from '../theme/ThemeProvider'

type Props = {
  visible: boolean
  postId: string | null
  myUserId: string | null | undefined
  onClose: () => void
  onCountChange: (postId: string, count: number) => void
}

export function PostCommentsModal({
  visible,
  postId,
  myUserId,
  onClose,
  onCountChange,
}: Props) {
  const screen = useScreenStyles()
  const { colors } = useTheme()
  const [comments, setComments] = useState<PostComment[]>([])
  const [draft, setDraft] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!visible || !postId) return
    let cancelled = false
    void loadPostComments(postId)
      .then((rows) => {
        if (cancelled) return
        setComments(rows)
        onCountChange(postId, rows.length)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setError(err instanceof Error ? err.message : 'Could not load comments')
      })
    return () => {
      cancelled = true
    }
  }, [visible, postId, onCountChange])

  async function send() {
    if (!postId || busy) return
    setBusy(true)
    try {
      const comment = await addPostComment(postId, draft)
      const next = [...comments, comment]
      setComments(next)
      setDraft('')
      onCountChange(postId, next.length)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add comment')
    } finally {
      setBusy(false)
    }
  }

  async function remove(comment: PostComment) {
    if (busy) return
    setBusy(true)
    try {
      await deletePostComment(comment.id)
      const next = comments.filter((row) => row.id !== comment.id)
      setComments(next)
      if (postId) onCountChange(postId, next.length)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete comment')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal animationType="fade" transparent visible={visible} onRequestClose={onClose}>
      <View style={screen.modalBackdrop}>
        <View style={screen.modalCard}>
          <View style={screen.modalHeader}>
            <Text style={screen.sectionTitle}>Comments</Text>
            <Pressable
              accessibilityLabel="Close"
              accessibilityRole="button"
              hitSlop={8}
              onPress={onClose}
            >
              <X color={colors.textMuted} size={22} strokeWidth={1.75} />
            </Pressable>
          </View>
          {error ? <Text style={screen.error}>{error}</Text> : null}
          <ScrollView style={screen.modalScroll}>
            <View style={screen.card}>
              {comments.length > 0 ? (
                comments.map((comment, index) => (
                  <View
                    key={comment.id}
                    style={[screen.row, index === 0 && screen.rowFirst, screen.postCommentRow]}
                  >
                    <Avatar
                      name={comment.author.display_name}
                      path={comment.author.avatar_path}
                      size={32}
                    />
                    <View style={screen.rowMain}>
                      <Text style={screen.rowTitle}>
                        {comment.author.display_name ?? 'Unnamed'}
                      </Text>
                      <Text style={screen.body}>{comment.body}</Text>
                      <Text style={screen.muted}>{formatRelativeTime(comment.created_at)}</Text>
                    </View>
                    {comment.user_id === myUserId ? (
                      <TrashButton onPress={() => void remove(comment)} />
                    ) : null}
                  </View>
                ))
              ) : (
                <View style={[screen.row, screen.rowFirst]}>
                  <Text style={screen.muted}>No comments yet.</Text>
                </View>
              )}
            </View>
          </ScrollView>
          <View style={screen.postCommentComposer}>
            <AppTextInput
              onChangeText={setDraft}
              placeholder="Add a comment"
              style={[screen.input, screen.postCommentInput]}
              value={draft}
            />
            <Pressable
              accessibilityRole="button"
              disabled={busy || !draft.trim()}
              onPress={() => void send()}
              style={({ pressed }) => [
                screen.save,
                screen.postCommentSend,
                (busy || !draft.trim()) && screen.buttonDisabled,
                pressed && screen.rowPressed,
              ]}
            >
              <Text style={screen.buttonText}>Send</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  )
}
