#!/usr/bin/env node

/**
 * Skip Playwright browser runs by default in server environments where
 * browsers and sandboxing support are unavailable. Set WMS_ENABLE_PLAYWRIGHT=true
 * to force the original behaviour when running locally with browsers installed.
 */

const { spawnSync } = require('node:child_process')
const path = require('node:path')

const enablePlaywrightValues = new Set(['1', 'true', 'yes'])
const rawFlag = (process.env.WMS_ENABLE_PLAYWRIGHT || '').toLowerCase()
const isPlaywrightEnabled = enablePlaywrightValues.has(rawFlag)

if (!isPlaywrightEnabled) {
 console.log('[wms:test] Skipping Playwright end-to-end suite.')
 console.log('[wms:test] Set WMS_ENABLE_PLAYWRIGHT=true to run the browser tests locally.')
 process.exit(0)
}

const result = spawnSync(
 'npx',
 ['playwright', 'test', 'e2e/'],
 {
  cwd: path.join(__dirname, '..', 'tests'),
  stdio: 'inherit',
  env: process.env
 }
)

if (result.error) {
 console.error('[wms:test] Failed to launch Playwright:', result.error.message)
 process.exit(result.status ?? 1)
}

process.exit(result.status ?? 0)
