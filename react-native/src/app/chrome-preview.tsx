import { useLocalSearchParams } from 'expo-router'
import {
  BookOpen,
  CalendarDays,
  Dumbbell,
  Image as ImageIcon,
  MessageCircle,
  Mic,
  Pencil,
  Plus,
  Repeat,
  SmilePlus,
  Target,
  UserRound,
  Users,
  Utensils,
} from 'lucide-react-native'
import { useState, type ReactNode } from 'react'
import { Pressable, Text, View } from 'react-native'
import { Avatar } from '../components/Avatar'
import { DayControls } from '../components/DayControls'
import { InfoButton } from '../components/InfoButton'
import { Screen } from '../components/Screen'
import { TabChrome } from '../components/TabChrome'
import { useScreenStyles, useTheme } from '../theme/ThemeProvider'
import { localDate } from '../lib/localDate'

const tabs = ['diet', 'lifts', 'habits', 'groups', 'posts', 'profile'] as const
type Tab = (typeof tabs)[number]

function FakeTabBar({ active }: { active: Tab }) {
  const { colors } = useTheme()
  const items: { id: Tab; label: string }[] = [
    { id: 'diet', label: 'Diet' },
    { id: 'lifts', label: 'Lifts' },
    { id: 'habits', label: 'Habits' },
    { id: 'groups', label: 'Groups' },
    { id: 'posts', label: 'Posts' },
    { id: 'profile', label: 'Profile' },
  ]
  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'space-around',
        paddingVertical: 10,
        borderTopWidth: 1,
        borderTopColor: colors.border,
        backgroundColor: colors.surface,
      }}
    >
      {items.map((item) => (
        <Text
          key={item.id}
          style={{
            fontSize: 12,
            fontWeight: '600',
            color: item.id === active ? colors.accent : colors.tabInactive,
          }}
        >
          {item.label}
        </Text>
      ))}
    </View>
  )
}

function IconActionRow({
  second,
}: {
  second: 'week' | 'goals'
}) {
  const screen = useScreenStyles()
  const { colors } = useTheme()
  const SecondIcon = second === 'week' ? CalendarDays : Target
  return (
    <View style={screen.card}>
      <View style={screen.iconActionRow}>
        <View style={screen.iconActionButton}>
          <Plus color={colors.accent} size={22} strokeWidth={2.25} />
        </View>
        <View style={screen.iconActionButton}>
          <SecondIcon color={colors.accent} size={20} strokeWidth={2.25} />
        </View>
        <View style={screen.iconActionButton}>
          <BookOpen color={colors.accent} size={20} strokeWidth={2.25} />
        </View>
        <View style={screen.iconActionButton}>
          <Mic color={colors.accent} size={20} strokeWidth={2.25} />
        </View>
      </View>
    </View>
  )
}

export default function ChromePreviewScreen() {
  const screen = useScreenStyles()
  const { colors } = useTheme()
  const { tab: raw } = useLocalSearchParams<{ tab?: string }>()
  const tab = (tabs.includes(raw as Tab) ? raw : 'diet') as Tab
  const [day, setDay] = useState(localDate)

  let header: ReactNode = null
  let body: ReactNode = null

  if (tab === 'diet') {
    header = (
      <>
        <TabChrome icon={Utensils} title="Diet" trailing={<DayControls day={day} onChange={setDay} />} />
        <IconActionRow second="goals" />
      </>
    )
    body = (
      <>
        <View style={screen.card}>
          {['Oats', 'Eggs', 'Banana', 'Curd', 'Almonds', 'Chicken', 'Rice'].map((name, index) => (
            <View key={name} style={[screen.row, index === 0 && screen.rowFirst]}>
              <Text style={[screen.rowTitle, screen.rowMain]}>{name}</Text>
              <Text style={screen.rowMeta}>1 serving</Text>
            </View>
          ))}
        </View>
        <View style={screen.section}>
          <Text style={screen.sectionTitle}>Today&apos;s Nutrition Summary</Text>
          <View style={screen.card}>
            <View style={[screen.row, screen.rowFirst]}>
              <Text style={screen.muted}>No nutrition logged for this day.</Text>
            </View>
          </View>
        </View>
      </>
    )
  } else if (tab === 'lifts') {
    header = (
      <>
        <TabChrome icon={Dumbbell} title="Lifts" trailing={<DayControls day={day} onChange={setDay} />} />
        <IconActionRow second="week" />
      </>
    )
    body = (
      <View style={screen.card}>
        <View style={[screen.row, screen.rowFirst]}>
          <Text style={screen.muted}>Bench Press</Text>
        </View>
        {[
          { set: 1, reps: 8 },
          { set: 2, reps: 8 },
          { set: 3, reps: 6 },
          { set: 4, reps: 5 },
          { set: 5, reps: 5 },
        ].map((row) => (
          <View key={row.set} style={screen.row}>
            <View style={[screen.rowMain, screen.setLabelRow]}>
              <View style={screen.setBadge}>
                <Text style={screen.setBadgeText}>{row.set}</Text>
              </View>
              <Text style={screen.rowTitle}>{row.reps} reps</Text>
            </View>
            <Text style={screen.rowMeta}>60 kg</Text>
          </View>
        ))}
      </View>
    )
  } else if (tab === 'habits') {
    header = (
      <>
        <TabChrome icon={Repeat} title="Habits" trailing={<DayControls day={day} onChange={setDay} />} />
        <View style={screen.card}>
          <View style={screen.iconActionRow}>
            <View style={screen.iconActionButton}>
              <Pencil color={colors.accent} size={20} strokeWidth={2.25} />
            </View>
            <View style={screen.iconActionButton}>
              <Mic color={colors.accent} size={20} strokeWidth={2.25} />
            </View>
          </View>
        </View>
      </>
    )
    body = (
      <View style={screen.card}>
        {[
          { name: 'Morning Brush', done: 1, target: 1 },
          { name: 'Evening Brush', done: 0, target: 1 },
          { name: 'Mobility', done: 2, target: 3 },
        ].map((row, index) => {
          const progress = row.target > 0 ? Math.min(1, row.done / row.target) : 0
          return (
            <View
              key={row.name}
              style={[
                screen.row,
                index === 0 && screen.rowFirst,
                {
                  overflow: 'hidden',
                  backgroundColor: colors.surface,
                  borderLeftWidth: progress > 0 ? 3 : 0,
                  borderLeftColor: progress > 0 ? colors.habitCompleteBorder : 'transparent',
                },
              ]}
            >
              {progress > 0 ? (
                <View
                  style={{
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    bottom: 0,
                    width: `${progress * 100}%`,
                    backgroundColor: colors.habitCompleteBg,
                  }}
                />
              ) : null}
              <Text style={[screen.rowTitle, screen.rowMain, { zIndex: 1 }]}>{row.name}</Text>
              <Text
                style={[
                  screen.rowMeta,
                  { zIndex: 1 },
                  progress > 0 && {
                    color: colors.habitCompleteText,
                    fontWeight: '700',
                  },
                ]}
              >
                {row.done}/{row.target}
              </Text>
            </View>
          )
        })}
      </View>
    )
  } else if (tab === 'groups') {
    header = (
      <TabChrome
        icon={Users}
        title="Groups"
        trailing={
          <>
            <Pressable style={screen.chromeChip}>
              <Text style={screen.chromeChipText}>Join</Text>
            </Pressable>
            <Pressable style={screen.chromeChip}>
              <Text style={screen.chromeChipText}>New</Text>
            </Pressable>
          </>
        }
      />
    )
    body = (
      <View style={screen.card}>
        {['Hemraj Thakre Mitr Parivar', 'Morning Lifters'].map((name, index) => (
          <View key={name} style={[screen.row, index === 0 && screen.rowFirst]}>
            <View style={screen.memberRow}>
              <Avatar bucket="group-avatars" name={name} path={null} />
              <Text numberOfLines={1} style={[screen.rowTitle, screen.memberName]}>
                {name}
              </Text>
            </View>
            <InfoButton onPress={() => undefined} />
          </View>
        ))}
      </View>
    )
  } else if (tab === 'posts') {
    header = (
      <>
        <TabChrome
          icon={ImageIcon}
          title="Posts"
          trailing={<DayControls day={day} onChange={setDay} />}
        />
        <View style={screen.card}>
          <View style={screen.iconActionRow}>
            <View style={screen.iconActionButton}>
              <Plus color={colors.accent} size={22} strokeWidth={2.25} />
            </View>
          </View>
        </View>
      </>
    )
    body = (
      <View style={screen.postCard}>
        <View style={screen.postTapBody}>
          <Text style={screen.rowTitle}>Testing</Text>
        </View>
        <View style={screen.postBody}>
          <View style={screen.postMetaRow}>
            <Avatar name="Hemraj" path={null} size={40} />
            <View style={screen.rowMain}>
              <Text style={screen.muted}>Hemraj · Hemraj Thakre Mitr Parivar</Text>
            </View>
          </View>
          <View style={screen.reactionChipRow}>
            <View style={[screen.reactionChip, screen.reactionChipMine]}>
              <Text style={screen.reactionChipText}>❤️ 2</Text>
            </View>
            <View style={screen.reactionAvatarChip}>
              <View style={screen.reactionAvatarStack}>
                <View style={[screen.reactionAvatarItem, { zIndex: 2 }]}>
                  <Avatar name="Hemraj" path={null} size={22} />
                </View>
                <View style={[screen.reactionAvatarItem, { marginLeft: -8, zIndex: 1 }]}>
                  <Avatar name="Purushottam" path={null} size={22} />
                </View>
              </View>
            </View>
          </View>
          <View style={screen.postActionRow}>
            <View style={screen.postActionButton}>
              <SmilePlus color={colors.accent} size={18} strokeWidth={2.25} />
            </View>
            <View style={screen.postActionButton}>
              <MessageCircle color={colors.accent} size={18} strokeWidth={2.25} />
              <Text style={screen.postActionLabel}>1</Text>
            </View>
          </View>
        </View>
      </View>
    )
  } else {
    header = <TabChrome icon={UserRound} title="Profile" />
    body = (
      <>
        <View style={{ alignItems: 'center', gap: 8 }}>
          <View
            style={{
              width: 84,
              height: 84,
              borderRadius: 42,
              backgroundColor: colors.avatarFallback,
            }}
          />
          <Text style={screen.sectionTitle}>Purushottam</Text>
        </View>
        <View style={screen.card}>
          <View style={[screen.row, screen.rowFirst]}>
            <Text style={screen.rowTitle}>Edit name</Text>
          </View>
          <View style={screen.row}>
            <Text style={screen.rowTitle}>Edit photo</Text>
          </View>
          <View style={screen.row}>
            <Text style={screen.rowTitle}>Sign out</Text>
          </View>
        </View>
      </>
    )
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.pageBg }}>
      <Screen header={header}>{body}</Screen>
      <FakeTabBar active={tab} />
    </View>
  )
}
