import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { confirmDelete } from './confirmDelete.ts'

describe('confirmDelete', () => {
  it('calls onConfirm when the browser dialog accepts', () => {
    let confirmed = false
    confirmDelete({
      title: 'Delete food?',
      message: 'Remove oats?',
      useBrowserConfirm: true,
      browserConfirm: (text) => {
        assert.equal(text, 'Delete food?\n\nRemove oats?')
        return true
      },
      onConfirm: () => {
        confirmed = true
      },
    })
    assert.equal(confirmed, true)
  })

  it('skips onConfirm when the browser dialog cancels', () => {
    let confirmed = false
    confirmDelete({
      title: 'Delete set?',
      message: 'Remove attempt 1?',
      useBrowserConfirm: true,
      browserConfirm: () => false,
      onConfirm: () => {
        confirmed = true
      },
    })
    assert.equal(confirmed, false)
  })

  it('uses nativeAlert with Cancel and Delete when not on web', () => {
    let confirmed = false
    let alertTitle = ''
    let alertMessage = ''
    let buttonLabels: string[] = []
    confirmDelete({
      title: 'Delete food?',
      message: 'Remove oats?',
      useBrowserConfirm: false,
      nativeAlert: (title, message, buttons) => {
        alertTitle = title
        alertMessage = message
        buttonLabels = buttons.map((button) => button.text)
        buttons.find((button) => button.style === 'destructive')?.onPress?.()
      },
      onConfirm: () => {
        confirmed = true
      },
    })
    assert.equal(alertTitle, 'Delete food?')
    assert.equal(alertMessage, 'Remove oats?')
    assert.deepEqual(buttonLabels, ['Cancel', 'Delete'])
    assert.equal(confirmed, true)
  })
})
