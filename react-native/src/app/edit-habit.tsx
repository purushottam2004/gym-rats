import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router'
import { Circle, CircleCheck } from 'lucide-react-native'
import { useCallback, useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { useAuth } from '../auth/AuthProvider'
import { AppTextInput } from '../components/AppTextInput'
import { BrandLoader, LoadingBlock } from '../components/BrandLoader'
import { Screen } from '../components/Screen'
import { Toast, type ToastKind } from '../components/Toast'
import {
  createHabit,
  loadFoods,
  loadGroups,
  loadHabitAudienceGroupIds,
  loadHabitSections,
  loadHabits,
  measureLabel,
  updateHabit,
  type Food,
  type Group,
  type HabitRecurrence,
  type HabitSection,
} from '../lib/gym'
import { WEEKDAY_LABELS, type Weekday } from '../lib/weekday'
import { useScreenStyles, useTheme } from '../theme/ThemeProvider'

const ALL_DAYS: Weekday[] = [0, 1, 2, 3, 4, 5, 6]

export default function EditHabitScreen() {
  const screen = useScreenStyles()
  const { colors } = useTheme()
  const router = useRouter()
  const { session } = useAuth()
  const userId = session?.user.id
  const { id } = useLocalSearchParams<{ id?: string }>()
  const editing = Boolean(id)

  const [name, setName] = useState('')
  const [recurrence, setRecurrence] = useState<HabitRecurrence>('per_day')
  const [frequency, setFrequency] = useState('1')
  const [weekdays, setWeekdays] = useState<Weekday[]>(ALL_DAYS)
  const [sectionId, setSectionId] = useState<string | null>(null)
  const [sections, setSections] = useState<HabitSection[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [shareAll, setShareAll] = useState(true)
  const [sharedGroups, setSharedGroups] = useState<Record<string, boolean>>({})
  const [logFood, setLogFood] = useState(false)
  const [foods, setFoods] = useState<Food[]>([])
  const [foodId, setFoodId] = useState<string | null>(null)
  const [foodAmount, setFoodAmount] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<{ kind: ToastKind; message: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [loaded, setLoaded] = useState(false)

  const load = useCallback(async () => {
    if (!userId) {
      setLoaded(true)
      return
    }
    try {
      const [catalog, nextSections, nextGroups] = await Promise.all([
        loadFoods(userId),
        loadHabitSections(userId),
        loadGroups(),
      ])
      setFoods(catalog)
      setSections(nextSections)
      setGroups(nextGroups)

      if (!editing || !id) {
        setFoodId((current) => current ?? catalog[0]?.id ?? null)
        setShareAll(true)
        setSharedGroups({})
        setLoaded(true)
        return
      }

      const [habits, audienceIds] = await Promise.all([
        loadHabits(userId, { includeArchived: true }),
        loadHabitAudienceGroupIds(id),
      ])
      const habit = habits.find((row) => row.id === id)
      if (!habit || !habit.active) {
        setError('Habit not found')
        setLoaded(true)
        return
      }
      setName(habit.name)
      setRecurrence(habit.recurrence)
      setFrequency(String(habit.frequency))
      setWeekdays(habit.weekdays.slice() as Weekday[])
      setSectionId(habit.section_id)
      if (audienceIds.length === 0) {
        setShareAll(true)
        setSharedGroups({})
      } else {
        setShareAll(false)
        setSharedGroups(Object.fromEntries(audienceIds.map((groupId) => [groupId, true])))
      }
      if (habit.food_id && habit.food_amount != null) {
        setLogFood(true)
        setFoodId(habit.food_id)
        setFoodAmount(String(habit.food_amount))
      } else {
        setLogFood(false)
        setFoodId(catalog[0]?.id ?? null)
        setFoodAmount('')
      }
      setError(null)
      setLoaded(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load habit')
      setLoaded(true)
    }
  }, [editing, id, userId])

  useFocusEffect(
    useCallback(() => {
      void load()
    }, [load]),
  )

  function toggleWeekday(day: Weekday) {
    setWeekdays((prev) => {
      if (prev.includes(day)) {
        if (prev.length === 1) return prev
        return prev.filter((value) => value !== day)
      }
      return [...prev, day].sort((a, b) => a - b) as Weekday[]
    })
  }

  const selectedFood = foods.find((food) => food.id === foodId)

  async function save() {
    const trimmed = name.trim()
    const freq = Number(frequency)
    if (!trimmed) {
      setToast({ kind: 'error', message: 'Name is required' })
      return
    }
    if (!Number.isInteger(freq) || freq < 1) {
      setToast({ kind: 'error', message: 'Frequency must be a whole number, 1 or more' })
      return
    }
    if (recurrence === 'per_day' && weekdays.length === 0) {
      setToast({ kind: 'error', message: 'Pick at least one weekday' })
      return
    }

    let linkFoodId: string | null = null
    let linkAmount: number | null = null
    if (logFood) {
      const amount = Number(foodAmount)
      if (!foodId || !(amount > 0)) {
        setToast({ kind: 'error', message: 'Choose a food and an amount greater than zero' })
        return
      }
      linkFoodId = foodId
      linkAmount = amount
    }

    let shareGroupIds: string[] | null = null
    if (!shareAll) {
      shareGroupIds = groups.filter((group) => sharedGroups[group.id]).map((group) => group.id)
      if (shareGroupIds.length === 0) {
        setToast({ kind: 'error', message: 'Pick at least one group, or share with all groups' })
        return
      }
    }

    setBusy(true)
    try {
      if (editing && id) {
        await updateHabit({
          id,
          name: trimmed,
          recurrence,
          frequency: freq,
          weekdays,
          sectionId,
          foodId: linkFoodId,
          foodAmount: linkAmount,
          shareGroupIds,
        })
      } else {
        await createHabit({
          name: trimmed,
          recurrence,
          frequency: freq,
          weekdays,
          sectionId,
          foodId: linkFoodId,
          foodAmount: linkAmount,
          shareGroupIds,
        })
      }
      router.back()
    } catch (err) {
      setToast({
        kind: 'error',
        message: err instanceof Error ? err.message : 'Could not save habit',
      })
    } finally {
      setBusy(false)
    }
  }

  if (!loaded) {
    return (
      <Screen>
        <LoadingBlock label="Loading habit" />
      </Screen>
    )
  }

  return (
    <View style={{ flex: 1 }}>
      <Screen
        footer={
          <Pressable
            accessibilityRole="button"
            disabled={busy}
            onPress={() => void save()}
            style={[screen.save, busy && screen.buttonDisabled]}
          >
            {busy ? (
              <BrandLoader size="sm" />
            ) : (
              <Text style={screen.buttonText}>{editing ? 'Save' : 'Create'}</Text>
            )}
          </Pressable>
        }
      >
        <Text style={screen.title}>{editing ? 'Edit Habit' : 'New Habit'}</Text>
        {error ? <Text style={screen.error}>{error}</Text> : null}

        <Text style={screen.label}>Name</Text>
        <AppTextInput
          autoCapitalize="words"
          onChangeText={setName}
          placeholder="Morning Brush"
          style={screen.input}
          value={name}
        />

        <Text style={screen.label}>Section</Text>
        <View style={screen.card}>
          <Pressable
            accessibilityRole="radio"
            accessibilityState={{ selected: sectionId == null }}
            onPress={() => setSectionId(null)}
            style={({ pressed }) => [
              screen.row,
              screen.rowFirst,
              sectionId == null && screen.rowSelected,
              pressed && (sectionId == null ? screen.rowSelectedPressed : screen.rowPressed),
            ]}
          >
            <Text style={[screen.rowTitle, sectionId == null && screen.rowTitleSelected]}>
              Other habits
            </Text>
            {sectionId == null ? (
              <CircleCheck color={colors.accent} size={20} strokeWidth={2.25} />
            ) : (
              <Circle color={colors.border} size={20} strokeWidth={1.75} />
            )}
          </Pressable>
          {sections.map((section) => {
            const selected = sectionId === section.id
            return (
              <Pressable
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                key={section.id}
                onPress={() => setSectionId(section.id)}
                style={({ pressed }) => [
                  screen.row,
                  selected && screen.rowSelected,
                  pressed && (selected ? screen.rowSelectedPressed : screen.rowPressed),
                ]}
              >
                <Text style={[screen.rowTitle, selected && screen.rowTitleSelected]}>
                  {section.name}
                </Text>
                {selected ? (
                  <CircleCheck color={colors.accent} size={20} strokeWidth={2.25} />
                ) : (
                  <Circle color={colors.border} size={20} strokeWidth={1.75} />
                )}
              </Pressable>
            )
          })}
        </View>

        <Text style={screen.label}>Recurrence</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          {(
            [
              { value: 'per_day' as const, label: 'Per day' },
              { value: 'per_week' as const, label: 'Per week' },
            ] as const
          ).map((option) => {
            const selected = recurrence === option.value
            return (
              <Pressable
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                key={option.value}
                onPress={() => setRecurrence(option.value)}
                style={({ pressed }) => [
                  {
                    paddingHorizontal: 16,
                    paddingVertical: 10,
                    borderRadius: 999,
                    borderWidth: 1,
                    borderColor: selected ? colors.accentSoftBorder : colors.border,
                    backgroundColor: selected ? colors.accentSoft : colors.surface,
                  },
                  pressed && { opacity: 0.85 },
                ]}
              >
                <Text
                  style={{
                    fontSize: 15,
                    fontWeight: '600',
                    color: selected ? colors.accentText : colors.text,
                  }}
                >
                  {option.label}
                </Text>
              </Pressable>
            )
          })}
        </View>

        <Text style={screen.label}>
          {recurrence === 'per_week' ? 'Times per week' : 'Times per due day'}
        </Text>
        <AppTextInput
          keyboardType="number-pad"
          onChangeText={setFrequency}
          style={screen.input}
          value={frequency}
        />

        {recurrence === 'per_day' ? (
          <>
            <Text style={screen.label}>Weekdays</Text>
            <View style={[screen.setNumberRow, { flexWrap: 'wrap' }]}>
              {WEEKDAY_LABELS.map((day) => {
                const selected = weekdays.includes(day.value)
                return (
                  <Pressable
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: selected }}
                    key={day.value}
                    onPress={() => toggleWeekday(day.value)}
                    style={({ pressed }) => [
                      screen.setNumberCircle,
                      selected && screen.setNumberCircleSelected,
                      pressed && !selected && screen.setNumberCirclePressed,
                    ]}
                  >
                    <Text
                      style={[
                        screen.setNumberCircleText,
                        selected && screen.setNumberCircleTextSelected,
                        { fontSize: 12 },
                      ]}
                    >
                      {day.short}
                    </Text>
                  </Pressable>
                )
              })}
            </View>
          </>
        ) : (
          <Text style={screen.muted}>
            Shows every day. Completions any day count toward this week (Mon–Sun).
          </Text>
        )}

        <Text style={screen.label}>Shared with</Text>
        <Text style={screen.body}>
          By default every Group you share can see this Habit. Turn that off to pick specific
          Groups.
        </Text>
        <View style={screen.card}>
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: shareAll }}
            onPress={() => {
              setShareAll(true)
              setSharedGroups({})
            }}
            style={({ pressed }) => [
              screen.row,
              screen.rowFirst,
              shareAll && screen.rowSelected,
              pressed && (shareAll ? screen.rowSelectedPressed : screen.rowPressed),
            ]}
          >
            <Text style={[screen.rowTitle, shareAll && screen.rowTitleSelected]}>All groups</Text>
            {shareAll ? (
              <CircleCheck color={colors.accent} size={20} strokeWidth={2.25} />
            ) : (
              <Circle color={colors.border} size={20} strokeWidth={1.75} />
            )}
          </Pressable>
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: !shareAll }}
            onPress={() => {
              setShareAll(false)
              if (groups.length > 0) {
                setSharedGroups((current) => {
                  if (Object.values(current).some(Boolean)) return current
                  return Object.fromEntries(groups.map((group) => [group.id, true]))
                })
              }
            }}
            style={({ pressed }) => [
              screen.row,
              !shareAll && screen.rowSelected,
              pressed && (!shareAll ? screen.rowSelectedPressed : screen.rowPressed),
            ]}
          >
            <Text style={[screen.rowTitle, !shareAll && screen.rowTitleSelected]}>
              Specific groups
            </Text>
            {!shareAll ? (
              <CircleCheck color={colors.accent} size={20} strokeWidth={2.25} />
            ) : (
              <Circle color={colors.border} size={20} strokeWidth={1.75} />
            )}
          </Pressable>
        </View>
        {!shareAll ? (
          groups.length > 0 ? (
            <View style={screen.card}>
              {groups.map((group, index) => {
                const checked = Boolean(sharedGroups[group.id])
                return (
                  <Pressable
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked }}
                    key={group.id}
                    onPress={() =>
                      setSharedGroups((current) => ({
                        ...current,
                        [group.id]: !current[group.id],
                      }))
                    }
                    style={({ pressed }) => [
                      screen.row,
                      index === 0 && screen.rowFirst,
                      checked && screen.rowSelected,
                      pressed && (checked ? screen.rowSelectedPressed : screen.rowPressed),
                    ]}
                  >
                    <Text style={[screen.rowTitle, checked && screen.rowTitleSelected]}>
                      {group.name}
                    </Text>
                    {checked ? (
                      <CircleCheck color={colors.accent} size={20} strokeWidth={2.25} />
                    ) : (
                      <Circle color={colors.border} size={20} strokeWidth={1.75} />
                    )}
                  </Pressable>
                )
              })}
            </View>
          ) : (
            <Text style={screen.muted}>Join or create a group before limiting who can see this.</Text>
          )
        ) : null}

        <Text style={screen.label}>Log food when completed</Text>
        <Text style={screen.muted}>
          Optional. Each +1 on a day adds this food to Diet for that day.
        </Text>
        <View style={screen.card}>
          <Pressable
            accessibilityRole="switch"
            accessibilityState={{ checked: logFood }}
            onPress={() => setLogFood((value) => !value)}
            style={[screen.row, screen.rowFirst]}
          >
            <Text style={[screen.rowTitle, screen.rowMain]}>Link a food</Text>
            <Text style={screen.muted}>{logFood ? 'On' : 'Off'}</Text>
          </Pressable>
        </View>

        {logFood ? (
          <>
            {foods.length > 0 ? (
              <View style={screen.card}>
                {foods.map((food, index) => {
                  const selected = foodId === food.id
                  return (
                    <Pressable
                      accessibilityRole="radio"
                      accessibilityState={{ selected }}
                      key={food.id}
                      onPress={() => setFoodId(food.id)}
                      style={({ pressed }) => [
                        screen.row,
                        index === 0 && screen.rowFirst,
                        selected && screen.rowSelected,
                        pressed && (selected ? screen.rowSelectedPressed : screen.rowPressed),
                      ]}
                    >
                      <Text style={[screen.rowTitle, selected && screen.rowTitleSelected]}>
                        {food.name}
                      </Text>
                      <View style={screen.choiceTrail}>
                        <Text style={screen.muted}>{measureLabel(food.measure)}</Text>
                        {selected ? (
                          <CircleCheck color={colors.accent} size={20} strokeWidth={2.25} />
                        ) : (
                          <Circle color={colors.border} size={20} strokeWidth={1.75} />
                        )}
                      </View>
                    </Pressable>
                  )
                })}
              </View>
            ) : (
              <Text style={screen.muted}>Add a food in Diet first, then link it here.</Text>
            )}
            <Text style={screen.label}>
              Amount{selectedFood ? ` (${measureLabel(selectedFood.measure)})` : ''}
            </Text>
            <AppTextInput
              keyboardType="decimal-pad"
              onChangeText={setFoodAmount}
              style={screen.input}
              value={foodAmount}
            />
          </>
        ) : null}
      </Screen>
      <Toast
        visible={toast !== null}
        kind={toast?.kind ?? 'success'}
        message={toast?.message ?? ''}
        onHide={() => setToast(null)}
      />
    </View>
  )
}
