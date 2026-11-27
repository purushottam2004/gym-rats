import { Tabs } from 'expo-router'
import { BookOpen, Dumbbell, Image as ImageIcon, Repeat, Users, Utensils } from 'lucide-react-native'
import type { LucideIcon } from 'lucide-react-native'
import { useTheme } from '../../theme/ThemeProvider'

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
  const { colors } = useTheme()

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.tabInactive,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
        },
      }}
    >
      <Tabs.Screen
        name="diet"
        options={{
          title: 'Diet',
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon
              icon={Utensils}
              color={typeof color === 'string' ? color : colors.accent}
              size={size}
              focused={focused}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="lifts"
        options={{
          title: 'Lifts',
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon
              icon={Dumbbell}
              color={typeof color === 'string' ? color : colors.accent}
              size={size}
              focused={focused}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="habits"
        options={{
          title: 'Habits',
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon
              icon={Repeat}
              color={typeof color === 'string' ? color : colors.accent}
              size={size}
              focused={focused}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="books"
        options={{
          title: 'Books',
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon
              icon={BookOpen}
              color={typeof color === 'string' ? color : colors.accent}
              size={size}
              focused={focused}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="groups"
        options={{
          title: 'Groups',
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon
              icon={Users}
              color={typeof color === 'string' ? color : colors.accent}
              size={size}
              focused={focused}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="posts"
        options={{
          title: 'Posts',
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon
              icon={ImageIcon}
              color={typeof color === 'string' ? color : colors.accent}
              size={size}
              focused={focused}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          href: null,
          title: 'Profile',
        }}
      />
    </Tabs>
  )
}
