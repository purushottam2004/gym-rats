/** True when Postgres/RPC rejected deleting a food that still has intakes. */
export function isFoodInUseError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err)
  return /logged cannot be deleted|foreign key|restrict/i.test(message)
}
