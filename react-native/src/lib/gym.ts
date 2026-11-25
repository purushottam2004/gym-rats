import type { SupabaseClient } from '@supabase/supabase-js'
import { randomFileId } from './fileId'
import type { Basis, Measure } from './measure'
import { getSupabaseClient } from './supabase'
import {
  weekDates,
  type Habit,
  type HabitDayCount,
  type HabitRecurrence,
  type Weekday,
} from './habitSchedule'
import {
  bytesToBase64,
  parseVoiceHabitResponse,
  parseVoiceIntakeResponse,
  parseVoiceSetResponse,
  resultFromFunctionsInvoke,
  type VoiceHabitResult,
  type VoiceIntakeResult,
  type VoiceSetResult,
} from './voiceSet'

export type { VoiceHabitResult, VoiceIntakeResult, VoiceSetResult } from './voiceSet'
export type { Habit, HabitDayCount, HabitRecurrence } from './habitSchedule'

export type { Basis, Measure } from './measure'
export { basisForMeasure, measureLabel } from './measure'

function db(): SupabaseClient {
  return getSupabaseClient()
}

function fail(error: { message: string } | null): void {
  if (error) throw new Error(error.message)
}

export type Profile = {
  id: string
  display_name: string | null
  avatar_path: string | null
}

export type Nutrient = {
  id: string
  name: string
  unit: string
}

export type FoodNutrient = {
  amount: number
  nutrient: Nutrient
}

export type Food = {
  id: string
  name: string
  measure: Measure
  basis: Basis
  nutrients: FoodNutrient[]
}

export type Intake = {
  id: string
  amount: number
  logged_on: string
  food: Food
  /** Present when this Intake was created by completing a Habit. */
  source_habit_id: string | null
  source_habit_name: string | null
}

export type Lift = {
  id: string
  name: string
}

export type SetLog = {
  id: string
  attempt: number
  reps: number
  load_kg: number
  logged_on: string
  created_at: string
  lift: Lift
}

export type Group = {
  id: string
  name: string
  invite_code: string
  creator_id: string
  avatar_path: string | null
}

export type ImageBucket = 'avatars' | 'post-images' | 'group-avatars'

export type Member = Profile & { joined_at: string }

export type Audience = {
  id: string
  kind: 'profile' | 'group'
  group_id: string | null
}

export type Post = {
  id: string
  user_id: string
  body: string | null
  image_path: string | null
  created_at: string
  author: Profile
  audiences: Audience[]
}

export function publicImageUrl(bucket: ImageBucket, path: string | null): string | null {
  if (!path) return null
  return db().storage.from(bucket).getPublicUrl(path).data.publicUrl
}

export async function loadProfile(userId: string): Promise<Profile> {
  const { data, error } = await db()
    .from('users')
    .select('id, display_name, avatar_path')
    .eq('id', userId)
    .single()
  fail(error)
  return data as Profile
}

export async function saveDisplayName(userId: string, name: string): Promise<void> {
  const trimmed = name.trim()
  if (!trimmed) throw new Error('A display name is required')
  const { error } = await db().from('users').update({ display_name: trimmed }).eq('id', userId)
  fail(error)
}

export async function saveAvatarPath(userId: string, path: string): Promise<void> {
  const { error } = await db().from('users').update({ avatar_path: path }).eq('id', userId)
  fail(error)
}

export async function loadNutrients(): Promise<Nutrient[]> {
  const { data, error } = await db().from('nutrients').select('id, name, unit').order('name')
  fail(error)
  return (data ?? []) as Nutrient[]
}

export type NutrientGoal = {
  nutrient_id: string
  min_amount: number | null
  max_amount: number | null
  name: string
  unit: string
}

export async function loadNutrientGoals(userId: string): Promise<NutrientGoal[]> {
  const { data, error } = await db()
    .from('nutrient_goals')
    .select('nutrient_id, min_amount, max_amount, nutrient:nutrients(id, name, unit)')
    .eq('user_id', userId)
  fail(error)
  return (data ?? []).map((row) => {
    const nutrient = row.nutrient as unknown as Nutrient
    return {
      nutrient_id: row.nutrient_id as string,
      min_amount: row.min_amount == null ? null : Number(row.min_amount),
      max_amount: row.max_amount == null ? null : Number(row.max_amount),
      name: nutrient.name,
      unit: nutrient.unit,
    }
  })
}

/** Replace the caller's goals. Blank / non-positive clears a bound; row kept if either bound set. */
export async function saveNutrientGoals(
  userId: string,
  amounts: { nutrient_id: string; min_amount: number | null; max_amount: number | null }[],
): Promise<void> {
  const keep = amounts.filter((row) => row.min_amount != null || row.max_amount != null)
  const { error: delError } = await db().from('nutrient_goals').delete().eq('user_id', userId)
  fail(delError)
  if (keep.length === 0) return
  const { error } = await db().from('nutrient_goals').insert(
    keep.map((row) => ({
      user_id: userId,
      nutrient_id: row.nutrient_id,
      min_amount: row.min_amount,
      max_amount: row.max_amount,
    })),
  )
  fail(error)
}

export async function loadFoods(forUserId?: string): Promise<Food[]> {
  let userId = forUserId
  if (!userId) {
    const { data: userData, error: userError } = await db().auth.getUser()
    fail(userError)
    userId = userData.user?.id
  }
  if (!userId) throw new Error('Not signed in')
  const { data, error } = await db()
    .from('foods')
    .select(
      'id, name, measure, basis, food_nutrients(amount, nutrient:nutrients(id, name, unit))',
    )
    .eq('user_id', userId)
    .order('name')
  fail(error)
  return (data ?? []).map((row) => {
    const nutrients = (row.food_nutrients ?? []) as unknown as {
      amount: number
      nutrient: Nutrient
    }[]
    return {
      id: row.id as string,
      name: row.name as string,
      measure: row.measure as Measure,
      basis: row.basis as Basis,
      nutrients: nutrients.map((item) => ({
        amount: Number(item.amount),
        nutrient: item.nutrient,
      })),
    }
  })
}

export async function deleteFood(foodId: string): Promise<void> {
  const { error } = await db().rpc('delete_food', { p_food_id: foodId })
  fail(error)
}

export { isFoodInUseError } from './foodDelete'

export async function createFood(input: {
  name: string
  measure: Measure
  basis: Basis
  nutrients: { nutrient_id: string; amount: number }[]
}): Promise<string> {
  const { data, error } = await db().rpc('create_food', {
    p_name: input.name,
    p_measure: input.measure,
    p_basis: input.basis,
    p_nutrients: input.nutrients,
  })
  fail(error)
  return data as string
}

export async function loadIntakes(userId: string, day: string): Promise<Intake[]> {
  const { data, error } = await db()
    .from('intakes')
    .select(
      'id, amount, logged_on, source_habit_id, food:foods!intakes_food_id_fkey(id, name, measure, basis, food_nutrients(amount, nutrient:nutrients(id, name, unit))), source_habit:habits!intakes_source_habit_id_fkey(id, name)',
    )
    .eq('user_id', userId)
    .eq('logged_on', day)
    .order('created_at')
  fail(error)
  return (data ?? []).map((row) => {
    const food = row.food as unknown as {
      id: string
      name: string
      measure: Measure
      basis: Basis
      food_nutrients?: { amount: number; nutrient: Nutrient }[]
    }
    const sourceHabit = row.source_habit as unknown as { id: string; name: string } | null
    return {
      id: row.id as string,
      amount: Number(row.amount),
      logged_on: row.logged_on as string,
      source_habit_id: (row.source_habit_id as string | null) ?? null,
      source_habit_name: sourceHabit?.name ?? null,
      food: {
        id: food.id,
        name: food.name,
        measure: food.measure,
        basis: food.basis,
        nutrients: (food.food_nutrients ?? []).map((item) => ({
          amount: Number(item.amount),
          nutrient: item.nutrient,
        })),
      },
    }
  })
}

export async function logIntake(
  foodId: string,
  amount: number,
  day: string,
  opts?: { sourceHabitId?: string },
): Promise<string> {
  const { data: userData, error: userError } = await db().auth.getUser()
  fail(userError)
  const userId = userData.user?.id
  if (!userId) throw new Error('Not signed in')
  const { data, error } = await db()
    .from('intakes')
    .insert({
      user_id: userId,
      food_id: foodId,
      amount,
      logged_on: day,
      source_habit_id: opts?.sourceHabitId ?? null,
    })
    .select('id')
    .single()
  fail(error)
  if (!data?.id) throw new Error('Could not save intake')
  return data.id as string
}

export async function deleteIntake(id: string): Promise<void> {
  const { error } = await db().from('intakes').delete().eq('id', id)
  fail(error)
}

export async function loadLifts(): Promise<Lift[]> {
  const { data, error } = await db().from('lifts').select('id, name').order('name')
  fail(error)
  return (data ?? []) as Lift[]
}

export async function createLift(name: string): Promise<void> {
  const { error } = await db().from('lifts').insert({ name: name.trim() })
  fail(error)
}

export async function deleteLift(liftId: string): Promise<void> {
  const { error } = await db().from('lifts').delete().eq('id', liftId)
  fail(error)
}

export { isLiftInUseError } from './liftDelete'

export type WeekdayLift = Lift & {
  weekday: number
  position: number
}

export async function loadWeekdayLifts(userId: string, weekday: number): Promise<Lift[]> {
  const { data, error } = await db()
    .from('weekday_lifts')
    .select('position, lift:lifts!weekday_lifts_lift_id_fkey(id, name)')
    .eq('user_id', userId)
    .eq('weekday', weekday)
    .order('position', { ascending: true })
    .order('created_at', { ascending: true })
  fail(error)
  return (data ?? []).map((row) => row.lift as unknown as Lift)
}

export async function addWeekdayLift(input: {
  userId: string
  weekday: number
  liftId: string
}): Promise<void> {
  const { data: existing, error: existingError } = await db()
    .from('weekday_lifts')
    .select('position')
    .eq('user_id', input.userId)
    .eq('weekday', input.weekday)
  fail(existingError)
  const nextPosition =
    (existing ?? []).reduce((max, row) => Math.max(max, row.position as number), -1) + 1
  const { error } = await db().from('weekday_lifts').insert({
    user_id: input.userId,
    weekday: input.weekday,
    lift_id: input.liftId,
    position: nextPosition,
  })
  fail(error)
}

export async function removeWeekdayLift(input: {
  userId: string
  weekday: number
  liftId: string
}): Promise<void> {
  const { error } = await db()
    .from('weekday_lifts')
    .delete()
    .eq('user_id', input.userId)
    .eq('weekday', input.weekday)
    .eq('lift_id', input.liftId)
  fail(error)
}

export async function loadSets(userId: string, day: string): Promise<SetLog[]> {
  const { data, error } = await db()
    .from('sets')
    .select('id, attempt, reps, load_kg, logged_on, created_at, lift:lifts!sets_lift_id_fkey(id, name)')
    .eq('user_id', userId)
    .eq('logged_on', day)
    .order('attempt', { ascending: true })
    .order('created_at', { ascending: true })
  fail(error)
  return (data ?? []).map((row) => ({
    id: row.id as string,
    attempt: row.attempt as number,
    reps: row.reps as number,
    load_kg: Number(row.load_kg),
    logged_on: row.logged_on as string,
    created_at: row.created_at as string,
    lift: row.lift as unknown as Lift,
  }))
}

export async function logSet(input: {
  liftId: string
  day: string
  attempt: number
  reps: number
  loadKg: number
}): Promise<void> {
  const { data: userData, error: userError } = await db().auth.getUser()
  fail(userError)
  const userId = userData.user?.id
  if (!userId) throw new Error('Not signed in')
  const { error } = await db().from('sets').insert({
    user_id: userId,
    lift_id: input.liftId,
    logged_on: input.day,
    attempt: input.attempt,
    reps: input.reps,
    load_kg: input.loadKg,
  })
  fail(error)
}

/** Sends a recording to the add_set_from_voice Edge Function (OpenAI + insert). */
export async function logSetFromVoice(input: {
  day: string
  audioUri: string
  mimeType: string
}): Promise<VoiceSetResult> {
  const response = await fetch(input.audioUri)
  if (!response.ok) {
    return { ok: false, error: 'Could not read the recording' }
  }
  const bytes = new Uint8Array(await response.arrayBuffer())
  if (bytes.byteLength === 0) {
    return { ok: false, error: 'Recording was empty' }
  }

  const { data, error } = await db().functions.invoke('add_set_from_voice', {
    body: {
      logged_on: input.day,
      audio_base64: bytesToBase64(bytes),
      mime_type: input.mimeType,
    },
  })

  return resultFromFunctionsInvoke(data, error, parseVoiceSetResponse)
}

/** Sends a recording to the add_intake_from_voice Edge Function (OpenAI + insert). */
export async function logIntakeFromVoice(input: {
  day: string
  audioUri: string
  mimeType: string
}): Promise<VoiceIntakeResult> {
  const response = await fetch(input.audioUri)
  if (!response.ok) {
    return { ok: false, error: 'Could not read the recording' }
  }
  const bytes = new Uint8Array(await response.arrayBuffer())
  if (bytes.byteLength === 0) {
    return { ok: false, error: 'Recording was empty' }
  }

  const { data, error } = await db().functions.invoke('add_intake_from_voice', {
    body: {
      logged_on: input.day,
      audio_base64: bytesToBase64(bytes),
      mime_type: input.mimeType,
    },
  })

  return resultFromFunctionsInvoke(data, error, parseVoiceIntakeResponse)
}

export async function deleteSet(id: string): Promise<void> {
  const { error } = await db().from('sets').delete().eq('id', id)
  fail(error)
}

const HABIT_SELECT =
  'id, name, recurrence, frequency, weekdays, sort_order, active, food_id, food_amount, food:foods!habits_food_id_fkey(id, name, measure)'

function mapHabitRow(row: Record<string, unknown>): Habit {
  const foodRaw = row.food as { id: string; name: string; measure: string } | null | undefined
  const foodId = (row.food_id as string | null) ?? null
  const foodAmount =
    row.food_amount == null || row.food_amount === ''
      ? null
      : Number(row.food_amount)
  return {
    id: row.id as string,
    name: row.name as string,
    recurrence: row.recurrence as HabitRecurrence,
    frequency: row.frequency as number,
    weekdays: (row.weekdays as number[]).map((n) => n as Weekday),
    sort_order: row.sort_order as number,
    active: Boolean(row.active),
    food_id: foodId,
    food_amount: foodAmount,
    food:
      foodId && foodRaw
        ? { id: foodRaw.id, name: foodRaw.name, measure: foodRaw.measure }
        : null,
  }
}

/** Active Habits for a user (own or shared-group member), sort order. */
export async function loadHabits(userId: string, opts?: { includeArchived?: boolean }): Promise<Habit[]> {
  let query = db()
    .from('habits')
    .select(HABIT_SELECT)
    .eq('user_id', userId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })
  if (!opts?.includeArchived) {
    query = query.eq('active', true)
  }
  const { data, error } = await query
  fail(error)
  return (data ?? []).map((row) => mapHabitRow(row as Record<string, unknown>))
}

/** Day counts for Habits on a calendar day, plus the Mon–Sun week for per_week progress. */
export async function loadHabitDayCounts(userId: string, day: string): Promise<HabitDayCount[]> {
  const days = weekDates(day)
  const { data, error } = await db()
    .from('habit_day_counts')
    .select('habit_id, logged_on, count')
    .eq('user_id', userId)
    .in('logged_on', days)
  fail(error)
  return (data ?? []).map((row) => ({
    habit_id: row.habit_id as string,
    logged_on: row.logged_on as string,
    count: row.count as number,
  }))
}

export type HabitFoodLinkInput = {
  foodId: string | null
  foodAmount: number | null
}

function normalizeFoodLink(link: HabitFoodLinkInput): {
  food_id: string | null
  food_amount: number | null
} {
  if (!link.foodId || link.foodAmount == null) {
    return { food_id: null, food_amount: null }
  }
  if (!(link.foodAmount > 0)) {
    throw new Error('Food amount must be greater than zero')
  }
  return { food_id: link.foodId, food_amount: link.foodAmount }
}

export async function createHabit(input: {
  name: string
  recurrence: HabitRecurrence
  frequency: number
  weekdays: Weekday[]
  foodId?: string | null
  foodAmount?: number | null
}): Promise<Habit> {
  const { data: userData, error: userError } = await db().auth.getUser()
  fail(userError)
  const userId = userData.user?.id
  if (!userId) throw new Error('Not signed in')

  const existing = await loadHabits(userId, { includeArchived: true })
  const sortOrder =
    existing.reduce((max, habit) => Math.max(max, habit.sort_order), -1) + 1

  const weekdays =
    input.recurrence === 'per_week' ? ([0, 1, 2, 3, 4, 5, 6] as Weekday[]) : input.weekdays
  const foodLink = normalizeFoodLink({
    foodId: input.foodId ?? null,
    foodAmount: input.foodAmount ?? null,
  })
  if (foodLink.food_id) {
    const foods = await loadFoods(userId)
    if (!foods.some((food) => food.id === foodLink.food_id)) {
      throw new Error('Choose a food from your catalog')
    }
  }

  const { data, error } = await db()
    .from('habits')
    .insert({
      user_id: userId,
      name: input.name.trim(),
      recurrence: input.recurrence,
      frequency: input.frequency,
      weekdays,
      sort_order: sortOrder,
      active: true,
      food_id: foodLink.food_id,
      food_amount: foodLink.food_amount,
    })
    .select(HABIT_SELECT)
    .single()
  fail(error)
  return mapHabitRow(data as Record<string, unknown>)
}

export async function updateHabit(input: {
  id: string
  name: string
  recurrence: HabitRecurrence
  frequency: number
  weekdays: Weekday[]
  foodId?: string | null
  foodAmount?: number | null
}): Promise<void> {
  const weekdays =
    input.recurrence === 'per_week' ? ([0, 1, 2, 3, 4, 5, 6] as Weekday[]) : input.weekdays
  const foodLink = normalizeFoodLink({
    foodId: input.foodId ?? null,
    foodAmount: input.foodAmount ?? null,
  })
  if (foodLink.food_id) {
    const { data: userData, error: userError } = await db().auth.getUser()
    fail(userError)
    const userId = userData.user?.id
    if (!userId) throw new Error('Not signed in')
    const foods = await loadFoods(userId)
    if (!foods.some((food) => food.id === foodLink.food_id)) {
      throw new Error('Choose a food from your catalog')
    }
  }
  const { error } = await db()
    .from('habits')
    .update({
      name: input.name.trim(),
      recurrence: input.recurrence,
      frequency: input.frequency,
      weekdays,
      food_id: foodLink.food_id,
      food_amount: foodLink.food_amount,
    })
    .eq('id', input.id)
  fail(error)
}

export async function archiveHabit(id: string): Promise<void> {
  const { error } = await db().from('habits').update({ active: false }).eq('id', id)
  fail(error)
}

export async function reorderHabits(orderedIds: string[]): Promise<void> {
  await Promise.all(
    orderedIds.map(async (id, index) => {
      const { error } = await db().from('habits').update({ sort_order: index }).eq('id', id)
      fail(error)
    }),
  )
}

/** Set absolute day count for a Habit (clamped at 0). Used by swipe ±1. */
export async function setHabitDayCount(input: {
  habitId: string
  day: string
  count: number
}): Promise<number> {
  const { data: userData, error: userError } = await db().auth.getUser()
  fail(userError)
  const userId = userData.user?.id
  if (!userId) throw new Error('Not signed in')

  const next = Math.max(0, Math.floor(input.count))
  if (next === 0) {
    const { error } = await db()
      .from('habit_day_counts')
      .delete()
      .eq('habit_id', input.habitId)
      .eq('logged_on', input.day)
    fail(error)
    return 0
  }

  const { error } = await db().from('habit_day_counts').upsert(
    {
      habit_id: input.habitId,
      user_id: userId,
      logged_on: input.day,
      count: next,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'habit_id,logged_on' },
  )
  fail(error)
  return next
}

export type BumpHabitResult = {
  count: number
  /** True when a linked Food Intake was inserted for this +1. */
  foodLogged?: boolean
  /** Set when the count changed but the linked Food log failed. */
  foodLogError?: string
}

async function readHabitDayCount(habitId: string, day: string): Promise<number> {
  const { data, error } = await db()
    .from('habit_day_counts')
    .select('count')
    .eq('habit_id', habitId)
    .eq('logged_on', day)
    .maybeSingle()
  fail(error)
  return (data?.count as number | undefined) ?? 0
}

/** Increment the selected day's count by delta (may be negative). Syncs linked Diet Intakes. */
export async function bumpHabitDayCount(input: {
  habitId: string
  day: string
  delta: number
}): Promise<BumpHabitResult> {
  const { data: userData, error: userError } = await db().auth.getUser()
  fail(userError)
  const userId = userData.user?.id
  if (!userId) throw new Error('Not signed in')

  const current = await readHabitDayCount(input.habitId, input.day)

  if (input.delta === 0) {
    return { count: current }
  }

  const habits = await loadHabits(userId, { includeArchived: true })
  const habit = habits.find((row) => row.id === input.habitId)
  const hasFoodLink = Boolean(habit?.food_id && habit.food_amount != null)

  // −1 with a food link: delete the Habit-created Intake; DB trigger decrements the count.
  if (input.delta < 0 && hasFoodLink) {
    const { data: linked, error: linkedError } = await db()
      .from('intakes')
      .select('id')
      .eq('source_habit_id', input.habitId)
      .eq('logged_on', input.day)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    fail(linkedError)
    if (linked?.id) {
      await deleteIntake(linked.id as string)
      return { count: await readHabitDayCount(input.habitId, input.day) }
    }
    // No linked Intake left — still lower the Habit count.
    const next = await setHabitDayCount({
      habitId: input.habitId,
      day: input.day,
      count: current + input.delta,
    })
    return { count: next }
  }

  const next = await setHabitDayCount({
    habitId: input.habitId,
    day: input.day,
    count: current + input.delta,
  })

  if (input.delta < 0 || !hasFoodLink || !habit?.food_id || habit.food_amount == null) {
    return { count: next }
  }

  try {
    await logIntake(habit.food_id, habit.food_amount, input.day, {
      sourceHabitId: habit.id,
    })
    return { count: next, foodLogged: true }
  } catch (err) {
    return {
      count: next,
      foodLogError:
        err instanceof Error && err.message.trim()
          ? err.message.trim()
          : 'Could not log linked food',
    }
  }
}

/** Sends a recording to complete_habits_from_voice (OpenAI + bump due Habits). */
export async function completeHabitsFromVoice(input: {
  day: string
  audioUri: string
  mimeType: string
}): Promise<VoiceHabitResult> {
  const response = await fetch(input.audioUri)
  if (!response.ok) {
    return { ok: false, error: 'Could not read the recording' }
  }
  const bytes = new Uint8Array(await response.arrayBuffer())
  if (bytes.byteLength === 0) {
    return { ok: false, error: 'Recording was empty' }
  }

  const { data, error } = await db().functions.invoke('complete_habits_from_voice', {
    body: {
      logged_on: input.day,
      audio_base64: bytesToBase64(bytes),
      mime_type: input.mimeType,
    },
  })

  return resultFromFunctionsInvoke(data, error, parseVoiceHabitResponse)
}


export async function loadGroups(): Promise<Group[]> {
  const { data, error } = await db()
    .from('groups')
    .select('id, name, invite_code, creator_id, avatar_path')
    .order('created_at')
  fail(error)
  return (data ?? []).map((row) => ({
    id: row.id as string,
    name: row.name as string,
    invite_code: row.invite_code as string,
    creator_id: row.creator_id as string,
    avatar_path: (row.avatar_path as string | null) ?? null,
  }))
}

export async function loadMembers(groupId: string): Promise<Member[]> {
  const { data, error } = await db()
    .from('group_members')
    .select('joined_at, user:users!group_members_user_id_fkey(id, display_name, avatar_path)')
    .eq('group_id', groupId)
    .order('joined_at')
  fail(error)
  return (data ?? []).map((row) => {
    const user = row.user as unknown as Profile
    return { ...user, joined_at: row.joined_at as string }
  })
}

export async function createGroup(name: string): Promise<Group> {
  const { data, error } = await db().rpc('create_group', { p_name: name })
  fail(error)
  return data as Group
}

export async function joinGroup(code: string): Promise<void> {
  const { error } = await db().rpc('join_group', { p_code: code })
  fail(error)
}

export async function renameGroup(groupId: string, name: string): Promise<void> {
  const { error } = await db().rpc('rename_group', { p_group_id: groupId, p_name: name })
  fail(error)
}

export async function replaceInviteCode(groupId: string): Promise<string> {
  const { data, error } = await db().rpc('replace_invite_code', { p_group_id: groupId })
  fail(error)
  return data as string
}

export async function removeMember(groupId: string, userId: string): Promise<void> {
  const { error } = await db().rpc('remove_member', { p_group_id: groupId, p_user_id: userId })
  fail(error)
}

export async function leaveGroup(groupId: string): Promise<void> {
  const { error } = await db().rpc('leave_group', { p_group_id: groupId })
  fail(error)
}

export async function setGroupAvatar(groupId: string, path: string): Promise<void> {
  const { error } = await db().rpc('set_group_avatar', { p_group_id: groupId, p_path: path })
  fail(error)
}

export async function loadPosts(): Promise<Post[]> {
  const { data, error } = await db()
    .from('posts')
    .select(
      'id, user_id, body, image_path, created_at, author:users!posts_user_id_fkey(id, display_name, avatar_path), audiences:post_audiences(id, kind, group_id)',
    )
    .order('created_at', { ascending: false })
  fail(error)
  return (data ?? []).map((row) => ({
    id: row.id as string,
    user_id: row.user_id as string,
    body: (row.body as string | null) ?? null,
    image_path: (row.image_path as string | null) ?? null,
    created_at: row.created_at as string,
    author: row.author as unknown as Profile,
    audiences: (row.audiences ?? []) as Audience[],
  }))
}

export async function createPost(input: {
  body: string
  imagePath: string | null
  profile: boolean
  groupIds: string[]
}): Promise<void> {
  const text = input.body.trim()
  if (!text && !input.imagePath) throw new Error('A post needs text or a photo')
  const { data: userData, error: userError } = await db().auth.getUser()
  fail(userError)
  const userId = userData.user?.id
  if (!userId) throw new Error('Not signed in')
  const { data, error } = await db()
    .from('posts')
    .insert({ user_id: userId, body: text || null, image_path: input.imagePath })
    .select('id')
    .single()
  fail(error)
  if (!data) throw new Error('Could not create the post')
  const postId = data.id as string
  const rows = [
    ...(input.profile ? [{ post_id: postId, kind: 'profile', group_id: null }] : []),
    ...input.groupIds.map((groupId) => ({ post_id: postId, kind: 'group', group_id: groupId })),
  ]
  if (rows.length === 0) return
  const { error: audienceError } = await db().from('post_audiences').insert(rows)
  fail(audienceError)
}

export async function deletePost(id: string): Promise<void> {
  const { error } = await db().from('posts').delete().eq('id', id)
  fail(error)
}

export async function uploadImage(
  bucket: ImageBucket,
  ownerId: string,
  uri: string,
): Promise<string> {
  const response = await fetch(uri)
  const bytes = await response.arrayBuffer()
  const path = `${ownerId}/${randomFileId()}.jpg`
  const { error } = await db().storage.from(bucket).upload(path, bytes, {
    contentType: 'image/jpeg',
    upsert: false,
  })
  fail(error)
  return path
}
