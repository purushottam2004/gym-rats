import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  imageOwnerCacheKey,
  parseImageUriCache,
  peekCachedImageUri,
  rememberCachedImageUri,
  resetImageUriCacheMemory,
  forgetCachedImageUri,
  IMAGE_URI_CACHE_STORAGE_KEY,
} from './imageUriCache.ts'

describe('imageOwnerCacheKey', () => {
  it('uses bucket and path owner segment', () => {
    assert.equal(imageOwnerCacheKey('avatars', 'user-1/abc.jpg'), 'avatars:user-1')
    assert.equal(imageOwnerCacheKey('group-avatars', 'g1/x.jpg'), 'group-avatars:g1')
  })

  it('returns null for empty owner', () => {
    assert.equal(imageOwnerCacheKey('avatars', ''), null)
    assert.equal(imageOwnerCacheKey('avatars', '/only.jpg'), null)
  })
})

describe('parseImageUriCache', () => {
  it('keeps string entries only', () => {
    assert.deepEqual(parseImageUriCache('{"a":"https://x","b":1,"c":""}'), { a: 'https://x' })
  })

  it('defaults bad input to empty map', () => {
    assert.deepEqual(parseImageUriCache(null), {})
    assert.deepEqual(parseImageUriCache('not-json'), {})
    assert.deepEqual(parseImageUriCache('[]'), {})
  })
})

describe('remember / peek / forget', () => {
  it('round-trips through localStorage', () => {
    const store = new Map<string, string>()
    const original = globalThis.localStorage
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => {
          store.set(key, value)
        },
        removeItem: (key: string) => {
          store.delete(key)
        },
      },
    })
    resetImageUriCacheMemory()
    try {
      assert.equal(peekCachedImageUri('avatars:u1'), null)
      rememberCachedImageUri('avatars:u1', 'https://cdn/old.jpg')
      assert.equal(peekCachedImageUri('avatars:u1'), 'https://cdn/old.jpg')
      assert.match(store.get(IMAGE_URI_CACHE_STORAGE_KEY) ?? '', /old\.jpg/)
      rememberCachedImageUri('avatars:u1', 'https://cdn/new.jpg')
      assert.equal(peekCachedImageUri('avatars:u1'), 'https://cdn/new.jpg')
      forgetCachedImageUri('avatars:u1')
      assert.equal(peekCachedImageUri('avatars:u1'), null)
    } finally {
      Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: original })
      resetImageUriCacheMemory()
    }
  })
})
