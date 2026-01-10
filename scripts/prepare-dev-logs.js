#!/usr/bin/env node
const fs = require('fs')
const path = require('path')

const logDir = path.resolve(__dirname, '..', 'logs')

try {
  fs.rmSync(logDir, { recursive: true, force: true })
} catch (error) {
  // Ignore removal errors
}

fs.mkdirSync(logDir, { recursive: true })

const defaultLogs = ['ecomos', 'atlas', 'wms']
for (const name of defaultLogs) {
  const target = path.join(logDir, `${name}.log`)
  try {
    fs.writeFileSync(target, '', { flag: 'w' })
  } catch (error) {
    console.warn(`[prepare-dev-logs] Unable to seed log file ${name}.log`, error)
  }
}
