/** Transient transport failures (common when iOS suspends the app mid-request). */
const TRANSIENT_NETWORK_PATTERNS = [
  /network connection was lost/i,
  /network request failed/i,
  /failed to send a request/i,
  /failed to fetch/i,
  /the internet connection appears to be offline/i,
  /the request timed out/i,
  /request timed out/i,
  /connection reset/i,
  /socket is not connected/i,
  /aborted/i,
  /econnreset/i,
  /etimedout/i,
]

export const USER_FACING_NETWORK_ERROR =
  'Could not reach the server. Try again when you are back in the app.'

export function isTransientNetworkError(message: string | null | undefined): boolean {
  const text = message?.trim() ?? ''
  if (!text) return false
  if (text === USER_FACING_NETWORK_ERROR) return true
  return TRANSIENT_NETWORK_PATTERNS.some((pattern) => pattern.test(text))
}

/** Replace raw CFNetwork / fetch jargon with a stable app message. */
export function userFacingNetworkError(message: string | null | undefined): string {
  const text = message?.trim() ?? ''
  if (!text) return USER_FACING_NETWORK_ERROR
  if (isTransientNetworkError(text)) return USER_FACING_NETWORK_ERROR
  return text
}

export function sleepMs(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}
