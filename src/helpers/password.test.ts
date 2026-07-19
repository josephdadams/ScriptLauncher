import { test } from 'node:test'
import assert from 'node:assert/strict'

import { passwordsMatch } from './password.js'

test('passwordsMatch returns true for identical strings', () => {
    assert.equal(passwordsMatch('hunter2', 'hunter2'), true)
})

test('passwordsMatch returns false for different strings', () => {
    assert.equal(passwordsMatch('hunter2', 'hunter3'), false)
})

test('passwordsMatch returns false for different lengths', () => {
    assert.equal(passwordsMatch('short', 'longerpassword'), false)
})

test('passwordsMatch handles empty/undefined safely', () => {
    assert.equal(passwordsMatch('', ''), true)
    assert.equal(passwordsMatch(undefined as any, 'x'), false)
    assert.equal(passwordsMatch('x', undefined as any), false)
})
