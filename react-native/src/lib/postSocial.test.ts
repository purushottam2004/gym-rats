import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  applyReactionChoice,
  DEFAULT_POST_REACTION,
  ensureReaction,
  reactionActors,
  summarizeReactions,
  type ReactionRow,
} from './postSocial.ts'

function row(
  partial: Partial<ReactionRow> & Pick<ReactionRow, 'emoji' | 'user_id'>,
): ReactionRow {
  return {
    display_name: partial.display_name ?? null,
    avatar_path: partial.avatar_path ?? null,
    ...partial,
  }
}

describe('postSocial', () => {
  it('defaults double-tap to heart', () => {
    assert.equal(DEFAULT_POST_REACTION, '❤️')
  })

  it('summarizes reactions with mine flagged', () => {
    const summary = summarizeReactions(
      [
        row({ emoji: '❤️', user_id: 'a' }),
        row({ emoji: '❤️', user_id: 'b' }),
        row({ emoji: '👍', user_id: 'c' }),
      ],
      'b',
    )
    assert.deepEqual(summary, [
      { emoji: '❤️', count: 2, reactedByMe: true },
      { emoji: '👍', count: 1, reactedByMe: false },
    ])
  })

  it('lists unique reactors in first-seen order', () => {
    const actors = reactionActors([
      row({ emoji: '❤️', user_id: 'a', display_name: 'A' }),
      row({ emoji: '👍', user_id: 'b', display_name: 'B' }),
      row({ emoji: '❤️', user_id: 'a', display_name: 'A' }),
    ])
    assert.deepEqual(
      actors.map((actor) => actor.user_id),
      ['a', 'b'],
    )
  })

  it('toggles the same emoji off and replaces a different one', () => {
    const rows = [row({ emoji: '❤️', user_id: 'me', display_name: 'Me', avatar_path: 'a.jpg' })]
    assert.deepEqual(applyReactionChoice(rows, 'me', '❤️'), [])
    assert.deepEqual(applyReactionChoice(rows, 'me', '👍'), [
      row({ user_id: 'me', emoji: '👍', display_name: 'Me', avatar_path: 'a.jpg' }),
    ])
  })

  it('uses me profile when adding a new reaction', () => {
    assert.deepEqual(
      applyReactionChoice([], 'me', '❤️', { display_name: 'Me', avatar_path: 'p.jpg' }),
      [row({ user_id: 'me', emoji: '❤️', display_name: 'Me', avatar_path: 'p.jpg' })],
    )
  })

  it('double-tap keeps an existing heart', () => {
    const rows = [row({ emoji: '❤️', user_id: 'me', display_name: 'Me' })]
    assert.deepEqual(ensureReaction(rows, 'me', '❤️'), [
      row({ user_id: 'me', emoji: '❤️', display_name: 'Me' }),
    ])
  })
})
