import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'fs'
import os from 'os'
import path from 'path'

import {
    isPathForbidden,
    sanitizeFilename,
    generateUniqueFilePath,
    sanitizeUserPath,
} from './fileUtils.js'

test('sanitizeFilename strips illegal characters from the leaf', () => {
    const out = sanitizeFilename('/tmp/we:ird/na<me>.txt')
    assert.equal(path.basename(out), 'na_me_.txt')
    // Directory portion is preserved
    assert.equal(path.dirname(out), path.join('/tmp', 'we:ird'))
})

test('sanitizeFilename replaces . and .. leaf names', () => {
    assert.equal(path.basename(sanitizeFilename('/a/b/..')), '_file')
})

test('isPathForbidden flags protected system directories', () => {
    if (process.platform === 'win32') {
        assert.equal(isPathForbidden('C:\\Windows\\system32'), true)
        assert.equal(isPathForbidden('C:\\Users\\me\\file.txt'), false)
    } else {
        assert.equal(isPathForbidden('/etc/passwd'), true)
        assert.equal(isPathForbidden('/usr/bin/node'), true)
        assert.equal(isPathForbidden('/home/me/file.txt'), false)
    }
})

test('sanitizeUserPath strips surrounding quotes and trims', () => {
    assert.equal(
        sanitizeUserPath('  "/home/me/file.txt"  '),
        path.normalize('/home/me/file.txt')
    )
    assert.throws(() => sanitizeUserPath(undefined as any))
})

test('generateUniqueFilePath avoids collisions', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sl-test-'))
    try {
        const first = generateUniqueFilePath(dir, 'report.txt')
        assert.equal(path.basename(first), 'report.txt')

        fs.writeFileSync(first, 'x')
        const second = generateUniqueFilePath(dir, 'report.txt')
        assert.equal(path.basename(second), 'report_1.txt')

        // Illegal characters in the leaf are sanitized
        const sanitized = generateUniqueFilePath(dir, 'a:b?.txt')
        assert.equal(path.basename(sanitized), 'a_b_.txt')
    } finally {
        fs.rmSync(dir, { recursive: true, force: true })
    }
})
