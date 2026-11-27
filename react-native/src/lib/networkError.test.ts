import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  isTransientNetworkError,
  USER_FACING_NETWORK_ERROR,
  userFacingNetworkError,
} from './networkError.ts'

describe('isTransientNetworkError', () => {
  it('detects iOS connection-lost and fetch failures', () => {
    assert.equal(isTransientNetworkError('The network connection was lost.'), true)
    assert.equal(
      isTransientNetworkError('Failed to send a request to the Edge Function: Network request failed'),
      true,
    )
    assert.equal(isTransientNetworkError('OPENAI_API_KEY is missing'), false)
  })
})

describe('userFacingNetworkError', () => {
  it('rewrites transient transport errors', () => {
    assert.equal(userFacingNetworkError('The network connection was lost.'), USER_FACING_NETWORK_ERROR)
    assert.equal(userFacingNetworkError('Could not estimate book from photos'), 'Could not estimate book from photos')
  })
})

describe('isTransientNetworkError (after rewrite)', () => {
  it('treats the stable user-facing message as retryable', () => {
    assert.equal(isTransientNetworkError(USER_FACING_NETWORK_ERROR), true)
  })
})
