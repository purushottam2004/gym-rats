import { useFocusEffect, useRouter } from 'expo-router'
import { Users } from 'lucide-react-native'
import { useCallback, useState } from 'react'
import { Pressable, Text, TextInput, View } from 'react-native'
import { useAuth } from '../../auth/AuthProvider'
import { Avatar } from '../../components/Avatar'
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
  const [error, setError] = useState<string | null>(null)

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

  async function join() {
    try {
      await joinGroup(code)
      setCode('')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not join')
    }
  }

  return (
    <Screen>
      <TabChrome
        icon={Users}
        title="Groups"
        trailing={
          <Pressable onPress={() => router.push('/new-group')}>
            <Text style={screen.addText}>New</Text>
          </Pressable>
        }
      />
      {error ? <Text style={screen.error}>{error}</Text> : null}
      <Text style={screen.label}>Invite code</Text>
      <TextInput
        autoCapitalize="characters"
        onChangeText={setCode}
        placeholder="Invite code"
        style={screen.input}
        value={code}
      />
      <Pressable
        accessibilityRole="button"
        onPress={() => void join()}
        style={({ pressed }) => [screen.addCard, pressed && screen.rowPressed]}
      >
        <Text style={screen.addText}>Join with code</Text>
      </Pressable>
      {groups.map((group) => (
        <View key={group.id} style={screen.groupBlock}>
          <Pressable onPress={() => router.push({ pathname: '/group/[id]', params: { id: group.id } })} style={screen.codeCard}>
            <Text style={screen.muted}>{group.name}</Text>
            <Text style={screen.codeValue}>{group.invite_code}</Text>
          </Pressable>
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
  )
}
