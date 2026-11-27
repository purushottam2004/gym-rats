import { useFocusEffect, useRouter } from 'expo-router'
import { Circle, CircleCheck, Plus, Trash2 } from 'lucide-react-native'
import { useCallback, useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { AppTextInput } from '../components/AppTextInput'
import { BusyOverlay } from '../components/BrandLoader'
import { Screen } from '../components/Screen'
import { Toast, type ToastKind } from '../components/Toast'
import { useAuth } from '../auth/AuthProvider'
import { takeBookDraft, type BookChapterDraft } from '../lib/bookDraft'
import { createBook, loadGroups, type Group } from '../lib/gym'
import { useScreenStyles, useTheme } from '../theme/ThemeProvider'

function emptyChapter(): BookChapterDraft {
  return { title: '', page_start: '', page_end: '' }
}

export default function NewBookScreen() {
  const screen = useScreenStyles()
  const { colors } = useTheme()
  const router = useRouter()
  const { session } = useAuth()
  const [title, setTitle] = useState('')
  const [author, setAuthor] = useState('')
  const [chapters, setChapters] = useState<BookChapterDraft[]>([emptyChapter()])
  const [groups, setGroups] = useState<Group[]>([])
  const [profile, setProfile] = useState(false)
  const [selected, setSelected] = useState<Record<string, boolean>>({})
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<{ kind: ToastKind; message: string } | null>(null)
  const [saving, setSaving] = useState(false)
  const [hydratedDraft, setHydratedDraft] = useState(false)

  useFocusEffect(
    useCallback(() => {
      if (!hydratedDraft) {
        const draft = takeBookDraft()
        if (draft) {
          setTitle(draft.title)
          setAuthor(draft.author)
          setChapters(draft.chapters.length > 0 ? draft.chapters : [emptyChapter()])
        }
        setHydratedDraft(true)
      }
      void loadGroups()
        .then(setGroups)
        .catch((err: unknown) =>
          setError(err instanceof Error ? err.message : 'Could not load groups'),
        )
    }, [hydratedDraft]),
  )

  function updateChapter(index: number, patch: Partial<BookChapterDraft>) {
    setChapters((current) =>
      current.map((chapter, i) => (i === index ? { ...chapter, ...patch } : chapter)),
    )
  }

  async function save() {
    const userId = session?.user.id
    if (!userId || saving) return
    setSaving(true)
    setError(null)
    try {
      const parsedChapters = chapters
        .map((chapter) => {
          const chapterTitle = chapter.title.trim()
          if (!chapterTitle) return null
          const pageStart = chapter.page_start.trim()
            ? Number(chapter.page_start.trim())
            : null
          const pageEnd = chapter.page_end.trim() ? Number(chapter.page_end.trim()) : null
          return {
            title: chapterTitle,
            page_start:
              pageStart != null && Number.isFinite(pageStart) && pageStart >= 1
                ? Math.round(pageStart)
                : null,
            page_end:
              pageEnd != null && Number.isFinite(pageEnd) && pageEnd >= 1
                ? Math.round(pageEnd)
                : null,
          }
        })
        .filter((row): row is NonNullable<typeof row> => row != null)

      await createBook({
        userId,
        title,
        author,
        chapters: parsedChapters,
        profile,
        groupIds: groups.filter((group) => selected[group.id]).map((group) => group.id),
      })
      setSaving(false)
      setToast({ kind: 'success', message: 'Book saved' })
      setTimeout(() => {
        router.back()
      }, 500)
    } catch (err) {
      setSaving(false)
      const message = err instanceof Error ? err.message : 'Could not save book'
      setError(message)
      setToast({ kind: 'error', message })
    }
  }

  return (
    <View style={{ flex: 1 }}>
      <Screen
        footer={
          <Pressable
            accessibilityRole="button"
            disabled={saving}
            onPress={() => void save()}
            style={[screen.save, saving && screen.buttonDisabled]}
          >
            <Text style={screen.buttonText}>{saving ? 'Saving…' : 'Save book'}</Text>
          </Pressable>
        }
      >
        <Text style={screen.title}>New book</Text>
        {error ? <Text style={screen.error}>{error}</Text> : null}

        <Text style={screen.label}>Title</Text>
        <AppTextInput
          editable={!saving}
          onChangeText={setTitle}
          placeholder="Book title"
          style={screen.input}
          value={title}
        />

        <Text style={screen.label}>Author</Text>
        <AppTextInput
          editable={!saving}
          onChangeText={setAuthor}
          placeholder="Optional"
          style={screen.input}
          value={author}
        />

        <Text style={screen.label}>Chapters</Text>
        <Text style={screen.muted}>Optional TOC pages — schedule days after saving.</Text>
        <View style={{ gap: 12 }}>
          {chapters.map((chapter, index) => (
            <View key={`ch-${index}`} style={{ gap: 8 }}>
              <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                <AppTextInput
                  editable={!saving}
                  onChangeText={(value) => updateChapter(index, { title: value })}
                  placeholder={`Chapter ${index + 1}`}
                  style={[screen.input, { flex: 1 }]}
                  value={chapter.title}
                />
                <Pressable
                  accessibilityLabel="Remove chapter"
                  disabled={saving}
                  hitSlop={8}
                  onPress={() =>
                    setChapters((current) =>
                      current.length <= 1 ? [emptyChapter()] : current.filter((_, i) => i !== index),
                    )
                  }
                  style={({ pressed }) => [
                    screen.iconActionButton,
                    (pressed || saving) && screen.buttonDisabled,
                  ]}
                >
                  <Trash2 color={colors.tabInactive} size={18} strokeWidth={1.75} />
                </Pressable>
              </View>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <AppTextInput
                  editable={!saving}
                  keyboardType="number-pad"
                  onChangeText={(value) => updateChapter(index, { page_start: value })}
                  placeholder="Start page"
                  style={[screen.input, { flex: 1 }]}
                  value={chapter.page_start}
                />
                <AppTextInput
                  editable={!saving}
                  keyboardType="number-pad"
                  onChangeText={(value) => updateChapter(index, { page_end: value })}
                  placeholder="End page"
                  style={[screen.input, { flex: 1 }]}
                  value={chapter.page_end}
                />
              </View>
            </View>
          ))}
        </View>
        <Pressable
          disabled={saving}
          onPress={() => setChapters((current) => [...current, emptyChapter()])}
          style={({ pressed }) => [
            screen.secondaryButton,
            (pressed || saving) && screen.buttonDisabled,
          ]}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Plus color={colors.accent} size={16} strokeWidth={2.25} />
            <Text style={screen.secondaryButtonText}>Add chapter</Text>
          </View>
        </Pressable>

        <Text style={screen.label}>Who can see it</Text>
        <Text style={screen.muted}>Private by default. Share to Profile or a group.</Text>
        <View style={screen.card}>
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: profile }}
            disabled={saving}
            onPress={() => setProfile((current) => !current)}
            style={({ pressed }) => [
              screen.row,
              screen.rowFirst,
              profile && screen.rowSelected,
              pressed && (profile ? screen.rowSelectedPressed : screen.rowPressed),
              saving && screen.buttonDisabled,
            ]}
          >
            <Text style={[screen.rowTitle, profile && screen.rowTitleSelected]}>Profile</Text>
            {profile ? (
              <CircleCheck color={colors.accent} size={20} strokeWidth={2.25} />
            ) : (
              <Circle color={colors.border} size={20} strokeWidth={1.75} />
            )}
          </Pressable>
          {groups.map((group) => {
            const checked = Boolean(selected[group.id])
            return (
              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked }}
                disabled={saving}
                key={group.id}
                onPress={() =>
                  setSelected((current) => ({ ...current, [group.id]: !current[group.id] }))
                }
                style={({ pressed }) => [
                  screen.row,
                  checked && screen.rowSelected,
                  pressed && (checked ? screen.rowSelectedPressed : screen.rowPressed),
                  saving && screen.buttonDisabled,
                ]}
              >
                <Text style={[screen.rowTitle, checked && screen.rowTitleSelected]}>{group.name}</Text>
                {checked ? (
                  <CircleCheck color={colors.accent} size={20} strokeWidth={2.25} />
                ) : (
                  <Circle color={colors.border} size={20} strokeWidth={1.75} />
                )}
              </Pressable>
            )
          })}
        </View>
      </Screen>
      <BusyOverlay visible={saving} label="Saving…" />
      <Toast
        visible={toast != null}
        kind={toast?.kind ?? 'error'}
        message={toast?.message ?? ''}
        onHide={() => setToast(null)}
      />
    </View>
  )
}
