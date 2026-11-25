const SET_NUMBERS = [1, 2, 3, 4, 5] as const

export type SetAttempt = (typeof SET_NUMBERS)[number]

/** First unused set number in 1–5, or 1 when all are taken. */
export function nextSetAttempt(attempts: number[]): SetAttempt {
  const used = new Set(attempts)
  for (const n of SET_NUMBERS) {
    if (!used.has(n)) return n
  }
  return 1
}
