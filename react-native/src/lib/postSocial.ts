/** WhatsApp-style quick reactions. Heart is the double-tap default. */
export const POST_REACTION_EMOJIS = ['❤️', '👍', '😂', '😮', '😢', '😡'] as const

export const DEFAULT_POST_REACTION = '❤️'

/** How many reactor avatars to show in the chip before collapsing to +N. */
export const REACTION_AVATAR_CHIP_LIMIT = 5

export type ReactionActor = {
  display_name: string | null
  avatar_path: string | null
}

export type ReactionRow = {
  emoji: string
  user_id: string
  display_name: string | null
  avatar_path: string | null
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

/** Unique reactors in first-seen order (one avatar per user). */
export function reactionActors(rows: ReactionRow[]): ReactionRow[] {
  const seen = new Set<string>()
  const actors: ReactionRow[] = []
  for (const row of rows) {
    if (seen.has(row.user_id)) continue
    seen.add(row.user_id)
    actors.push(row)
  }
  return actors
}

function withActor(
  userId: string,
  emoji: string,
  previous: ReactionRow | undefined,
  me: ReactionActor | null | undefined,
): ReactionRow {
  return {
    user_id: userId,
    emoji,
    display_name: me?.display_name ?? previous?.display_name ?? null,
    avatar_path: me?.avatar_path ?? previous?.avatar_path ?? null,
  }
}

/** Next reaction rows after choosing an emoji (one reaction per user; same emoji toggles off). */
export function applyReactionChoice(
  rows: ReactionRow[],
  userId: string,
  emoji: string,
  me?: ReactionActor | null,
): ReactionRow[] {
  const withoutMine = rows.filter((row) => row.user_id !== userId)
  const mine = rows.find((row) => row.user_id === userId)
  if (mine?.emoji === emoji) return withoutMine
  return [...withoutMine, withActor(userId, emoji, mine, me)]
}

/** Double-tap like: always set the emoji (never clears an existing heart). */
export function ensureReaction(
  rows: ReactionRow[],
  userId: string,
  emoji: string,
  me?: ReactionActor | null,
): ReactionRow[] {
  const withoutMine = rows.filter((row) => row.user_id !== userId)
  const mine = rows.find((row) => row.user_id === userId)
  return [...withoutMine, withActor(userId, emoji, mine, me)]
}
