import { X } from 'lucide-react-native'
import { Modal, Pressable, ScrollView, Text, View } from 'react-native'
import { useScreenStyles } from '../theme/ThemeProvider'

export type InfoListRow = {
  key: string
  label: string
  value: string
}

type Props = {
  visible: boolean
  title: string
  subtitle?: string
  rows: InfoListRow[]
  emptyMessage: string
  onClose: () => void
}

export function InfoListModal({ visible, title, subtitle, rows, emptyMessage, onClose }: Props) {
  const screen = useScreenStyles()
  return (
    <Modal animationType="fade" transparent visible={visible} onRequestClose={onClose}>
      <View style={screen.modalBackdrop}>
        <View style={screen.modalCard}>
          <View style={screen.modalHeader}>
            <View style={screen.rowMain}>
              <Text style={screen.sectionTitle}>{title}</Text>
              {subtitle ? <Text style={screen.muted}>{subtitle}</Text> : null}
            </View>
            <Pressable
              accessibilityLabel="Close"
              accessibilityRole="button"
              hitSlop={8}
              onPress={onClose}
            >
              <X color="#78716c" size={22} strokeWidth={1.75} />
            </Pressable>
          </View>
          <ScrollView style={screen.modalScroll}>
            <View style={screen.card}>
              {rows.length > 0 ? (
                rows.map((row, index) => (
                  <View key={row.key} style={[screen.row, index === 0 && screen.rowFirst]}>
                    <Text style={[screen.rowTitle, screen.rowMain]}>{row.label}</Text>
                    <Text style={screen.rowMeta}>{row.value}</Text>
                  </View>
                ))
              ) : (
                <View style={[screen.row, screen.rowFirst]}>
                  <Text style={screen.muted}>{emptyMessage}</Text>
                </View>
              )}
            </View>
          </ScrollView>
          <Pressable
            accessibilityRole="button"
            onPress={onClose}
            style={({ pressed }) => [screen.secondaryButton, pressed && screen.rowPressed]}
          >
            <Text style={screen.secondaryButtonText}>Close</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  )
}
