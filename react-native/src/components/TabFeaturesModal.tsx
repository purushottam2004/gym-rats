import { ChevronLeft, X } from 'lucide-react-native'
import { useState } from 'react'
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useFeatureUpdates } from '../auth/FeatureUpdatesProvider'
import type { FeatureRow, FeatureTab } from '../lib/featureUpdates'
import { useScreenStyles, useTheme } from '../theme/ThemeProvider'

type Props = {
  visible: boolean
  tab: FeatureTab
  title: string
  onClose: () => void
}

export function TabFeaturesModal({ visible, tab, title, onClose }: Props) {
  const screen = useScreenStyles()
  const { colors } = useTheme()
  const { featuresForTab, openFeature } = useFeatureUpdates()
  const rows = featuresForTab(tab)
  const [selected, setSelected] = useState<FeatureRow | null>(null)

  function closeModal() {
    setSelected(null)
    onClose()
  }

  async function openRow(feature: FeatureRow) {
    const next = await openFeature(feature.id)
    setSelected(next ?? feature)
  }

  return (
    <Modal animationType="fade" transparent visible={visible} onRequestClose={closeModal}>
      <View style={screen.modalBackdrop}>
        <View style={screen.modalCard}>
          <View style={screen.modalHeader}>
            <View style={screen.rowMain}>
              {selected ? (
                <Pressable
                  accessibilityLabel="Back to feature list"
                  accessibilityRole="button"
                  hitSlop={8}
                  onPress={() => setSelected(null)}
                  style={styles.backRow}
                >
                  <ChevronLeft color={colors.accent} size={22} strokeWidth={2} />
                  <Text style={screen.sectionTitle}>{selected.title}</Text>
                </Pressable>
              ) : (
                <>
                  <Text style={screen.sectionTitle}>{title}</Text>
                  <Text style={screen.muted}>What&apos;s new on this tab</Text>
                </>
              )}
            </View>
            <Pressable
              accessibilityLabel="Close"
              accessibilityRole="button"
              hitSlop={8}
              onPress={closeModal}
            >
              <X color={colors.textMuted} size={22} strokeWidth={1.75} />
            </Pressable>
          </View>

          <ScrollView style={screen.modalScroll}>
            {selected ? (
              <View style={screen.card}>
                <View style={[screen.row, screen.rowFirst, styles.detailBlock]}>
                  <Text style={screen.body}>{selected.body}</Text>
                </View>
              </View>
            ) : (
              <View style={screen.card}>
                {rows.length > 0 ? (
                  rows.map((row, index) => {
                    const unread = row.read_at == null
                    return (
                      <Pressable
                        key={row.id}
                        accessibilityRole="button"
                        onPress={() => void openRow(row)}
                        style={({ pressed }) => [
                          screen.row,
                          index === 0 && screen.rowFirst,
                          pressed && screen.rowPressed,
                        ]}
                      >
                        <View style={screen.rowMain}>
                          <View style={styles.titleRow}>
                            <Text style={screen.rowTitle}>{row.title}</Text>
                            {unread ? (
                              <View
                                accessibilityLabel="Unread"
                                style={[styles.unreadDot, { backgroundColor: colors.accent }]}
                              />
                            ) : null}
                          </View>
                          <Text style={screen.muted}>{row.summary}</Text>
                        </View>
                      </Pressable>
                    )
                  })
                ) : (
                  <View style={[screen.row, screen.rowFirst]}>
                    <Text style={screen.muted}>No features listed for this tab yet.</Text>
                  </View>
                )}
              </View>
            )}
          </ScrollView>

          <Pressable
            accessibilityRole="button"
            onPress={closeModal}
            style={({ pressed }) => [screen.secondaryButton, pressed && screen.rowPressed]}
          >
            <Text style={screen.secondaryButtonText}>Close</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    minWidth: 0,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  detailBlock: {
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: 8,
  },
})
