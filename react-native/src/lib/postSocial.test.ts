import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  applyReactionChoice,
  DEFAULT_POST_REACTION,
  ensureReaction,
  summarizeReactions,
} from './postSocial.ts'

describe('postSocial', () => {
  it('defaults double-tap to heart', () => {
    assert.equal(DEFAULT_POST_REACTION, '❤️')
  })

  it('summarizes reactions with mine flagged', () => {
    const summary = summarizeReactions(
      [
        { emoji: '❤️', user_id: 'a' },
        { emoji: '❤️', user_id: 'b' },
        { emoji: '👍', user_id: 'c' },
      ],
      'b',
    )
    assert.deepEqual(summary, [
      { emoji: '❤️', count: 2, reactedByMe: true },
      { emoji: '👍', count: 1, reactedByMe: false },
    ])
  })

  it('toggles the same emoji off and replaces a different one', () => {
    const rows = [{ emoji: '❤️', user_id: 'me' }]
    assert.deepEqual(applyReactionChoice(rows, 'me', '❤️'), [])
    assert.deepEqual(applyReactionChoice(rows, 'me', '👍'), [
      { user_id: 'me', emoji: '👍' },
    ])
  })

  it('double-tap keeps an existing heart', () => {
    const rows = [{ emoji: '❤️', user_id: 'me' }]
    assert.deepEqual(ensureReaction(rows, 'me', '❤️'), [
      { user_id: 'me', emoji: '❤️' },
    ])
  })
})
