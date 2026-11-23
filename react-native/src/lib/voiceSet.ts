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

export function parseVoiceSetResponse(data: unknown, invokeErrorMessage?: string | null): VoiceSetResult {
  if (invokeErrorMessage) {
    return { ok: false, error: invokeErrorMessage }
  }
  if (!data || typeof data !== 'object') {
    return { ok: false, error: 'Empty response from voice set' }
  }
  const body = data as Record<string, unknown>
  if (body.ok === true && body.set && typeof body.set === 'object') {
    return data as VoiceSetOk
  }
  if (body.ok === false && typeof body.error === 'string' && body.error.trim()) {
    return { ok: false, error: body.error.trim() }
  }
  if (typeof body.error === 'string' && body.error.trim()) {
    return { ok: false, error: body.error.trim() }
  }
  if (typeof body.message === 'string' && body.message.trim()) {
    return { ok: false, error: body.message.trim() }
  }
  return { ok: false, error: 'Could not add set from voice' }
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
