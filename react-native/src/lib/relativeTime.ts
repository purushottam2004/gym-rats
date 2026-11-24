/** Compact relative time for feed rows (WhatsApp-ish). */
export function formatRelativeTime(iso: string, now = new Date()): string {
  const then = new Date(iso)
  if (Number.isNaN(then.getTime())) return ''

  const diffMs = then.getTime() - now.getTime()
  const absSec = Math.round(Math.abs(diffMs) / 1000)
  const future = diffMs > 0

  if (absSec < 45) return 'just now'

  const absMin = Math.round(absSec / 60)
  if (absMin < 60) return future ? `in ${absMin}m` : `${absMin}m`

  const absHr = Math.round(absMin / 60)
  if (absHr < 24) return future ? `in ${absHr}h` : `${absHr}h`

  const absDay = Math.round(absHr / 24)
  if (absDay < 7) return future ? `in ${absDay}d` : `${absDay}d`

  return then.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}
