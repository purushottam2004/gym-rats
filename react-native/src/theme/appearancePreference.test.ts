import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { parseAppearancePreference } from './appearancePreference.ts'

describe('parseAppearancePreference', () => {
  it('keeps light, dark, and system', () => {
    assert.equal(parseAppearancePreference('light'), 'light')
    assert.equal(parseAppearancePreference('dark'), 'dark')
    assert.equal(parseAppearancePreference('system'), 'system')
  })

  it('defaults unknown values to system', () => {
    assert.equal(parseAppearancePreference(null), 'system')
    assert.equal(parseAppearancePreference(''), 'system')
    assert.equal(parseAppearancePreference('auto'), 'system')
  })
})
