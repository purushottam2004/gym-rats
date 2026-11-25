import { useFocusEffect, useRouter } from 'expo-router'
import { Users } from 'lucide-react-native'
import { useCallback, useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { Avatar } from '../../components/Avatar'
import { InfoButton } from '../../components/InfoButton'
import { InfoListModal } from '../../components/InfoListModal'
import { JoinGroupModal } from '../../components/JoinGroupModal'
import { Screen } from '../../components/Screen'
import { TabChrome } from '../../components/TabChrome'
import { useScreenStyles } from '../../theme/ThemeProvider'
import { joinGroup, loadGroups, type Group } from '../../lib/gym'

export default function GroupsScreen() {
  const screen = useScreenStyles()
  const router = useRouter()
  const [groups, setGroups] = useState<Group[]>([])
  const [code, setCode] = useState('')
  const [joinOpen, setJoinOpen] = useState(false)
  const [joinBusy, setJoinBusy] = useState(false)
  const [joinError, setJoinError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [codeGroup, setCodeGroup] = useState<Group | null>(null)

  const load = useCallback(async () => {
    try {
      setGroups(await loadGroups())
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
        <View style={screen.card}>
          {groups.length > 0 ? (
            groups.map((group, index) => (
              <View
                key={group.id}
                style={[screen.row, index === 0 && screen.rowFirst]}
              >
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Open ${group.name}`}
                  onPress={() =>
                    router.push({ pathname: '/group/[id]', params: { id: group.id } })
                  }
                  style={({ pressed }) => [
                    screen.memberRow,
                    pressed && screen.rowPressed,
                  ]}
                >
                  <Avatar bucket="group-avatars" name={group.name} path={group.avatar_path} />
                  <Text numberOfLines={1} style={[screen.rowTitle, screen.memberName]}>
                    {group.name}
                  </Text>
                </Pressable>
                <InfoButton onPress={() => setCodeGroup(group)} />
              </View>
            ))
          ) : (
            <View style={[screen.row, screen.rowFirst]}>
              <Text style={screen.muted}>No groups yet. Join one or create a new group.</Text>
            </View>
          )}
        </View>
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
