import * as ImagePicker from 'expo-image-picker'
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router'
import { useCallback, useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { AppTextInput } from '../../components/AppTextInput'
import { useAuth } from '../../auth/AuthProvider'
import { Avatar } from '../../components/Avatar'
import { InfoButton } from '../../components/InfoButton'
import { InfoListModal } from '../../components/InfoListModal'
import { PhotoLightbox } from '../../components/PhotoLightbox'
import { Screen } from '../../components/Screen'
import { useScreenStyles } from '../../theme/ThemeProvider'
import {
  leaveGroup,
  loadGroups,
  loadMembers,
  removeMember,
  renameGroup,
  replaceInviteCode,
  setGroupAvatar,
  uploadImage,
  type Group,
  type Member,
} from '../../lib/gym'

type LightboxTarget =
  | { kind: 'group' }
  | { kind: 'member'; member: Member }

export default function GroupScreen() {
  const screen = useScreenStyles()
  const { id } = useLocalSearchParams<{ id: string }>()
  const { session } = useAuth()
  const router = useRouter()
  const [group, setGroup] = useState<Group | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [showCode, setShowCode] = useState(false)
  const [lightbox, setLightbox] = useState<LightboxTarget | null>(null)
  const [photoBusy, setPhotoBusy] = useState(false)

  const load = useCallback(async () => {
    if (!id) return
    try {
      const groups = await loadGroups()
      const found = groups.find((item) => item.id === id) ?? null
      setGroup(found)
      setName(found?.name ?? '')
      setMembers(await loadMembers(id))
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load group')
    }
  }, [id])

  useFocusEffect(
    useCallback(() => {
      void load()
    }, [load]),
  )

  const creator = group?.creator_id === session?.user.id

  async function run(action: () => Promise<void>) {
    try {
      await action()
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update the group')
    }
  }

  async function updateGroupPhoto() {
    if (!group || photoBusy) return
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!permission.granted) {
      setError('Photo access is required')
      return
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 })
    if (result.canceled || !result.assets[0]) return
    setPhotoBusy(true)
    setError(null)
    try {
      const path = await uploadImage('group-avatars', group.id, result.assets[0].uri)
      await setGroupAvatar(group.id, path)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update group photo')
    } finally {
      setPhotoBusy(false)
    }
  }

  return (
    <View style={{ flex: 1 }}>
      <Screen>
        <View style={screen.groupHeaderRow}>
          <View style={screen.groupHeaderMain}>
            <Pressable
              accessibilityLabel="View group photo"
              accessibilityRole="button"
              hitSlop={4}
              onPress={() => setLightbox({ kind: 'group' })}
            >
              <Avatar
                bucket="group-avatars"
                name={group?.name ?? 'Group'}
                path={group?.avatar_path}
                size={56}
              />
            </Pressable>
            <Text numberOfLines={2} style={screen.groupHeaderName}>
              {group?.name ?? 'Group'}
            </Text>
          </View>
          <InfoButton onPress={() => setShowCode(true)} />
        </View>
        {error ? <Text style={screen.error}>{error}</Text> : null}
        <View style={screen.card}>
          {members.length > 0 ? (
            members.map((member, index) => {
              const isYou = member.id === session?.user.id
              return (
                <View
                  key={member.id}
                  style={[screen.row, index === 0 && screen.rowFirst, isYou && screen.rowSelected]}
                >
                  <View style={screen.memberRow}>
                    <Pressable
                      accessibilityLabel="View profile photo"
                      accessibilityRole="button"
                      hitSlop={4}
                      onPress={() => setLightbox({ kind: 'member', member })}
                    >
                      <Avatar name={member.display_name} path={member.avatar_path} />
                    </Pressable>
                    <Pressable
                      onPress={() =>
                        router.push({ pathname: '/member/[id]', params: { id: member.id } })
                      }
                      style={{ flex: 1, minWidth: 0 }}
                    >
                      <Text
                        numberOfLines={1}
                        style={[
                          screen.rowTitle,
                          screen.memberName,
                          isYou && screen.rowTitleSelected,
                        ]}
                      >
                        {member.display_name ?? 'Unnamed'}
                      </Text>
                    </Pressable>
                  </View>
                  <View style={screen.choiceTrail}>
                    {isYou ? <Text style={screen.youLabel}>You</Text> : null}
                    {member.id === group?.creator_id ? (
                      <Text style={screen.muted}>Creator</Text>
                    ) : null}
                    {creator && !isYou ? (
                      <Pressable onPress={() => void run(() => removeMember(id, member.id))}>
                        <Text style={screen.leaveText}>Remove</Text>
                      </Pressable>
                    ) : null}
                  </View>
                </View>
              )
            })
          ) : (
            <View style={[screen.row, screen.rowFirst]}>
              <Text style={screen.muted}>No members in this group yet.</Text>
            </View>
          )}
        </View>
        <Pressable
          accessibilityRole="button"
          disabled={photoBusy || !group}
          onPress={() => void updateGroupPhoto()}
          style={({ pressed }) => [
            screen.button,
            (photoBusy || !group) && screen.buttonDisabled,
            pressed && screen.rowPressed,
          ]}
        >
          <Text style={screen.buttonText}>{photoBusy ? 'Updating…' : 'Change photo'}</Text>
        </Pressable>
        {creator ? (
          <>
            <Text style={screen.label}>Rename</Text>
            <AppTextInput onChangeText={setName} style={screen.input} value={name} />
            <Pressable onPress={() => void run(() => renameGroup(id, name))} style={screen.save}>
              <Text style={screen.buttonText}>Save name</Text>
            </Pressable>
            <Pressable
              onPress={() => void run(async () => void (await replaceInviteCode(id)))}
              style={screen.button}
            >
              <Text style={screen.buttonText}>Replace code</Text>
            </Pressable>
          </>
        ) : null}
        <Pressable
          onPress={() =>
            void leaveGroup(id)
              .then(() => router.back())
              .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Could not leave'))
          }
          style={({ pressed }) => [screen.leave, pressed && screen.rowPressed]}
        >
          <Text style={screen.leaveText}>Leave group</Text>
        </Pressable>
      </Screen>
      <InfoListModal
        visible={showCode}
        title={group?.name ?? 'Group'}
        subtitle="Invite code"
        rows={
          group?.invite_code
            ? [{ key: 'code', label: 'Code', value: group.invite_code }]
            : []
        }
        emptyMessage="No invite code."
        onClose={() => setShowCode(false)}
      />
      <PhotoLightbox
        visible={lightbox !== null}
        bucket={lightbox?.kind === 'group' ? 'group-avatars' : 'avatars'}
        name={
          lightbox?.kind === 'group'
            ? group?.name
            : lightbox?.kind === 'member'
              ? lightbox.member.display_name
              : null
        }
        path={
          lightbox?.kind === 'group'
            ? group?.avatar_path
            : lightbox?.kind === 'member'
              ? lightbox.member.avatar_path
              : null
        }
        onClose={() => setLightbox(null)}
      />
    </View>
  )
}
