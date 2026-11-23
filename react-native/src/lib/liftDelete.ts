/** True when Postgres rejected deleting a lift that still has sets. */
export function isLiftInUseError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err)
  return /foreign key|restrict|still referenced|violates/i.test(message)
}
