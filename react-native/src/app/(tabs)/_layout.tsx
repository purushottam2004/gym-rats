import { Tabs } from 'expo-router'
import { Dumbbell, Image as ImageIcon, UserRound, Users, Utensils } from 'lucide-react-native'
import type { LucideIcon } from 'lucide-react-native'

const accent = '#c2410c'

function TabIcon({
  icon: Icon,
  color,
  size,
  focused,
}: {
  icon: LucideIcon
  color: string
  size: number
  focused: boolean
}) {
  return <Icon color={color} size={size} strokeWidth={focused ? 2.25 : 1.75} />
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: accent,
        tabBarInactiveTintColor: '#a8a29e',
        tabBarStyle: { backgroundColor: '#ffffff', borderTopColor: '#e7e5e4' },
      }}
    >
      <Tabs.Screen
        name="diet"
        options={{
          title: 'Diet',
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon icon={Utensils} color={typeof color === 'string' ? color : accent} size={size} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="lifts"
        options={{
          title: 'Lifts',
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon icon={Dumbbell} color={typeof color === 'string' ? color : accent} size={size} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="groups"
        options={{
          title: 'Groups',
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon icon={Users} color={typeof color === 'string' ? color : accent} size={size} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="posts"
        options={{
          title: 'Posts',
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon icon={ImageIcon} color={typeof color === 'string' ? color : accent} size={size} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon icon={UserRound} color={typeof color === 'string' ? color : accent} size={size} focused={focused} />
          ),
        }}
      />
    </Tabs>
  )
}
