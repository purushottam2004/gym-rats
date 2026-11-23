/** Pure helpers for the add_set_from_voice Edge Function response. */

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

export type VoiceSetErr = {
  ok: false
  error: string
}

export type VoiceSetResult = VoiceSetOk | VoiceSetErr

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

/** Prefer the function/gateway body over generic "Failed to send a request…" text. */
export async function resultFromFunctionsInvoke(
  data: unknown,
  error: unknown,
): Promise<VoiceSetResult> {
  if (!error) {
    return parseVoiceSetResponse(data)
  }

  const context = (error as { context?: unknown; message?: string }).context

  if (context && typeof context === 'object' && typeof (context as Response).json === 'function') {
    const response = context as Response
    try {
      const body = await response.clone().json()
      const parsed = parseVoiceSetResponse(body)
      if (!parsed.ok) return parsed
    } catch {
      // not JSON
    }
    try {
      const text = (await response.clone().text()).trim()
      if (text) return { ok: false, error: text }
    } catch {
      // ignore
    }
    const status = typeof response.status === 'number' ? response.status : null
    if (status) {
      const base =
        typeof (error as { message?: string }).message === 'string'
          ? (error as { message: string }).message
          : 'Edge Function error'
      return { ok: false, error: `${base} (HTTP ${status})` }
    }
  }

  if (context instanceof Error && context.message.trim()) {
    const outer =
      typeof (error as { message?: string }).message === 'string'
        ? (error as { message: string }).message.trim()
        : ''
    const inner = context.message.trim()
    if (outer && outer !== inner) {
      return { ok: false, error: `${outer}: ${inner}` }
    }
    return { ok: false, error: inner }
  }

  if (typeof context === 'string' && context.trim()) {
    return { ok: false, error: context.trim() }
  }

  const message =
    typeof (error as { message?: string }).message === 'string'
      ? (error as { message: string }).message
      : null
  return parseVoiceSetResponse(data, message)
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
