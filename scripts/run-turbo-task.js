#!/usr/bin/env node

const { spawnSync } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')

const TASK_ARG_INDEX = 0
const LIFECYCLE_ENV_PREFIX = 'APP_LIFECYCLE_'

const args = process.argv.slice(2)
if (!args[TASK_ARG_INDEX]) {
  console.error('[run-turbo-task] Missing task name (expected usage: node scripts/run-turbo-task.js <task> [...turbo args])')
  process.exit(1)
}

const task = args[TASK_ARG_INDEX]
const additionalArgs = args.slice(1)
const repoRoot = path.resolve(__dirname, '..')

const devAppIds = Array.from(collectSkippedApps(repoRoot))
const turboArgs = ['run', task, ...additionalArgs]

const { filters: filterArgs, appliedAppIds } = buildFilterArgs(devAppIds, repoRoot)

if (filterArgs.length > 0) {
  // Provide visibility when tasks skip dev-only apps.
  console.log(`[run-turbo-task] Skipping excluded apps: ${appliedAppIds.join(', ')}`)
  const separatorIndex = turboArgs.indexOf('--')
  if (separatorIndex >= 0) {
    turboArgs.splice(separatorIndex, 0, ...filterArgs)
  } else {
    turboArgs.push(...filterArgs)
  }
}

const result = spawnSync('turbo', turboArgs, {
  cwd: repoRoot,
  stdio: 'inherit',
  env: process.env,
})

if (result.error) {
  console.error(`[run-turbo-task] Failed to start turbo: ${result.error.message}`)
  process.exit(result.status ?? 1)
}

process.exit(result.status ?? 0)

function collectSkippedApps(rootDir) {
  const ids = new Set()

  const manifest = loadAppManifest(rootDir)
  if (manifest?.apps) {
    for (const [rawId, entry] of Object.entries(manifest.apps)) {
      if (entry && typeof entry === 'object') {
        const normalizedLifecycle = typeof entry.lifecycle === 'string' ? entry.lifecycle.trim().toLowerCase() : undefined
        if (normalizedLifecycle === 'archive' || normalizedLifecycle === 'archived') {
          const canonicalId = canonicalizeAppId(rawId)
          if (canonicalId) {
            ids.add(canonicalId)
          }
        }
      }
    }
  }

  if (Array.isArray(manifest?.archive)) {
    for (const rawId of manifest.archive) {
      const canonicalId = canonicalizeAppId(rawId)
      if (canonicalId) {
        ids.add(canonicalId)
      }
    }
  }

  if (Array.isArray(manifest?.devOnly)) {
    for (const rawId of manifest.devOnly) {
      const canonicalId = canonicalizeAppId(rawId)
      if (canonicalId) {
        ids.add(canonicalId)
      }
    }
  }

  const devOnlyEnv = process.env.APP_DEV_ONLY
  if (typeof devOnlyEnv === 'string' && devOnlyEnv.length > 0) {
    for (const rawId of devOnlyEnv.split(',')) {
      const canonicalId = canonicalizeAppId(rawId)
      if (canonicalId) {
        ids.add(canonicalId)
      }
    }
  }

  for (const [key, value] of Object.entries(process.env)) {
    if (!key.startsWith(LIFECYCLE_ENV_PREFIX) || typeof value !== 'string') {
      continue
    }
    const normalizedValue = value.trim().toLowerCase()
    const shouldSkip =
      normalizedValue === 'archive' ||
      normalizedValue === 'archived' ||
      normalizedValue === 'skip' ||
      normalizedValue === 'skipped' ||
      normalizedValue === 'disabled'
    if (!shouldSkip) {
      continue
    }
    const rawId = key.slice(LIFECYCLE_ENV_PREFIX.length)
    if (!rawId) {
      continue
    }
    const canonicalId = canonicalizeEnvAppId(rawId)
    if (canonicalId) {
      ids.add(canonicalId)
    }
  }

  return ids
}

function buildFilterArgs(appIds, rootDir) {
  const filters = []
  const appliedAppIds = []
  for (const appId of appIds) {
    if (!appId) {
      continue
    }

    const packageJsonPath = path.join(rootDir, 'apps', appId, 'package.json')
    if (!fs.existsSync(packageJsonPath)) {
      continue
    }

    filters.push(`--filter=!@ecom-os/${appId}...`)
    appliedAppIds.push(appId)
  }
  return { filters, appliedAppIds }
}

function canonicalizeAppId(value) {
  if (typeof value !== 'string') {
    return null
  }
  const trimmed = value.trim()
  if (!trimmed) {
    return null
  }
  return trimmed.toLowerCase()
}

function canonicalizeEnvAppId(value) {
  if (typeof value !== 'string' || value.length === 0) {
    return null
  }
  return value.toLowerCase().replace(/_/g, '-')
}

function loadAppManifest(rootDir) {
  const manifestPath = path.join(rootDir, 'app-manifest.json')
  if (!fs.existsSync(manifestPath)) {
    return null
  }
  try {
    const raw = fs.readFileSync(manifestPath, 'utf8')
    return JSON.parse(raw)
  } catch (error) {
    console.warn('[run-turbo-task] Failed to load app-manifest.json:', error)
    return null
  }
}
