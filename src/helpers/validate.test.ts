import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
    assertString,
    assertNonEmptyString,
    assertOptionalString,
    assertOneOf,
    assertObject,
    assertStringArray,
    assertAppName,
    assertNonNegativeInteger,
} from './validate.js'
import { CommandError } from './errors.js'

test('assertString accepts strings and rejects non-strings', () => {
    assert.equal(assertString('ok', 'x'), 'ok')
    assert.throws(() => assertString(5, 'x'), CommandError)
    assert.throws(() => assertString(undefined, 'x'), CommandError)
})

test('assertNonEmptyString rejects blank strings', () => {
    assert.equal(assertNonEmptyString('a', 'x'), 'a')
    assert.throws(() => assertNonEmptyString('   ', 'x'), CommandError)
})

test('assertOptionalString passes through undefined/null', () => {
    assert.equal(assertOptionalString(undefined, 'x'), undefined)
    assert.equal(assertOptionalString(null, 'x'), undefined)
    assert.equal(assertOptionalString('v', 'x'), 'v')
    assert.throws(() => assertOptionalString(3, 'x'), CommandError)
})

test('assertOneOf enforces the allowed set', () => {
    assert.equal(assertOneOf('newest', ['newest', 'oldest'], 'o'), 'newest')
    assert.throws(
        () => assertOneOf('sideways', ['newest', 'oldest'], 'o'),
        CommandError
    )
})

test('assertObject rejects arrays and null', () => {
    assert.deepEqual(assertObject({ a: 1 }, 'x'), { a: 1 })
    assert.throws(() => assertObject([], 'x'), CommandError)
    assert.throws(() => assertObject(null, 'x'), CommandError)
})

test('assertStringArray requires all elements to be strings', () => {
    assert.deepEqual(assertStringArray(['a', 'b'], 'x'), ['a', 'b'])
    assert.throws(() => assertStringArray(['a', 1], 'x'), CommandError)
    assert.throws(() => assertStringArray('a', 'x'), CommandError)
})

test('assertAppName blocks shell/script injection characters', () => {
    assert.equal(assertAppName('Safari'), 'Safari')
    assert.equal(assertAppName('Visual Studio Code'), 'Visual Studio Code')
    assert.throws(() => assertAppName('foo"; rm -rf ~ #'), CommandError)
    assert.throws(() => assertAppName('app && evil'), CommandError)
    assert.throws(() => assertAppName('app`whoami`'), CommandError)
    assert.throws(() => assertAppName(''), CommandError)
})

test('assertNonNegativeInteger coerces numeric strings and rejects the rest', () => {
    assert.equal(assertNonNegativeInteger(5, 'time'), 5)
    assert.equal(assertNonNegativeInteger('5', 'time'), 5)
    assert.equal(assertNonNegativeInteger(0, 'time'), 0)
    assert.throws(() => assertNonNegativeInteger(-1, 'time'), CommandError)
    assert.throws(() => assertNonNegativeInteger(1.5, 'time'), CommandError)
    assert.throws(
        () => assertNonNegativeInteger('1; rm -rf ~', 'time'),
        CommandError
    )
    assert.throws(
        () => assertNonNegativeInteger(Infinity, 'time'),
        CommandError
    )
    assert.throws(
        () => assertNonNegativeInteger(undefined, 'time'),
        CommandError
    )
})
