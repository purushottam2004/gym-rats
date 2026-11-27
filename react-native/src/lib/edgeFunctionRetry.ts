import { AppState } from 'react-native'
import {
  isTransientNetworkError,
  sleepMs,
  userFacingNetworkError,
} from './networkError'
import {
  resultFromFunctionsInvoke,
  type VoiceActionErr,
} from './voiceSet'

type VoiceParseFn<T extends { ok: true } | VoiceActionErr> = (
  data: unknown,
  fallbackMessage?: string | null,
) => T

function softenError<T extends { ok: true } | VoiceActionErr>(result: T): T {
  if (result.ok) return result
  return { ok: false, error: userFacingNetworkError(result.error) } as T
}

/** Wait until the app is foregrounded (iOS kills in-flight fetch when suspended). */
export async function waitUntilAppActive(timeoutMs = 120_000): Promise<void> {
  if (AppState.currentState === 'active') return

  await new Promise<void>((resolve) => {
    let settled = false
    const finish = () => {
      if (settled) return
      settled = true
      subscription.remove()
      clearTimeout(timer)
      resolve()
    }
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active') finish()
    })
    const timer = setTimeout(finish, timeoutMs)
    if (AppState.currentState === 'active') finish()
  })
}

/**
 * Invoke an Edge Function and retry transient transport failures after the app
 * is foreground again (common after Submit → switch apps on iOS).
 */
export async function invokeEdgeFunctionWithRetry<T extends { ok: true } | VoiceActionErr>(
  invoke: () => Promise<{ data: unknown; error: unknown }>,
  parse: VoiceParseFn<T>,
  options?: { attempts?: number },
): Promise<T> {
  const attempts = Math.max(1, options?.attempts ?? 3)
  let last: T | null = null

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (attempt > 0) {
      await waitUntilAppActive()
      await sleepMs(350 * attempt)
    }

    const { data, error } = await invoke()
    const result = await resultFromFunctionsInvoke(data, error, parse)
    last = result
    if (result.ok) return result
    if (!isTransientNetworkError(result.error)) return softenError(result)
  }

  return softenError(last as T)
}
