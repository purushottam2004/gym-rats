import { useLocalSearchParams } from 'expo-router'
import { Dumbbell, Image as ImageIcon, Mic, UserRound, Users, Utensils } from 'lucide-react-native'
import { useState, type ReactNode } from 'react'
import { Pressable, Text, View } from 'react-native'
import { Avatar } from '../components/Avatar'
import { DayControls } from '../components/DayControls'
import { InfoButton } from '../components/InfoButton'
import { Screen } from '../components/Screen'
import { TabChrome } from '../components/TabChrome'
import { screen } from '../components/screenStyles'
import { localDate } from '../lib/localDate'

const tabs = ['diet', 'lifts', 'groups', 'posts', 'profile'] as const
type Tab = (typeof tabs)[number]

function FakeTabBar({ active }: { active: Tab }) {
  const items: { id: Tab; label: string }[] = [
    { id: 'diet', label: 'Diet' },
    { id: 'lifts', label: 'Lifts' },
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
        borderTopColor: '#e7e5e4',
        backgroundColor: '#ffffff',
      }}
    >
      {items.map((item) => (
        <Text
          key={item.id}
          style={{
            fontSize: 12,
            fontWeight: '600',
            color: item.id === active ? '#c2410c' : '#a8a29e',
          }}
        >
          {item.label}
        </Text>
      ))}
    </View>
  )
}

export default function ChromePreviewScreen() {
  const { tab: raw } = useLocalSearchParams<{ tab?: string }>()
  const tab = (tabs.includes(raw as Tab) ? raw : 'diet') as Tab
  const [day, setDay] = useState(localDate)

  let body: ReactNode = null
  if (tab === 'diet') {
    body = (
      <>
        <TabChrome icon={Utensils} title="Diet" trailing={<DayControls day={day} onChange={setDay} />} />
        <View style={screen.card}>
          <View style={[screen.addRow, screen.addRowFirst]}>
            <Text style={[screen.addText, screen.dietActionSide]}>Add food</Text>
            <View style={screen.dietMicButton}>
              <Mic color="#c2410c" size={20} strokeWidth={2.25} />
            </View>
            <Text style={[screen.addText, screen.dietActionSide]}>View Catalog</Text>
          </View>
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
    body = (
      <>
        <TabChrome icon={Dumbbell} title="Lifts" trailing={<DayControls day={day} onChange={setDay} />} />
        <View style={screen.card}>
          <View style={[screen.addRow, screen.addRowFirst]}>
            <Text style={[screen.addText, screen.dietActionSide]}>Add a set</Text>
            <View style={screen.dietMicButton}>
              <Mic color="#c2410c" size={20} strokeWidth={2.25} />
            </View>
            <Text style={[screen.addText, screen.dietActionSide]}>View Catalogue</Text>
          </View>
        </View>
      </>
    )
  } else if (tab === 'groups') {
    body = (
      <>
        <TabChrome
          icon={Users}
          title="Groups"
          trailing={
            <>
              <Pressable style={screen.chromeAction}>
                <Text style={screen.addText}>Join</Text>
              </Pressable>
              <Pressable style={screen.chromeAction}>
                <Text style={screen.addText}>New</Text>
              </Pressable>
            </>
          }
        />
        <View style={screen.groupBlock}>
          <View style={screen.groupHeaderRow}>
            <View style={screen.groupHeaderMain}>
              <Avatar name="Hemraj Thakre Mitr Parivar" path={null} size={56} />
              <Text numberOfLines={2} style={screen.groupHeaderName}>
                Hemraj Thakre Mitr Parivar
              </Text>
            </View>
            <InfoButton onPress={() => undefined} />
          </View>
          <View style={screen.card}>
            {['Purushottam', 'Vijay', 'Hemraj'].map((name, index) => (
              <View
                key={name}
                style={[screen.row, index === 0 && screen.rowFirst, index === 0 && screen.rowSelected]}
              >
                <View style={screen.memberRow}>
                  <Avatar name={name} path={null} />
                  <Text style={[screen.rowTitle, screen.memberName, index === 0 && screen.rowTitleSelected]}>
                    {name}
                  </Text>
                </View>
                {index === 0 ? (
                  <View style={screen.choiceTrail}>
                    <Text style={screen.youLabel}>You</Text>
                    <Text style={screen.muted}>Creator</Text>
                  </View>
                ) : null}
              </View>
            ))}
          </View>
        </View>
      </>
    )
  } else if (tab === 'posts') {
    body = (
      <>
        <TabChrome
          icon={ImageIcon}
          title="Posts"
          trailing={
            <Pressable>
              <Text style={screen.addText}>New</Text>
            </Pressable>
          }
        />
        <View style={screen.card}>
          <View style={[screen.row, screen.rowFirst]}>
            <View style={screen.memberRow}>
              <Avatar name="Hemraj" path={null} />
              <View style={{ flex: 1 }}>
                <Text style={screen.rowTitle}>Testing</Text>
                <Text style={screen.muted}>Hemraj · Hemraj Thakre Mitr Parivar</Text>
              </View>
            </View>
          </View>
        </View>
      </>
    )
  } else {
    body = (
      <>
        <TabChrome icon={UserRound} title="Profile" />
        <View style={{ alignItems: 'center', gap: 8 }}>
          <View style={{ width: 84, height: 84, borderRadius: 42, backgroundColor: '#e7e5e4' }} />
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
    <View style={{ flex: 1, backgroundColor: '#f5f5f4' }}>
      <Screen>{body}</Screen>
      <FakeTabBar active={tab} />
    </View>
  )
}
