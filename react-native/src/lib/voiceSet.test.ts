import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  bytesToBase64,
  messageFromFunctionBody,
  parseVoiceSetResponse,
  resultFromFunctionsInvoke,
} from './voiceSet.ts'

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

  it('prefers body error over generic invoke fallback', () => {
    const result = parseVoiceSetResponse(
      { ok: false, error: 'No lift named Bench' },
      'Failed to send a request to the Edge Function',
    )
    assert.deepEqual(result, { ok: false, error: 'No lift named Bench' })
  })

  it('uses fallback when body has no message', () => {
    const result = parseVoiceSetResponse({}, 'network down')
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

describe('messageFromFunctionBody', () => {
  it('reads gateway message fields', () => {
    assert.equal(messageFromFunctionBody({ msg: 'JWT expired' }), 'JWT expired')
    assert.equal(messageFromFunctionBody({ message: 'boom' }), 'boom')
  })
})

describe('resultFromFunctionsInvoke', () => {
  it('returns data on success path', async () => {
    const result = await resultFromFunctionsInvoke(
      { ok: false, error: 'Add a lift first' },
      null,
    )
    assert.deepEqual(result, { ok: false, error: 'Add a lift first' })
  })

  it('reads JSON from FunctionsHttpError-like context', async () => {
    const response = new Response(JSON.stringify({ ok: false, error: 'OPENAI_API_KEY is not configured on the Edge Function' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
    const error = Object.assign(new Error('Edge Function returned a non-2xx status code'), {
      name: 'FunctionsHttpError',
      context: response,
    })
    const result = await resultFromFunctionsInvoke(null, error)
    assert.deepEqual(result, {
      ok: false,
      error: 'OPENAI_API_KEY is not configured on the Edge Function',
    })
  })

  it('includes nested fetch cause under generic send failure', async () => {
    const error = Object.assign(new Error('Failed to send a request to the Edge Function'), {
      name: 'FunctionsFetchError',
      context: new TypeError('Network request failed'),
    })
    const result = await resultFromFunctionsInvoke(null, error)
    assert.equal(
      result.ok === false && result.error,
      'Failed to send a request to the Edge Function: Network request failed',
    )
  })
})

describe('bytesToBase64', () => {
  it('encodes ascii bytes', () => {
    const bytes = Uint8Array.from([72, 105])
    assert.equal(bytesToBase64(bytes), 'SGk=')
  })
})
