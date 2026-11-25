/** Fields used to order sets within one exercise. */
export type SetOrderKey = {
  attempt: number
  created_at: string
}

/** Ascending by set number, then by creation time for ties. */
export function compareSetsByAttemptThenCreated(a: SetOrderKey, b: SetOrderKey): number {
  if (a.attempt !== b.attempt) return a.attempt - b.attempt
  if (a.created_at < b.created_at) return -1
  if (a.created_at > b.created_at) return 1
  return 0
}
