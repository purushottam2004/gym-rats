const SET_NUMBERS = [1, 2, 3, 4, 5] as const

export type SetAttempt = (typeof SET_NUMBERS)[number]

/**
 * Default set number for a new log: one past the highest attempt already
 * logged for that lift on that day. Empty → 1. Highest already 5 → stay on 5.
 */
export function nextSetAttempt(attempts: number[]): SetAttempt {
  let highest = 0
  for (const n of attempts) {
    if (n > highest && n <= 5) highest = n
  }
  if (highest === 0) return 1
  if (highest >= 5) return 5
  return (highest + 1) as SetAttempt
}
