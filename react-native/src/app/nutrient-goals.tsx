import { useFocusEffect } from 'expo-router'
import { ChevronDown, ChevronRight, Plus, Trash2 } from 'lucide-react-native'
import { useCallback, useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { useAuth } from '../auth/AuthProvider'
import { AppTextInput } from '../components/AppTextInput'
import { Screen } from '../components/Screen'
import { TimePickerField } from '../components/TimePickerField'
import { formatReminderTime } from '../lib/habitReminders'
import {
  loadNutrientGoalMilestones,
  loadNutrientGoals,
  loadNutrients,
  saveNutrientGoals,
  type Nutrient,
} from '../lib/gym'
import { localDate } from '../lib/localDate'
import { syncNutrientRemindersForUser } from '../lib/nutrientReminderSync'
import {
  normalizeMilestoneDrafts,
  normalizeNutrientReminderInput,
  type MilestoneDraft,
} from '../lib/nutrientTargetReminders'
import { useScreenStyles, useTheme } from '../theme/ThemeProvider'

type NutrientDraft = {
  min: string
  max: string
  remindEnabled: boolean
  firstTime: string
  everyMinutes: string
  milestones: MilestoneDraft[]
}

function emptyDraft(): NutrientDraft {
  return {
    min: '',
    max: '',
    remindEnabled: false,
    firstTime: '12:00',
    everyMinutes: '',
    milestones: [],
  }
}

function newMilestoneKey(): string {
  return `m-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function draftNeedsScheduleOpen(draft: NutrientDraft): boolean {
  return draft.remindEnabled || draft.milestones.length > 0
}

export default function NutrientGoalsScreen() {
  const screen = useScreenStyles()
  const { colors } = useTheme()
  const { session } = useAuth()
  const userId = session?.user.id
  const [nutrients, setNutrients] = useState<Nutrient[]>([])
  const [drafts, setDrafts] = useState<Record<string, NutrientDraft>>({})
  const [openSchedule, setOpenSchedule] = useState<Record<string, boolean>>({})
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    if (!userId) return
    try {
      const [nextNutrients, nextGoals, nextMilestones] = await Promise.all([
        loadNutrients(),
        loadNutrientGoals(userId),
        loadNutrientGoalMilestones(userId),
      ])
      const nextDrafts = Object.fromEntries(
        nextNutrients.map((nutrient) => {
          const goal = nextGoals.find((row) => row.nutrient_id === nutrient.id)
          const milestones = nextMilestones
            .filter((row) => row.nutrient_id === nutrient.id)
            .map((row) => ({
              key: row.id,
              timeText: formatReminderTime(row.remind_at),
              amountText: String(row.threshold_amount),
            }))
          return [
            nutrient.id,
            {
              min: goal?.min_amount != null ? String(goal.min_amount) : '',
              max: goal?.max_amount != null ? String(goal.max_amount) : '',
              remindEnabled: Boolean(goal?.remind_enabled),
              firstTime: goal?.remind_first_time
                ? formatReminderTime(goal.remind_first_time)
                : '12:00',
              everyMinutes:
                goal?.remind_every_minutes != null ? String(goal.remind_every_minutes) : '',
              milestones,
            } satisfies NutrientDraft,
          ]
        }),
      )
      setNutrients(nextNutrients)
      setDrafts(nextDrafts)
      setOpenSchedule(
        Object.fromEntries(
          nextNutrients.map((nutrient) => [
            nutrient.id,
            draftNeedsScheduleOpen(nextDrafts[nutrient.id] ?? emptyDraft()),
          ]),
        ),
      )
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load goals')
    }
  }, [userId])

  useFocusEffect(
    useCallback(() => {
      void load()
    }, [load]),
  )

  function parseBound(raw: string, label: string, nutrientName: string): number | null {
    const trimmed = raw.trim()
    if (!trimmed) return null
    const amount = Number(trimmed)
    if (!(amount > 0)) throw new Error(`${nutrientName} ${label} must be greater than zero`)
    return amount
  }

  function patchDraft(nutrientId: string, patch: Partial<NutrientDraft>) {
    setDrafts((current) => ({
      ...current,
      [nutrientId]: { ...(current[nutrientId] ?? emptyDraft()), ...patch },
    }))
  }

  function toggleSchedule(nutrientId: string) {
    setOpenSchedule((current) => ({
      ...current,
      [nutrientId]: !current[nutrientId],
    }))
  }

  async function saveGoals() {
    if (!userId || busy) return
    setBusy(true)
    setError(null)
    try {
      const rows = nutrients.map((nutrient) => {
        const draft = drafts[nutrient.id] ?? emptyDraft()
        const min_amount = parseBound(draft.min, 'min', nutrient.name)
        const max_amount = parseBound(draft.max, 'max', nutrient.name)
        if (min_amount != null && max_amount != null && min_amount > max_amount) {
          throw new Error(`${nutrient.name} min cannot be greater than max`)
        }

        const remind = normalizeNutrientReminderInput({
          enabled: draft.remindEnabled,
          firstTimeText: draft.firstTime,
          everyMinutesText: draft.everyMinutes,
          minAmount: min_amount,
        })
        if (!remind.ok) throw new Error(`${nutrient.name}: ${remind.error}`)

        const milestones = normalizeMilestoneDrafts(draft.milestones, nutrient.name)
        if (!milestones.ok) throw new Error(milestones.error)
        if (milestones.milestones.length > 0 && min_amount == null) {
          throw new Error(`${nutrient.name}: set a min target before adding checkpoints`)
        }

        return {
          nutrient_id: nutrient.id,
          min_amount,
          max_amount,
          remind_enabled: remind.remind_enabled,
          remind_first_time: remind.remind_first_time,
          remind_every_minutes: remind.remind_every_minutes,
          milestones: milestones.milestones,
        }
      })

      await saveNutrientGoals(userId, rows)
      await syncNutrientRemindersForUser(userId, localDate())
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save goals')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Screen
      footer={
        <Pressable
          accessibilityRole="button"
          disabled={busy}
          onPress={() => void saveGoals()}
          style={({ pressed }) => [
            screen.save,
            busy && screen.buttonDisabled,
            pressed && screen.rowPressed,
          ]}
        >
          <Text style={screen.buttonText}>{busy ? 'Saving' : 'Save goals'}</Text>
        </Pressable>
      }
    >
      <Text style={screen.title}>Nutrient goals</Text>
      {error ? <Text style={screen.error}>{error}</Text> : null}

      {nutrients.map((nutrient) => {
        const draft = drafts[nutrient.id] ?? emptyDraft()
        const hasMin = draft.min.trim().length > 0
        const scheduleOpen = Boolean(openSchedule[nutrient.id])
        const scheduleSummary = [
          draft.remindEnabled ? 'Reminders on' : null,
          draft.milestones.length > 0
            ? `${draft.milestones.length} checkpoint${draft.milestones.length === 1 ? '' : 's'}`
            : null,
        ]
          .filter(Boolean)
          .join(' · ')

        return (
          <View key={nutrient.id} style={screen.card}>
            <View style={[screen.row, screen.rowFirst]}>
              <View style={screen.rowMain}>
                <Text style={screen.rowTitle}>{nutrient.name}</Text>
                <Text style={screen.muted}>{nutrient.unit}</Text>
              </View>
              <AppTextInput
                keyboardType="decimal-pad"
                onChangeText={(value) => {
                  patchDraft(nutrient.id, { min: value })
                  if (value.trim().length > 0 && draftNeedsScheduleOpen(draft)) {
                    setOpenSchedule((current) => ({ ...current, [nutrient.id]: true }))
                  }
                }}
                placeholder="min"
                style={[screen.input, screen.goalBoundInput]}
                value={draft.min}
              />
              <AppTextInput
                keyboardType="decimal-pad"
                onChangeText={(value) => patchDraft(nutrient.id, { max: value })}
                placeholder="max"
                style={[screen.input, screen.goalBoundInput]}
                value={draft.max}
              />
            </View>

            {hasMin ? (
              <>
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ expanded: scheduleOpen }}
                  onPress={() => toggleSchedule(nutrient.id)}
                  style={({ pressed }) => [screen.row, pressed && screen.rowPressed]}
                >
                  <View style={screen.rowMain}>
                    <Text style={screen.rowTitle}>Reminders & checkpoints</Text>
                    {scheduleSummary ? (
                      <Text style={screen.muted}>{scheduleSummary}</Text>
                    ) : (
                      <Text style={screen.muted}>Optional</Text>
                    )}
                  </View>
                  {scheduleOpen ? (
                    <ChevronDown color={colors.textMuted} size={18} strokeWidth={2} />
                  ) : (
                    <ChevronRight color={colors.textMuted} size={18} strokeWidth={2} />
                  )}
                </Pressable>

                {scheduleOpen ? (
                  <>
                    <Pressable
                      accessibilityRole="switch"
                      accessibilityState={{ checked: draft.remindEnabled }}
                      onPress={() =>
                        patchDraft(nutrient.id, { remindEnabled: !draft.remindEnabled })
                      }
                      style={({ pressed }) => [screen.row, pressed && screen.rowPressed]}
                    >
                      <Text style={[screen.rowTitle, screen.rowMain]}>Notify me</Text>
                      <Text style={screen.muted}>{draft.remindEnabled ? 'On' : 'Off'}</Text>
                    </Pressable>

                    {draft.remindEnabled ? (
                      <>
                        <View style={screen.row}>
                          <Text style={[screen.rowTitle, screen.rowMain]}>First at</Text>
                          <TimePickerField
                            onChange={(value) =>
                              patchDraft(nutrient.id, { firstTime: value })
                            }
                            style={{ width: 112, paddingVertical: 6, textAlign: 'center' }}
                            value={draft.firstTime}
                          />
                        </View>
                        <View style={screen.row}>
                          <Text style={[screen.rowTitle, screen.rowMain]}>Every (min)</Text>
                          <AppTextInput
                            keyboardType="number-pad"
                            onChangeText={(value) =>
                              patchDraft(nutrient.id, { everyMinutes: value })
                            }
                            placeholder="once"
                            style={[screen.input, screen.goalBoundInput]}
                            value={draft.everyMinutes}
                          />
                        </View>
                      </>
                    ) : null}

                    {draft.milestones.map((milestone, index) => (
                      <View key={milestone.key} style={screen.row}>
                        <View style={{ flex: 1, gap: 6 }}>
                          <Text style={screen.muted}>By</Text>
                          <TimePickerField
                            onChange={(value) => {
                              const next = draft.milestones.slice()
                              next[index] = { ...milestone, timeText: value }
                              patchDraft(nutrient.id, { milestones: next })
                            }}
                            value={milestone.timeText}
                          />
                        </View>
                        <View style={{ flex: 1, gap: 6 }}>
                          <Text style={screen.muted}>Meet ({nutrient.unit})</Text>
                          <AppTextInput
                            keyboardType="decimal-pad"
                            onChangeText={(value) => {
                              const next = draft.milestones.slice()
                              next[index] = { ...milestone, amountText: value }
                              patchDraft(nutrient.id, { milestones: next })
                            }}
                            placeholder="amount"
                            style={screen.input}
                            value={milestone.amountText}
                          />
                        </View>
                        <Pressable
                          accessibilityLabel="Remove checkpoint"
                          accessibilityRole="button"
                          hitSlop={8}
                          onPress={() =>
                            patchDraft(nutrient.id, {
                              milestones: draft.milestones.filter(
                                (row) => row.key !== milestone.key,
                              ),
                            })
                          }
                          style={{ paddingTop: 18 }}
                        >
                          <Trash2 color={colors.danger} size={18} strokeWidth={2} />
                        </Pressable>
                      </View>
                    ))}

                    <Pressable
                      accessibilityRole="button"
                      onPress={() =>
                        patchDraft(nutrient.id, {
                          milestones: [
                            ...draft.milestones,
                            { key: newMilestoneKey(), timeText: '15:00', amountText: '' },
                          ],
                        })
                      }
                      style={({ pressed }) => [screen.add, pressed && screen.rowPressed]}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Plus color={colors.accent} size={18} strokeWidth={2.25} />
                        <Text style={screen.addText}>Add checkpoint</Text>
                      </View>
                    </Pressable>
                  </>
                ) : null}
              </>
            ) : null}
          </View>
        )
      })}
    </Screen>
  )
}
