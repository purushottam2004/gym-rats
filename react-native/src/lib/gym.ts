import type { SupabaseClient } from '@supabase/supabase-js'
import { randomFileId } from './fileId'
import { dayBoundsIso } from './localDate'
import type { Basis, Measure } from './measure'
import { getSupabaseClient } from './supabase'
import {
  habitComplete,
  habitDoneOnDay,
  weekDates,
  type Habit,
  type HabitDayCount,
  type HabitRecurrence,
  type HabitSection,
  type Weekday,
} from './habitSchedule'
import { parseReminderTime } from './habitReminders'
import { isFeatureTab, type FeatureRow } from './featureUpdates'
import type { NutrientGoalMilestone } from './nutrientTargetReminders'
import type { ReactionRow } from './postSocial'
import type { Book, BookChapter } from './bookSchedule'
import { invokeEdgeFunctionWithRetry } from './edgeFunctionRetry'
import {
  bytesToBase64,
  parseBookPhotoEstimateResponse,
  parseFoodPhotoEstimateResponse,
  parseVoiceHabitResponse,
  parseVoiceIntakeResponse,
  parseVoiceSetResponse,
  resultFromFunctionsInvoke,
  type BookPhotoEstimateResult,
  type FoodPhotoEstimateResult,
  type VoiceHabitResult,
  type VoiceIntakeResult,
  type VoiceSetResult,
} from './voiceSet'

export type {
  BookPhotoEstimateResult,
  FoodPhotoEstimateResult,
  VoiceHabitResult,
  VoiceIntakeResult,
  VoiceSetResult,
} from './voiceSet'
export type { Habit, HabitDayCount, HabitRecurrence, HabitSection } from './habitSchedule'
export type { Book, BookChapter } from './bookSchedule'

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
  /** One-off log entry; hidden from the food catalog. */
  is_other: boolean
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
  /** Frequency slot 1..n for Habit-linked intakes; null otherwise. */
  source_habit_frequency_index: number | null
}

export type Muscle = {
  id: string
  name: string
  sort_order: number
}

export type Lift = {
  id: string
  name: string
  muscle_id: string | null
  /** Storage path in the lift-images bucket; null = no photo. */
  image_path: string | null
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

export type ImageBucket = 'avatars' | 'post-images' | 'group-avatars' | 'lift-images'

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
  reactions: ReactionRow[]
  comment_count: number
}

export type PostComment = {
  id: string
  post_id: string
  user_id: string
  body: string
  created_at: string
  author: Profile
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

/** Whether the signed-in User may delete shared catalog rows that require Admin (e.g. Muscles). */
export async function loadCurrentUserIsAdmin(): Promise<boolean> {
  const { data: userData, error: userError } = await db().auth.getUser()
  fail(userError)
  const userId = userData.user?.id
  if (!userId) return false
  const { data, error } = await db()
    .from('users')
    .select('is_admin')
    .eq('id', userId)
    .single()
  fail(error)
  return Boolean((data as { is_admin?: boolean } | null)?.is_admin)
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
  remind_enabled: boolean
  remind_first_time: { hour: number; minute: number } | null
  remind_every_minutes: number | null
}

export type NutrientGoalSaveRow = {
  nutrient_id: string
  min_amount: number | null
  max_amount: number | null
  remind_enabled: boolean
  remind_first_time: string | null
  remind_every_minutes: number | null
  milestones: { remind_at: string; threshold_amount: number; sort_order: number }[]
}

export async function loadNutrientGoals(userId: string): Promise<NutrientGoal[]> {
  const { data, error } = await db()
    .from('nutrient_goals')
    .select(
      'nutrient_id, min_amount, max_amount, remind_enabled, remind_first_time, remind_every_minutes, nutrient:nutrients(id, name, unit)',
    )
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
      remind_enabled: Boolean(row.remind_enabled),
      remind_first_time: parseReminderTime(
        row.remind_first_time == null ? null : String(row.remind_first_time),
      ),
      remind_every_minutes:
        row.remind_every_minutes == null ? null : Number(row.remind_every_minutes),
    }
  })
}

export async function loadNutrientGoalMilestones(
  userId: string,
): Promise<NutrientGoalMilestone[]> {
  const { data, error } = await db()
    .from('nutrient_goal_milestones')
    .select('id, nutrient_id, remind_at, threshold_amount, sort_order')
    .eq('user_id', userId)
    .order('sort_order', { ascending: true })
    .order('remind_at', { ascending: true })
  fail(error)
  return (data ?? [])
    .map((row) => {
      const remindAt = parseReminderTime(String(row.remind_at ?? ''))
      if (!remindAt) return null
      return {
        id: row.id as string,
        nutrient_id: row.nutrient_id as string,
        remind_at: remindAt,
        threshold_amount: Number(row.threshold_amount),
        sort_order: Number(row.sort_order ?? 0),
      } satisfies NutrientGoalMilestone
    })
    .filter((row): row is NutrientGoalMilestone => row != null)
}

/** Replace the caller's goals + milestones. Blank / non-positive clears a bound; row kept if either bound set. */
export async function saveNutrientGoals(
  userId: string,
  amounts: NutrientGoalSaveRow[],
): Promise<void> {
  const keep = amounts.filter((row) => row.min_amount != null || row.max_amount != null)
  const { error: delMilestonesError } = await db()
    .from('nutrient_goal_milestones')
    .delete()
    .eq('user_id', userId)
  fail(delMilestonesError)
  const { error: delError } = await db().from('nutrient_goals').delete().eq('user_id', userId)
  fail(delError)
  if (keep.length === 0) return
  const { error } = await db().from('nutrient_goals').insert(
    keep.map((row) => ({
      user_id: userId,
      nutrient_id: row.nutrient_id,
      min_amount: row.min_amount,
      max_amount: row.max_amount,
      remind_enabled: row.remind_enabled,
      remind_first_time: row.remind_first_time,
      remind_every_minutes: row.remind_every_minutes,
    })),
  )
  fail(error)

  const milestoneRows = keep.flatMap((row) =>
    row.milestones.map((milestone) => ({
      user_id: userId,
      nutrient_id: row.nutrient_id,
      remind_at: milestone.remind_at,
      threshold_amount: milestone.threshold_amount,
      sort_order: milestone.sort_order,
    })),
  )
  if (milestoneRows.length === 0) return
  const { error: milestoneError } = await db()
    .from('nutrient_goal_milestones')
    .insert(milestoneRows)
  fail(milestoneError)
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
      'id, name, measure, basis, is_other, food_nutrients(amount, nutrient:nutrients(id, name, unit))',
    )
    .eq('user_id', userId)
    .eq('is_other', false)
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
      is_other: Boolean(row.is_other),
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

/** One-off nutrient log: not added to the food catalog. */
export async function logOtherIntake(input: {
  name: string
  day: string
  nutrients: { nutrient_id: string; amount: number }[]
}): Promise<string> {
  const { data, error } = await db().rpc('log_other_intake', {
    p_name: input.name,
    p_logged_on: input.day,
    p_nutrients: input.nutrients,
  })
  fail(error)
  if (!data) throw new Error('Could not save other intake')
  return data as string
}

export async function loadIntakes(userId: string, day: string): Promise<Intake[]> {
  const { data, error } = await db()
    .from('intakes')
    .select(
      'id, amount, logged_on, source_habit_id, source_habit_frequency_index, food:foods!intakes_food_id_fkey(id, name, measure, basis, is_other, food_nutrients(amount, nutrient:nutrients(id, name, unit))), source_habit:habits!intakes_source_habit_id_fkey(id, name)',
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
      is_other?: boolean
      food_nutrients?: { amount: number; nutrient: Nutrient }[]
    }
    const sourceHabit = row.source_habit as unknown as { id: string; name: string } | null
    return {
      id: row.id as string,
      amount: Number(row.amount),
      logged_on: row.logged_on as string,
      source_habit_id: (row.source_habit_id as string | null) ?? null,
      source_habit_name: sourceHabit?.name ?? null,
      source_habit_frequency_index:
        row.source_habit_frequency_index == null
          ? null
          : Number(row.source_habit_frequency_index),
      food: {
        id: food.id,
        name: food.name,
        measure: food.measure,
        basis: food.basis,
        is_other: Boolean(food.is_other),
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
  opts?: { sourceHabitId?: string; frequencyIndex?: number },
): Promise<string> {
  const { data: userData, error: userError } = await db().auth.getUser()
  fail(userError)
  const userId = userData.user?.id
  if (!userId) throw new Error('Not signed in')
  const sourceHabitId = opts?.sourceHabitId ?? null
  const frequencyIndex =
    sourceHabitId != null
      ? (opts?.frequencyIndex ?? null)
      : null
  if (sourceHabitId != null && (frequencyIndex == null || frequencyIndex < 1)) {
    throw new Error('Habit-linked intake needs a frequency slot')
  }
  const { data, error } = await db()
    .from('intakes')
    .insert({
      user_id: userId,
      food_id: foodId,
      amount,
      logged_on: day,
      source_habit_id: sourceHabitId,
      source_habit_frequency_index: frequencyIndex,
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

function mapLiftRow(row: Record<string, unknown>): Lift {
  return {
    id: row.id as string,
    name: row.name as string,
    muscle_id: (row.muscle_id as string | null) ?? null,
    image_path: (row.image_path as string | null) ?? null,
  }
}

function mapMuscleRow(row: Record<string, unknown>): Muscle {
  return {
    id: row.id as string,
    name: row.name as string,
    sort_order: row.sort_order as number,
  }
}

/** Global muscle names that section the Lift catalog. */
export async function loadMuscles(): Promise<Muscle[]> {
  const { data, error } = await db()
    .from('muscles')
    .select('id, name, sort_order')
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true })
  fail(error)
  return (data ?? []).map((row) => mapMuscleRow(row as Record<string, unknown>))
}

export async function createMuscle(name: string): Promise<Muscle> {
  const existing = await loadMuscles()
  const sortOrder =
    existing.reduce((max, muscle) => Math.max(max, muscle.sort_order), -1) + 1
  const { data, error } = await db()
    .from('muscles')
    .insert({ name: name.trim(), sort_order: sortOrder })
    .select('id, name, sort_order')
    .single()
  fail(error)
  return mapMuscleRow(data as Record<string, unknown>)
}

export async function updateMuscle(input: { id: string; name: string }): Promise<void> {
  const { error } = await db()
    .from('muscles')
    .update({ name: input.name.trim() })
    .eq('id', input.id)
  fail(error)
}

/** Deletes a muscle; linked lifts move to Other (DB ON DELETE SET NULL). */
export async function deleteMuscle(id: string): Promise<void> {
  const { error } = await db().from('muscles').delete().eq('id', id)
  fail(error)
}

export async function reorderMuscles(orderedIds: string[]): Promise<void> {
  for (let index = 0; index < orderedIds.length; index += 1) {
    const { error } = await db()
      .from('muscles')
      .update({ sort_order: index })
      .eq('id', orderedIds[index]!)
    fail(error)
  }
}

async function resolveMuscleId(muscleId: string | null | undefined): Promise<string | null> {
  if (muscleId == null || muscleId === '') return null
  const muscles = await loadMuscles()
  if (!muscles.some((muscle) => muscle.id === muscleId)) {
    throw new Error('Choose a muscle from the catalog')
  }
  return muscleId
}

const LIFT_SELECT = 'id, name, muscle_id, image_path'

export async function loadLifts(): Promise<Lift[]> {
  const { data, error } = await db()
    .from('lifts')
    .select(LIFT_SELECT)
    .order('name')
  fail(error)
  return (data ?? []).map((row) => mapLiftRow(row as Record<string, unknown>))
}

export async function createLift(input: {
  name: string
  muscleId?: string | null
}): Promise<void> {
  const muscleId = await resolveMuscleId(input.muscleId)
  const { error } = await db().from('lifts').insert({
    name: input.name.trim(),
    muscle_id: muscleId,
  })
  fail(error)
}

/** Assign or clear the Muscle for a Lift. */
export async function updateLiftMuscle(input: {
  id: string
  muscleId: string | null
}): Promise<void> {
  const muscleId = await resolveMuscleId(input.muscleId)
  const { error } = await db().from('lifts').update({ muscle_id: muscleId }).eq('id', input.id)
  fail(error)
}

/** Rename a Lift (Admin only; RLS / trigger enforce). */
export async function updateLiftName(input: { id: string; name: string }): Promise<void> {
  const { error } = await db()
    .from('lifts')
    .update({ name: input.name.trim() })
    .eq('id', input.id)
  fail(error)
}

/** Set or replace the catalog photo for a Lift (name stays immutable). */
export async function saveLiftImagePath(liftId: string, path: string): Promise<void> {
  const { error } = await db().from('lifts').update({ image_path: path }).eq('id', liftId)
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
    .select(`position, lift:lifts!weekday_lifts_lift_id_fkey(${LIFT_SELECT})`)
    .eq('user_id', userId)
    .eq('weekday', weekday)
    .order('position', { ascending: true })
    .order('created_at', { ascending: true })
  fail(error)
  return (data ?? []).map((row) => mapLiftRow(row.lift as unknown as Record<string, unknown>))
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
    .select(
      `id, attempt, reps, load_kg, logged_on, created_at, lift:lifts!sets_lift_id_fkey(${LIFT_SELECT})`,
    )
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
    lift: mapLiftRow(row.lift as unknown as Record<string, unknown>),
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

/** Photo → nutrient suggestions for Other. Does not write to the database. */
export async function estimateFoodFromPhoto(input: {
  imageUri: string
  mimeType?: string
}): Promise<FoodPhotoEstimateResult> {
  const response = await fetch(input.imageUri)
  if (!response.ok) {
    return { ok: false, error: 'Could not read the photo' }
  }
  const bytes = new Uint8Array(await response.arrayBuffer())
  if (bytes.byteLength === 0) {
    return { ok: false, error: 'Photo was empty' }
  }

  const headerMime = response.headers.get('content-type')?.split(';')[0]?.trim()
  const mime =
    input.mimeType?.trim() ||
    (headerMime && headerMime.startsWith('image/') ? headerMime : 'image/jpeg')

  return invokeEdgeFunctionWithRetry(
    () =>
      db().functions.invoke('estimate_food_from_photo', {
        body: {
          image_base64: bytesToBase64(bytes),
          mime_type: mime,
        },
      }),
    parseFoodPhotoEstimateResponse,
  )
}

export async function deleteSet(id: string): Promise<void> {
  const { error } = await db().from('sets').delete().eq('id', id)
  fail(error)
}

const HABIT_SELECT =
  'id, name, recurrence, frequency, weekdays, sort_order, active, section_id, food_id, food_amount, remind_enabled, remind_first_time, remind_every_minutes, food:foods!habits_food_id_fkey(id, name, measure)'

function mapHabitRow(row: Record<string, unknown>): Habit {
  const foodRaw = row.food as { id: string; name: string; measure: string } | null | undefined
  const foodId = (row.food_id as string | null) ?? null
  const foodAmount =
    row.food_amount == null || row.food_amount === ''
      ? null
      : Number(row.food_amount)
  const remindEnabled = Boolean(row.remind_enabled)
  const remindFirstRaw =
    typeof row.remind_first_time === 'string' ? row.remind_first_time : null
  const remindFirst = remindEnabled ? parseReminderTime(remindFirstRaw) : null
  const remindEveryRaw = row.remind_every_minutes
  const remindEvery =
    remindEnabled && remindEveryRaw != null && remindEveryRaw !== ''
      ? Number(remindEveryRaw)
      : null
  return {
    id: row.id as string,
    name: row.name as string,
    recurrence: row.recurrence as HabitRecurrence,
    frequency: row.frequency as number,
    weekdays: (row.weekdays as number[]).map((n) => n as Weekday),
    sort_order: row.sort_order as number,
    active: Boolean(row.active),
    section_id: (row.section_id as string | null) ?? null,
    food_id: foodId,
    food_amount: foodAmount,
    food:
      foodId && foodRaw
        ? { id: foodRaw.id, name: foodRaw.name, measure: foodRaw.measure }
        : null,
    remind_enabled: remindEnabled && remindFirst != null,
    remind_first_time: remindFirst,
    remind_every_minutes:
      remindEnabled && remindFirst != null && Number.isInteger(remindEvery) && (remindEvery as number) >= 5
        ? (remindEvery as number)
        : null,
  }
}

function mapHabitSectionRow(row: Record<string, unknown>): HabitSection {
  return {
    id: row.id as string,
    name: row.name as string,
    sort_order: row.sort_order as number,
  }
}

/** Habit sections for a user (own or shared-group member), sort order. */
export async function loadHabitSections(userId: string): Promise<HabitSection[]> {
  const { data, error } = await db()
    .from('habit_sections')
    .select('id, name, sort_order')
    .eq('user_id', userId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })
  fail(error)
  return (data ?? []).map((row) => mapHabitSectionRow(row as Record<string, unknown>))
}

export async function createHabitSection(name: string): Promise<HabitSection> {
  const { data: userData, error: userError } = await db().auth.getUser()
  fail(userError)
  const userId = userData.user?.id
  if (!userId) throw new Error('Not signed in')

  const existing = await loadHabitSections(userId)
  const sortOrder =
    existing.reduce((max, section) => Math.max(max, section.sort_order), -1) + 1

  const { data, error } = await db()
    .from('habit_sections')
    .insert({
      user_id: userId,
      name: name.trim(),
      sort_order: sortOrder,
    })
    .select('id, name, sort_order')
    .single()
  fail(error)
  return mapHabitSectionRow(data as Record<string, unknown>)
}

export async function updateHabitSection(input: { id: string; name: string }): Promise<void> {
  const { error } = await db()
    .from('habit_sections')
    .update({ name: input.name.trim() })
    .eq('id', input.id)
  fail(error)
}

/** Deletes a section; linked habits move to Other (DB ON DELETE SET NULL). */
export async function deleteHabitSection(id: string): Promise<void> {
  const { error } = await db().from('habit_sections').delete().eq('id', id)
  fail(error)
}

export async function reorderHabitSections(orderedIds: string[]): Promise<void> {
  await Promise.all(
    orderedIds.map(async (id, index) => {
      const { error } = await db()
        .from('habit_sections')
        .update({ sort_order: index })
        .eq('id', id)
      fail(error)
    }),
  )
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
    .select('habit_id, logged_on, count, completed_at')
    .eq('user_id', userId)
    .in('logged_on', days)
  fail(error)
  return (data ?? []).map((row) => ({
    habit_id: row.habit_id as string,
    logged_on: row.logged_on as string,
    count: row.count as number,
    completed_at: (row.completed_at as string | null) ?? null,
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

async function resolveHabitSectionId(
  userId: string,
  sectionId: string | null | undefined,
): Promise<string | null> {
  if (sectionId == null || sectionId === '') return null
  const sections = await loadHabitSections(userId)
  if (!sections.some((section) => section.id === sectionId)) {
    throw new Error('Choose a habit section you own')
  }
  return sectionId
}

/**
 * Group ids this Habit is limited to. Empty array → share with every Group
 * (default). Non-empty → only those Groups.
 */
export async function loadHabitAudienceGroupIds(habitId: string): Promise<string[]> {
  const { data, error } = await db()
    .from('habit_audiences')
    .select('group_id')
    .eq('habit_id', habitId)
  fail(error)
  return (data ?? []).map((row) => row.group_id as string)
}

async function replaceHabitAudiences(
  habitId: string,
  shareGroupIds: string[] | null | undefined,
): Promise<void> {
  const { error: clearError } = await db().from('habit_audiences').delete().eq('habit_id', habitId)
  fail(clearError)
  if (shareGroupIds == null) return
  if (shareGroupIds.length === 0) {
    throw new Error('Pick at least one group, or share with all groups')
  }
  const memberships = await loadGroups()
  const allowed = new Set(memberships.map((group) => group.id))
  for (const groupId of shareGroupIds) {
    if (!allowed.has(groupId)) {
      throw new Error('Choose groups you belong to')
    }
  }
  const { error } = await db()
    .from('habit_audiences')
    .insert(shareGroupIds.map((groupId) => ({ habit_id: habitId, group_id: groupId })))
  fail(error)
}

export type HabitReminderInput = {
  remindEnabled: boolean
  /** `HH:MM` when enabled; ignored when disabled. */
  remindFirstTime: string | null
  /** Minutes between follow-ups; null = first only. */
  remindEveryMinutes: number | null
}

function normalizeReminderFields(input: HabitReminderInput): {
  remind_enabled: boolean
  remind_first_time: string | null
  remind_every_minutes: number | null
} {
  if (!input.remindEnabled) {
    return {
      remind_enabled: false,
      remind_first_time: null,
      remind_every_minutes: null,
    }
  }
  const first = parseReminderTime(input.remindFirstTime)
  if (!first) {
    throw new Error('First reminder time must look like 08:00')
  }
  const every = input.remindEveryMinutes
  if (every != null && (!Number.isInteger(every) || every < 5)) {
    throw new Error('Repeat interval must be blank or at least 5 minutes')
  }
  return {
    remind_enabled: true,
    remind_first_time: `${String(first.hour).padStart(2, '0')}:${String(first.minute).padStart(2, '0')}`,
    remind_every_minutes: every,
  }
}

export async function createHabit(input: {
  name: string
  recurrence: HabitRecurrence
  frequency: number
  weekdays: Weekday[]
  sectionId?: string | null
  foodId?: string | null
  foodAmount?: number | null
  /** null/undefined → all groups; otherwise only these group ids */
  shareGroupIds?: string[] | null
  remindEnabled?: boolean
  remindFirstTime?: string | null
  remindEveryMinutes?: number | null
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
  const sectionId = await resolveHabitSectionId(userId, input.sectionId)
  const reminders = normalizeReminderFields({
    remindEnabled: Boolean(input.remindEnabled),
    remindFirstTime: input.remindFirstTime ?? null,
    remindEveryMinutes: input.remindEveryMinutes ?? null,
  })

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
      section_id: sectionId,
      food_id: foodLink.food_id,
      food_amount: foodLink.food_amount,
      remind_enabled: reminders.remind_enabled,
      remind_first_time: reminders.remind_first_time,
      remind_every_minutes: reminders.remind_every_minutes,
    })
    .select(HABIT_SELECT)
    .single()
  fail(error)
  const habit = mapHabitRow(data as Record<string, unknown>)
  await replaceHabitAudiences(habit.id, input.shareGroupIds)
  return habit
}

export async function updateHabit(input: {
  id: string
  name: string
  recurrence: HabitRecurrence
  frequency: number
  weekdays: Weekday[]
  sectionId?: string | null
  foodId?: string | null
  foodAmount?: number | null
  /** null → all groups; array → only these; omit to leave audiences unchanged */
  shareGroupIds?: string[] | null
  remindEnabled?: boolean
  remindFirstTime?: string | null
  remindEveryMinutes?: number | null
}): Promise<void> {
  const weekdays =
    input.recurrence === 'per_week' ? ([0, 1, 2, 3, 4, 5, 6] as Weekday[]) : input.weekdays
  const foodLink = normalizeFoodLink({
    foodId: input.foodId ?? null,
    foodAmount: input.foodAmount ?? null,
  })
  const { data: userData, error: userError } = await db().auth.getUser()
  fail(userError)
  const userId = userData.user?.id
  if (!userId) throw new Error('Not signed in')
  if (foodLink.food_id) {
    const foods = await loadFoods(userId)
    if (!foods.some((food) => food.id === foodLink.food_id)) {
      throw new Error('Choose a food from your catalog')
    }
  }
  const patch: Record<string, unknown> = {
    name: input.name.trim(),
    recurrence: input.recurrence,
    frequency: input.frequency,
    weekdays,
    food_id: foodLink.food_id,
    food_amount: foodLink.food_amount,
  }
  if (input.sectionId !== undefined) {
    patch.section_id = await resolveHabitSectionId(userId, input.sectionId)
  }
  if (input.remindEnabled !== undefined) {
    const reminders = normalizeReminderFields({
      remindEnabled: input.remindEnabled,
      remindFirstTime: input.remindFirstTime ?? null,
      remindEveryMinutes: input.remindEveryMinutes ?? null,
    })
    patch.remind_enabled = reminders.remind_enabled
    patch.remind_first_time = reminders.remind_first_time
    patch.remind_every_minutes = reminders.remind_every_minutes
  }
  const { error } = await db().from('habits').update(patch).eq('id', input.id)
  fail(error)
  if (input.shareGroupIds !== undefined) {
    await replaceHabitAudiences(input.id, input.shareGroupIds)
  }
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

async function readHabitDayCountRow(
  habitId: string,
  day: string,
): Promise<{ count: number; completed_at: string | null }> {
  const { data, error } = await db()
    .from('habit_day_counts')
    .select('count, completed_at')
    .eq('habit_id', habitId)
    .eq('logged_on', day)
    .maybeSingle()
  fail(error)
  return {
    count: (data?.count as number | undefined) ?? 0,
    completed_at: (data?.completed_at as string | null | undefined) ?? null,
  }
}

async function clearWeekCompletedAt(habitId: string, day: string): Promise<void> {
  const days = weekDates(day)
  const { error } = await db()
    .from('habit_day_counts')
    .update({ completed_at: null })
    .eq('habit_id', habitId)
    .in('logged_on', days)
  fail(error)
}

/**
 * Set absolute day count for a Habit (clamped at 0). Used by swipe ±1.
 * Stamps / clears `completed_at` when progress crosses the Habit target.
 */
export async function setHabitDayCount(input: {
  habitId: string
  day: string
  count: number
  habit?: Habit
}): Promise<number> {
  const { data: userData, error: userError } = await db().auth.getUser()
  fail(userError)
  const userId = userData.user?.id
  if (!userId) throw new Error('Not signed in')

  const next = Math.max(0, Math.floor(input.count))
  const habit =
    input.habit ??
    (await loadHabits(userId, { includeArchived: true })).find((row) => row.id === input.habitId)
  if (!habit) throw new Error('Habit not found')

  const existing = await readHabitDayCountRow(input.habitId, input.day)
  const nowIso = new Date().toISOString()

  if (next === 0) {
    const { error } = await db()
      .from('habit_day_counts')
      .delete()
      .eq('habit_id', input.habitId)
      .eq('logged_on', input.day)
    fail(error)
    if (habit.recurrence === 'per_week') {
      const weekCounts = await loadHabitDayCounts(userId, input.day)
      if (!habitComplete(habit, habitDoneOnDay(habit, weekCounts, input.day))) {
        await clearWeekCompletedAt(input.habitId, input.day)
      }
    }
    return 0
  }

  // Provisional row so week sums include the new count when deciding completion.
  const provisionalCounts = await loadHabitDayCounts(userId, input.day)
  const withoutDay = provisionalCounts.filter(
    (row) => !(row.habit_id === input.habitId && row.logged_on === input.day),
  )
  withoutDay.push({
    habit_id: input.habitId,
    logged_on: input.day,
    count: next,
    completed_at: existing.completed_at,
  })
  const willComplete = habitComplete(habit, habitDoneOnDay(habit, withoutDay, input.day))
  let completedAt: string | null = null
  if (willComplete) {
    completedAt = existing.completed_at ?? nowIso
  } else if (habit.recurrence === 'per_week') {
    await clearWeekCompletedAt(input.habitId, input.day)
  }

  const { error } = await db().from('habit_day_counts').upsert(
    {
      habit_id: input.habitId,
      user_id: userId,
      logged_on: input.day,
      count: next,
      updated_at: nowIso,
      completed_at: completedAt,
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
  return (await readHabitDayCountRow(habitId, day)).count
}

/** Linked Diet intakes for a Habit on a day, ordered highest frequency index first. */
async function loadHabitLinkedIntakeStats(
  habitId: string,
  day: string,
): Promise<{ count: number; maxIndex: number; topId: string | null }> {
  const { data, error } = await db()
    .from('intakes')
    .select('id, source_habit_frequency_index')
    .eq('source_habit_id', habitId)
    .eq('logged_on', day)
    .order('source_habit_frequency_index', { ascending: false })
  fail(error)
  const rows = data ?? []
  let maxIndex = 0
  for (const row of rows) {
    const idx = row.source_habit_frequency_index
    if (typeof idx === 'number' && idx > maxIndex) maxIndex = idx
  }
  return {
    count: rows.length,
    maxIndex,
    topId: rows[0]?.id != null ? (rows[0].id as string) : null,
  }
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

  let current = await readHabitDayCount(input.habitId, input.day)

  if (input.delta === 0) {
    return { count: current }
  }

  const habits = await loadHabits(userId, { includeArchived: true })
  const habit = habits.find((row) => row.id === input.habitId)
  const hasFoodLink = Boolean(habit?.food_id && habit.food_amount != null)

  // Keep Habit count aligned with linked intake slots (1..n) before mutating.
  if (hasFoodLink) {
    const linked = await loadHabitLinkedIntakeStats(input.habitId, input.day)
    if (linked.count !== current) {
      current = await setHabitDayCount({
        habitId: input.habitId,
        day: input.day,
        count: linked.count,
        habit,
      })
    }
  }

  // −1 with a food link: delete the downmost slot (highest frequency index).
  // DB trigger decrements the count and remappings remaining indices to 1..n.
  if (input.delta < 0 && hasFoodLink) {
    const linked = await loadHabitLinkedIntakeStats(input.habitId, input.day)
    if (linked.topId) {
      await deleteIntake(linked.topId)
      return { count: await readHabitDayCount(input.habitId, input.day) }
    }
    // No linked Intake left — still lower the Habit count.
    const next = await setHabitDayCount({
      habitId: input.habitId,
      day: input.day,
      count: current + input.delta,
      habit,
    })
    return { count: next }
  }

  if (input.delta < 0 || !hasFoodLink || !habit?.food_id || habit.food_amount == null) {
    const next = await setHabitDayCount({
      habitId: input.habitId,
      day: input.day,
      count: current + input.delta,
      habit,
    })
    return { count: next }
  }

  // +1 with food link: DB allocates the next slot under a day-count row lock
  // (packs gaps, inserts intake, syncs count) so concurrent deletes cannot leave holes.
  try {
    const { data, error } = await db().rpc('bump_habit_linked_intake', {
      p_habit_id: input.habitId,
      p_logged_on: input.day,
    })
    fail(error)
    const row = Array.isArray(data) ? data[0] : data
    const next = Number((row as { day_count?: number } | null)?.day_count)
    if (!Number.isFinite(next) || next < 1) {
      throw new Error('Could not log linked food')
    }
    return { count: next, foodLogged: true }
  } catch (err) {
    return {
      count: await readHabitDayCount(input.habitId, input.day),
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

export async function loadPosts(day: string): Promise<Post[]> {
  const { start, end } = dayBoundsIso(day)
  const { data, error } = await db()
    .from('posts')
    .select(
      'id, user_id, body, image_path, created_at, author:users!posts_user_id_fkey(id, display_name, avatar_path), audiences:post_audiences(id, kind, group_id), reactions:post_reactions(emoji, user_id, reactor:users!post_reactions_user_id_fkey(id, display_name, avatar_path)), comments:post_comments(count)',
    )
    .gte('created_at', start)
    .lt('created_at', end)
    .order('created_at', { ascending: false })
  fail(error)
  return (data ?? []).map((row) => {
    const commentRows = (row.comments ?? []) as { count: number }[]
    return {
      id: row.id as string,
      user_id: row.user_id as string,
      body: (row.body as string | null) ?? null,
      image_path: (row.image_path as string | null) ?? null,
      created_at: row.created_at as string,
      author: row.author as unknown as Profile,
      audiences: (row.audiences ?? []) as Audience[],
      reactions: (
        (row.reactions ?? []) as unknown as {
          emoji: string
          user_id: string
          reactor: Profile | Profile[] | null
        }[]
      ).map((reaction) => {
        const reactor = Array.isArray(reaction.reactor)
          ? (reaction.reactor[0] ?? null)
          : reaction.reactor
        return {
          emoji: reaction.emoji,
          user_id: reaction.user_id,
          display_name: reactor?.display_name ?? null,
          avatar_path: reactor?.avatar_path ?? null,
        }
      }),
      comment_count: commentRows[0]?.count ?? 0,
    }
  })
}

export async function createPost(input: {
  body: string
  imagePath: string | null
  profile: boolean
  groupIds: string[]
}): Promise<void> {
  const text = input.body.trim()
  if (!text && !input.imagePath) throw new Error('A post needs text or a photo')
  if (!input.profile && input.groupIds.length === 0) {
    throw new Error('Choose Profile or at least one group')
  }
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
  const { error: audienceError } = await db().from('post_audiences').insert(rows)
  fail(audienceError)
}

export async function deletePost(id: string): Promise<void> {
  const { error } = await db().from('posts').delete().eq('id', id)
  fail(error)
}

export async function setPostReaction(postId: string, emoji: string): Promise<void> {
  const { data: userData, error: userError } = await db().auth.getUser()
  fail(userError)
  const userId = userData.user?.id
  if (!userId) throw new Error('Not signed in')
  const { error } = await db()
    .from('post_reactions')
    .upsert(
      { post_id: postId, user_id: userId, emoji },
      { onConflict: 'post_id,user_id' },
    )
  fail(error)
}

export async function clearPostReaction(postId: string): Promise<void> {
  const { data: userData, error: userError } = await db().auth.getUser()
  fail(userError)
  const userId = userData.user?.id
  if (!userId) throw new Error('Not signed in')
  const { error } = await db()
    .from('post_reactions')
    .delete()
    .eq('post_id', postId)
    .eq('user_id', userId)
  fail(error)
}

export async function loadPostComments(postId: string): Promise<PostComment[]> {
  const { data, error } = await db()
    .from('post_comments')
    .select(
      'id, post_id, user_id, body, created_at, author:users!post_comments_user_id_fkey(id, display_name, avatar_path)',
    )
    .eq('post_id', postId)
    .order('created_at', { ascending: true })
  fail(error)
  return (data ?? []).map((row) => ({
    id: row.id as string,
    post_id: row.post_id as string,
    user_id: row.user_id as string,
    body: row.body as string,
    created_at: row.created_at as string,
    author: row.author as unknown as Profile,
  }))
}

export async function addPostComment(postId: string, body: string): Promise<PostComment> {
  const text = body.trim()
  if (!text) throw new Error('Write a comment first')
  const { data: userData, error: userError } = await db().auth.getUser()
  fail(userError)
  const userId = userData.user?.id
  if (!userId) throw new Error('Not signed in')
  const { data, error } = await db()
    .from('post_comments')
    .insert({ post_id: postId, user_id: userId, body: text })
    .select(
      'id, post_id, user_id, body, created_at, author:users!post_comments_user_id_fkey(id, display_name, avatar_path)',
    )
    .single()
  fail(error)
  if (!data) throw new Error('Could not add the comment')
  return {
    id: data.id as string,
    post_id: data.post_id as string,
    user_id: data.user_id as string,
    body: data.body as string,
    created_at: data.created_at as string,
    author: data.author as unknown as Profile,
  }
}

export async function deletePostComment(id: string): Promise<void> {
  const { error } = await db().from('post_comments').delete().eq('id', id)
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

const BOOK_SELECT =
  'id, title, author, remind_enabled, remind_every_minutes, active, sort_order'

const CHAPTER_SELECT =
  'id, book_id, title, sort_order, page_start, page_end, scheduled_on, due_time, completed_at'

function mapBookRow(row: Record<string, unknown>): Book {
  return {
    id: row.id as string,
    title: String(row.title ?? ''),
    author: (row.author as string | null) ?? null,
    remind_enabled: Boolean(row.remind_enabled),
    remind_every_minutes:
      row.remind_every_minutes == null ? null : Number(row.remind_every_minutes),
    active: row.active !== false,
    sort_order: Number(row.sort_order ?? 0),
  }
}

function mapChapterRow(row: Record<string, unknown>): BookChapter {
  const dueRaw = row.due_time as string | null | undefined
  return {
    id: row.id as string,
    book_id: row.book_id as string,
    title: String(row.title ?? ''),
    sort_order: Number(row.sort_order ?? 0),
    page_start: row.page_start == null ? null : Number(row.page_start),
    page_end: row.page_end == null ? null : Number(row.page_end),
    scheduled_on: (row.scheduled_on as string | null) ?? null,
    due_time: dueRaw ? String(dueRaw).slice(0, 5) : null,
    completed_at: (row.completed_at as string | null) ?? null,
  }
}

export async function loadBooks(userId: string): Promise<Book[]> {
  const { data, error } = await db()
    .from('books')
    .select(BOOK_SELECT)
    .eq('user_id', userId)
    .eq('active', true)
    .order('sort_order')
    .order('created_at')
  fail(error)
  return (data ?? []).map((row) => mapBookRow(row as Record<string, unknown>))
}

export async function loadBook(bookId: string): Promise<Book> {
  const { data, error } = await db().from('books').select(BOOK_SELECT).eq('id', bookId).single()
  fail(error)
  return mapBookRow(data as Record<string, unknown>)
}

export async function loadBookChapters(bookIds: string[]): Promise<BookChapter[]> {
  if (bookIds.length === 0) return []
  const { data, error } = await db()
    .from('book_chapters')
    .select(CHAPTER_SELECT)
    .in('book_id', bookIds)
    .order('sort_order')
    .order('created_at')
  fail(error)
  return (data ?? []).map((row) => mapChapterRow(row as Record<string, unknown>))
}

export async function loadBookAudiences(bookId: string): Promise<Audience[]> {
  const { data, error } = await db()
    .from('book_audiences')
    .select('id, kind, group_id')
    .eq('book_id', bookId)
  fail(error)
  return (data ?? []).map((row) => ({
    id: row.id as string,
    kind: row.kind as 'profile' | 'group',
    group_id: (row.group_id as string | null) ?? null,
  }))
}

export type BookChapterInput = {
  title: string
  page_start?: number | null
  page_end?: number | null
}

export async function createBook(input: {
  userId: string
  title: string
  author?: string | null
  chapters: BookChapterInput[]
  remindEnabled?: boolean
  remindEveryMinutes?: number | null
  profile?: boolean
  groupIds?: string[]
}): Promise<Book> {
  const title = input.title.trim()
  if (!title) throw new Error('Title is required')
  const { data, error } = await db()
    .from('books')
    .insert({
      user_id: input.userId,
      title,
      author: input.author?.trim() || null,
      remind_enabled: Boolean(input.remindEnabled),
      remind_every_minutes: input.remindEnabled
        ? input.remindEveryMinutes ?? null
        : null,
    })
    .select(BOOK_SELECT)
    .single()
  fail(error)
  const book = mapBookRow(data as Record<string, unknown>)

  const chapterRows = input.chapters
    .map((chapter, index) => {
      const chapterTitle = chapter.title.trim()
      if (!chapterTitle) return null
      return {
        book_id: book.id,
        title: chapterTitle,
        sort_order: index,
        page_start: chapter.page_start ?? null,
        page_end: chapter.page_end ?? null,
      }
    })
    .filter((row): row is NonNullable<typeof row> => row != null)

  if (chapterRows.length > 0) {
    const { error: chapterError } = await db().from('book_chapters').insert(chapterRows)
    fail(chapterError)
  }

  await replaceBookAudiences(book.id, {
    profile: Boolean(input.profile),
    groupIds: input.groupIds ?? [],
  })

  return book
}

export async function updateBook(input: {
  bookId: string
  title: string
  author?: string | null
  remindEnabled: boolean
  remindEveryMinutes: number | null
  profile: boolean
  groupIds: string[]
}): Promise<void> {
  const title = input.title.trim()
  if (!title) throw new Error('Title is required')
  const { error } = await db()
    .from('books')
    .update({
      title,
      author: input.author?.trim() || null,
      remind_enabled: input.remindEnabled,
      remind_every_minutes: input.remindEnabled ? input.remindEveryMinutes : null,
    })
    .eq('id', input.bookId)
  fail(error)
  await replaceBookAudiences(input.bookId, {
    profile: input.profile,
    groupIds: input.groupIds,
  })
}

async function replaceBookAudiences(
  bookId: string,
  input: { profile: boolean; groupIds: string[] },
): Promise<void> {
  const { error: clearError } = await db().from('book_audiences').delete().eq('book_id', bookId)
  fail(clearError)
  const rows: { book_id: string; kind: 'profile' | 'group'; group_id: string | null }[] = []
  if (input.profile) {
    rows.push({ book_id: bookId, kind: 'profile', group_id: null })
  }
  for (const groupId of input.groupIds) {
    rows.push({ book_id: bookId, kind: 'group', group_id: groupId })
  }
  if (rows.length === 0) return
  const { error } = await db().from('book_audiences').insert(rows)
  fail(error)
}

export async function scheduleBookChapter(input: {
  chapterId: string
  scheduledOn: string
  dueTime: string
}): Promise<void> {
  const { error } = await db()
    .from('book_chapters')
    .update({
      scheduled_on: input.scheduledOn,
      due_time: input.dueTime,
    })
    .eq('id', input.chapterId)
  fail(error)
}

export async function clearBookChapterSchedule(chapterId: string): Promise<void> {
  const { error } = await db()
    .from('book_chapters')
    .update({ scheduled_on: null, due_time: null })
    .eq('id', chapterId)
  fail(error)
}

export async function updateBookChapterTitle(input: {
  chapterId: string
  title: string
}): Promise<void> {
  const title = input.title.trim()
  if (!title) throw new Error('Chapter title is required')
  const { error } = await db()
    .from('book_chapters')
    .update({ title })
    .eq('id', input.chapterId)
  fail(error)
}

export async function deleteBookChapter(chapterId: string): Promise<void> {
  const { error } = await db().from('book_chapters').delete().eq('id', chapterId)
  fail(error)
}

export async function setBookChapterCompleted(
  chapterId: string,
  completed: boolean,
): Promise<string | null> {
  const completedAt = completed ? new Date().toISOString() : null
  const { error } = await db()
    .from('book_chapters')
    .update({ completed_at: completedAt })
    .eq('id', chapterId)
  fail(error)
  return completedAt
}

export async function addBookChapter(input: {
  bookId: string
  title: string
  sortOrder: number
  pageStart?: number | null
  pageEnd?: number | null
}): Promise<BookChapter> {
  const title = input.title.trim()
  if (!title) throw new Error('Chapter title is required')
  const { data, error } = await db()
    .from('book_chapters')
    .insert({
      book_id: input.bookId,
      title,
      sort_order: input.sortOrder,
      page_start: input.pageStart ?? null,
      page_end: input.pageEnd ?? null,
    })
    .select(CHAPTER_SELECT)
    .single()
  fail(error)
  return mapChapterRow(data as Record<string, unknown>)
}

export async function deleteBook(bookId: string): Promise<void> {
  const { error } = await db().from('books').delete().eq('id', bookId)
  fail(error)
}

/** Multi-photo → title/author/TOC suggestions. Does not write to the database. */
export async function estimateBookFromPhotos(input: {
  images: { uri: string; mimeType?: string }[]
}): Promise<BookPhotoEstimateResult> {
  if (input.images.length === 0) {
    return { ok: false, error: 'Add at least one photo' }
  }
  const images: { image_base64: string; mime_type: string }[] = []
  for (const image of input.images) {
    const response = await fetch(image.uri)
    if (!response.ok) {
      return { ok: false, error: 'Could not read a photo' }
    }
    const bytes = new Uint8Array(await response.arrayBuffer())
    if (bytes.byteLength === 0) {
      return { ok: false, error: 'A photo was empty' }
    }
    const headerMime = response.headers.get('content-type')?.split(';')[0]?.trim()
    const mime =
      image.mimeType?.trim() ||
      (headerMime && headerMime.startsWith('image/') ? headerMime : 'image/jpeg')
    images.push({ image_base64: bytesToBase64(bytes), mime_type: mime })
  }

  return invokeEdgeFunctionWithRetry(
    () =>
      db().functions.invoke('estimate_book_from_photos', {
        body: { images },
      }),
    parseBookPhotoEstimateResponse,
  )
}

export type { FeatureRow, FeatureTab } from './featureUpdates'

/** All published features with this user's read receipts (null read_at = unread). */
export async function loadFeatures(userId: string): Promise<FeatureRow[]> {
  const [{ data: features, error: featuresError }, { data: reads, error: readsError }] =
    await Promise.all([
      db()
        .from('features')
        .select('id, tab, title, summary, body, sort_order, published_at')
        .order('sort_order', { ascending: true })
        .order('published_at', { ascending: false }),
      db().from('feature_reads').select('feature_id, read_at').eq('user_id', userId),
    ])
  fail(featuresError)
  fail(readsError)

  const readAtById = new Map<string, string>()
  for (const row of reads ?? []) {
    const featureId = row.feature_id as string
    const readAt = row.read_at as string | null
    if (featureId && readAt) readAtById.set(featureId, readAt)
  }

  return (features ?? [])
    .map((row) => {
      const tab = String(row.tab ?? '')
      if (!isFeatureTab(tab)) return null
      return {
        id: row.id as string,
        tab,
        title: String(row.title ?? ''),
        summary: String(row.summary ?? ''),
        body: String(row.body ?? ''),
        sort_order: Number(row.sort_order ?? 0),
        published_at: String(row.published_at ?? ''),
        read_at: readAtById.get(row.id as string) ?? null,
      } satisfies FeatureRow
    })
    .filter((row): row is FeatureRow => row != null)
}

/** Mark a feature read for the signed-in user (idempotent upsert via conflict ignore). */
export async function markFeatureRead(featureId: string): Promise<string> {
  const { data: userData, error: userError } = await db().auth.getUser()
  fail(userError)
  const userId = userData.user?.id
  if (!userId) throw new Error('Not signed in')

  const readAt = new Date().toISOString()
  const { error } = await db().from('feature_reads').upsert(
    {
      user_id: userId,
      feature_id: featureId,
      read_at: readAt,
    },
    { onConflict: 'user_id,feature_id', ignoreDuplicates: true },
  )
  fail(error)
  return readAt
}
