import { useFocusEffect, useRouter } from 'expo-router'
import { Users } from 'lucide-react-native'
import { useCallback, useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { useAuth } from '../../auth/AuthProvider'
import { Avatar } from '../../components/Avatar'
import { InfoButton } from '../../components/InfoButton'
import { InfoListModal } from '../../components/InfoListModal'
import { JoinGroupModal } from '../../components/JoinGroupModal'
import { Screen } from '../../components/Screen'
import { TabChrome } from '../../components/TabChrome'
import { screen } from '../../components/screenStyles'
import { joinGroup, loadGroups, loadMembers, type Group, type Member } from '../../lib/gym'

export default function GroupsScreen() {
  const { session } = useAuth()
  const router = useRouter()
  const [groups, setGroups] = useState<Group[]>([])
  const [members, setMembers] = useState<Record<string, Member[]>>({})
  const [code, setCode] = useState('')
  const [joinOpen, setJoinOpen] = useState(false)
  const [joinBusy, setJoinBusy] = useState(false)
  const [joinError, setJoinError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [codeGroup, setCodeGroup] = useState<Group | null>(null)

  const load = useCallback(async () => {
    try {
      const next = await loadGroups()
      const lists = await Promise.all(next.map(async (group) => [group.id, await loadMembers(group.id)] as const))
      setGroups(next)
      setMembers(Object.fromEntries(lists))
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load groups')
    }
  }, [])

  useFocusEffect(
    useCallback(() => {
      void load()
    }, [load]),
  )

  function openJoin() {
    setCode('')
    setJoinError(null)
    setJoinOpen(true)
  }

  function closeJoin() {
    if (joinBusy) return
    setJoinOpen(false)
    setJoinError(null)
  }

  async function join() {
    setJoinBusy(true)
    setJoinError(null)
    try {
      await joinGroup(code)
      setCode('')
      setJoinOpen(false)
      await load()
    } catch (err) {
      setJoinError(err instanceof Error ? err.message : 'Could not join')
    } finally {
      setJoinBusy(false)
    }
  }

  return (
    <View style={{ flex: 1 }}>
      <Screen
        header={
          <TabChrome
            icon={Users}
            title="Groups"
            trailing={
              <>
                <Pressable
                  accessibilityRole="button"
                  onPress={openJoin}
                  style={screen.chromeAction}
                >
                  <Text style={screen.addText}>Join</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => router.push('/new-group')}
                  style={screen.chromeAction}
                >
                  <Text style={screen.addText}>New</Text>
                </Pressable>
              </>
            }
          />
        }
      >
        {error ? <Text style={screen.error}>{error}</Text> : null}
        {groups.map((group) => (
          <View key={group.id} style={screen.groupBlock}>
            <View style={screen.groupHeaderRow}>
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push({ pathname: '/group/[id]', params: { id: group.id } })}
                style={({ pressed }) => [screen.groupHeaderMain, pressed && screen.rowPressed]}
              >
                <Avatar name={group.name} path={null} size={56} />
                <Text numberOfLines={2} style={screen.groupHeaderName}>
                  {group.name}
                </Text>
              </Pressable>
              <InfoButton onPress={() => setCodeGroup(group)} />
            </View>
            <View style={screen.card}>
              {(members[group.id] ?? []).map((member, index) => {
                const isYou = member.id === session?.user.id
                return (
                  <Pressable
                    key={member.id}
                    disabled={isYou}
                    onPress={() => router.push({ pathname: '/member/[id]', params: { id: member.id } })}
                    style={[screen.row, index === 0 && screen.rowFirst, isYou && screen.rowSelected]}
                  >
                    <View style={screen.memberRow}>
                      <Avatar name={member.display_name} path={member.avatar_path} />
                      <Text
                        numberOfLines={1}
                        style={[screen.rowTitle, screen.memberName, isYou && screen.rowTitleSelected]}
                      >
                        {member.display_name ?? 'Unnamed'}
                      </Text>
                    </View>
                    <View style={screen.choiceTrail}>
                      {isYou ? <Text style={screen.youLabel}>You</Text> : null}
                      {member.id === group.creator_id ? <Text style={screen.muted}>Creator</Text> : null}
                    </View>
                  </Pressable>
                )
              })}
            </View>
          </View>
        ))}
      </Screen>
      <JoinGroupModal
        visible={joinOpen}
        code={code}
        busy={joinBusy}
        error={joinError}
        onChangeCode={setCode}
        onJoin={() => void join()}
        onCancel={closeJoin}
      />
      <InfoListModal
        visible={codeGroup !== null}
        title={codeGroup?.name ?? 'Group'}
        subtitle="Invite code"
        rows={
          codeGroup
            ? [{ key: 'code', label: 'Code', value: codeGroup.invite_code }]
            : []
        }
        emptyMessage="No invite code."
        onClose={() => setCodeGroup(null)}
      />
    </View>
  )
}
