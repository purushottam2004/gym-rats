import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { bytesToBase64, parseVoiceSetResponse } from './voiceSet.ts'

describe('parseVoiceSetResponse', () => {
  it('returns ok payload', () => {
    const result = parseVoiceSetResponse({
      ok: true,
      set: {
        id: '1',
        lift_name: 'Squat',
        attempt: 1,
        reps: 5,
        load_kg: 100,
        logged_on: '2026-11-23',
      },
    })
    assert.equal(result.ok, true)
    if (result.ok) assert.equal(result.set.lift_name, 'Squat')
  })

  it('prefers invoke error message', () => {
    const result = parseVoiceSetResponse({ ok: false, error: 'ignored' }, 'network down')
    assert.deepEqual(result, { ok: false, error: 'network down' })
  })

  it('reads ok:false error', () => {
    const result = parseVoiceSetResponse({ ok: false, error: ' No lift ' })
    assert.deepEqual(result, { ok: false, error: 'No lift' })
  })

  it('falls back for empty bodies', () => {
    assert.deepEqual(parseVoiceSetResponse(null), {
      ok: false,
      error: 'Empty response from voice set',
    })
  })
})

describe('bytesToBase64', () => {
  it('encodes ascii bytes', () => {
    const bytes = Uint8Array.from([72, 105])
    assert.equal(bytesToBase64(bytes), 'SGk=')
  })
})
