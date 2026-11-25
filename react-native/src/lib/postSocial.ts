/** WhatsApp-style quick reactions. Heart is the double-tap default. */
export const POST_REACTION_EMOJIS = ['❤️', '👍', '😂', '😮', '😢', '😡'] as const

export const DEFAULT_POST_REACTION = '❤️'

export type ReactionRow = {
  emoji: string
  user_id: string
}

export type ReactionSummary = {
  emoji: string
  count: number
  reactedByMe: boolean
}

/** Group raw reaction rows into chips sorted by count (then emoji). */
export function summarizeReactions(
  rows: ReactionRow[],
  myUserId: string | null | undefined,
): ReactionSummary[] {
  const byEmoji = new Map<string, { count: number; reactedByMe: boolean }>()
  for (const row of rows) {
    const current = byEmoji.get(row.emoji) ?? { count: 0, reactedByMe: false }
    current.count += 1
    if (myUserId && row.user_id === myUserId) current.reactedByMe = true
    byEmoji.set(row.emoji, current)
  }
  return [...byEmoji.entries()]
    .map(([emoji, value]) => ({ emoji, ...value }))
    .sort((a, b) => b.count - a.count || a.emoji.localeCompare(b.emoji))
}

/** Next reaction rows after choosing an emoji (one reaction per user; same emoji toggles off). */
export function applyReactionChoice(
  rows: ReactionRow[],
  userId: string,
  emoji: string,
): ReactionRow[] {
  const withoutMine = rows.filter((row) => row.user_id !== userId)
  const mine = rows.find((row) => row.user_id === userId)
  if (mine?.emoji === emoji) return withoutMine
  return [...withoutMine, { user_id: userId, emoji }]
}

/** Double-tap like: always set the emoji (never clears an existing heart). */
export function ensureReaction(
  rows: ReactionRow[],
  userId: string,
  emoji: string,
): ReactionRow[] {
  const withoutMine = rows.filter((row) => row.user_id !== userId)
  return [...withoutMine, { user_id: userId, emoji }]
}
