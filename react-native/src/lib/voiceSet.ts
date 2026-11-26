/** Pure helpers for voice Edge Function responses (sets + intakes). */

export type VoiceSetOk = {
  ok: true
  set: {
    id: string
    lift_name: string
    attempt: number
    reps: number
    load_kg: number
    logged_on: string
  }
}

export type VoiceIntakeOk = {
  ok: true
  intake: {
    id: string
    food_name: string
    amount: number
    measure: string
    logged_on: string
  }
}

export type VoiceActionErr = {
  ok: false
  error: string
}

export type VoiceHabitOk = {
  ok: true
  completed: {
    habit_id: string
    habit_name: string
    day_count: number
  }[]
  logged_on: string
}

export type FoodPhotoEstimateOk = {
  ok: true
  food: {
    name: string
    nutrients: {
      nutrient_id: string
      name: string
      unit: string
      amount: number
    }[]
  }
}

export type VoiceSetResult = VoiceSetOk | VoiceActionErr
export type VoiceIntakeResult = VoiceIntakeOk | VoiceActionErr
export type VoiceHabitResult = VoiceHabitOk | VoiceActionErr
export type FoodPhotoEstimateResult = FoodPhotoEstimateOk | VoiceActionErr

function firstNonEmptyString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return null
}

/** Pull a human-readable message out of Edge Function / gateway JSON. */
export function messageFromFunctionBody(data: unknown): string | null {
  if (data == null) return null
  if (typeof data === 'string' && data.trim()) return data.trim()
  if (typeof data !== 'object') return null
  const body = data as Record<string, unknown>
  return firstNonEmptyString(
    body.error,
    body.message,
    body.msg,
    body.hint,
    typeof body.details === 'string' ? body.details : null,
  )
}

export function parseVoiceSetResponse(data: unknown, fallbackMessage?: string | null): VoiceSetResult {
  if (data && typeof data === 'object') {
    const body = data as Record<string, unknown>
    if (body.ok === true && body.set && typeof body.set === 'object') {
      return data as VoiceSetOk
    }
    const fromBody = messageFromFunctionBody(data)
    if (fromBody) {
      return { ok: false, error: fromBody }
    }
  }

  if (fallbackMessage?.trim()) {
    return { ok: false, error: fallbackMessage.trim() }
  }
  if (!data || typeof data !== 'object') {
    return { ok: false, error: 'Empty response from voice set' }
  }
  return { ok: false, error: 'Could not add set from voice' }
}

export function parseVoiceIntakeResponse(
  data: unknown,
  fallbackMessage?: string | null,
): VoiceIntakeResult {
  if (data && typeof data === 'object') {
    const body = data as Record<string, unknown>
    if (body.ok === true && body.intake && typeof body.intake === 'object') {
      return data as VoiceIntakeOk
    }
    const fromBody = messageFromFunctionBody(data)
    if (fromBody) {
      return { ok: false, error: fromBody }
    }
  }

  if (fallbackMessage?.trim()) {
    return { ok: false, error: fallbackMessage.trim() }
  }
  if (!data || typeof data !== 'object') {
    return { ok: false, error: 'Empty response from voice food' }
  }
  return { ok: false, error: 'Could not add food from voice' }
}

export function parseVoiceHabitResponse(
  data: unknown,
  fallbackMessage?: string | null,
): VoiceHabitResult {
  if (data && typeof data === 'object') {
    const body = data as Record<string, unknown>
    if (body.ok === true && Array.isArray(body.completed)) {
      return data as VoiceHabitOk
    }
    const fromBody = messageFromFunctionBody(data)
    if (fromBody) {
      return { ok: false, error: fromBody }
    }
  }

  if (fallbackMessage?.trim()) {
    return { ok: false, error: fallbackMessage.trim() }
  }
  if (!data || typeof data !== 'object') {
    return { ok: false, error: 'Empty response from voice habits' }
  }
  return { ok: false, error: 'Could not complete habits from voice' }
}

export function parseFoodPhotoEstimateResponse(
  data: unknown,
  fallbackMessage?: string | null,
): FoodPhotoEstimateResult {
  if (data && typeof data === 'object') {
    const body = data as Record<string, unknown>
    if (body.ok === true && body.food && typeof body.food === 'object') {
      const food = body.food as Record<string, unknown>
      if (typeof food.name === 'string' && Array.isArray(food.nutrients)) {
        return data as FoodPhotoEstimateOk
      }
    }
    const fromBody = messageFromFunctionBody(data)
    if (fromBody) {
      return { ok: false, error: fromBody }
    }
  }

  if (fallbackMessage?.trim()) {
    return { ok: false, error: fallbackMessage.trim() }
  }
  if (!data || typeof data !== 'object') {
    return { ok: false, error: 'Empty response from food photo estimate' }
  }
  return { ok: false, error: 'Could not estimate food from photo' }
}

type VoiceParseFn<T extends { ok: true } | VoiceActionErr> = (
  data: unknown,
  fallbackMessage?: string | null,
) => T

/** Prefer the function/gateway body over generic "Failed to send a request…" text. */
export async function resultFromFunctionsInvoke<T extends { ok: true } | VoiceActionErr>(
  data: unknown,
  error: unknown,
  parse: VoiceParseFn<T>,
): Promise<T> {
  if (!error) {
    return parse(data)
  }

  const context = (error as { context?: unknown; message?: string }).context

  if (context && typeof context === 'object' && typeof (context as Response).json === 'function') {
    const response = context as Response
    try {
      const body = await response.clone().json()
      const parsed = parse(body)
      if (!parsed.ok) return parsed
    } catch {
      // not JSON
    }
    try {
      const text = (await response.clone().text()).trim()
      if (text) return { ok: false, error: text } as T
    } catch {
      // ignore
    }
    const status = typeof response.status === 'number' ? response.status : null
    if (status) {
      const base =
        typeof (error as { message?: string }).message === 'string'
          ? (error as { message: string }).message
          : 'Edge Function error'
      return { ok: false, error: `${base} (HTTP ${status})` } as T
    }
  }

  if (context instanceof Error && context.message.trim()) {
    const outer =
      typeof (error as { message?: string }).message === 'string'
        ? (error as { message: string }).message.trim()
        : ''
    const inner = context.message.trim()
    if (outer && outer !== inner) {
      return { ok: false, error: `${outer}: ${inner}` } as T
    }
    return { ok: false, error: inner } as T
  }

  if (typeof context === 'string' && context.trim()) {
    return { ok: false, error: context.trim() } as T
  }

  const message =
    typeof (error as { message?: string }).message === 'string'
      ? (error as { message: string }).message
      : null
  return parse(data, message)
}

export function bytesToBase64(bytes: Uint8Array): string {
  const chunkSize = 0x8000
  let binary = ''
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize)
    binary += String.fromCharCode(...chunk)
  }
  return btoa(binary)
}
