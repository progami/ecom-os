#!/usr/bin/env node
const { spawn } = require('child_process')
const fs = require('fs')
const path = require('path')

const args = process.argv.slice(2)
if (args.length < 3) {
  console.error('Usage: run-dev-with-logs <logName> -- <command> [args...]')
  process.exit(1)
}

const separatorIndex = args.indexOf('--')
if (separatorIndex === -1 || separatorIndex === 0 || separatorIndex === args.length - 1) {
  console.error('Usage: run-dev-with-logs <logName> -- <command> [args...]')
  process.exit(1)
}

const logName = args[0]
const command = args[separatorIndex + 1]
const commandArgs = args.slice(separatorIndex + 2)

const logDir = path.resolve(__dirname, '..', 'logs')
fs.mkdirSync(logDir, { recursive: true })

const defaultLogs = ['ecomos', 'hrms', 'wms']
for (const name of defaultLogs) {
  const file = path.join(logDir, `${name}.log`)
  try {
    if (!fs.existsSync(file)) {
      fs.writeFileSync(file, '')
    }
  } catch (error) {
    console.warn(`[run-dev-with-logs] Unable to ensure ${file}`, error)
  }
}

const logPath = path.join(logDir, `${logName}.log`)
try {
  fs.writeFileSync(logPath, '')
} catch (error) {
  console.warn(`[run-dev-with-logs] Unable to reset ${logPath}`, error)
}

const logStream = fs.createWriteStream(logPath, { flags: 'a' })

const sharedSecret = process.env.PORTAL_AUTH_SECRET
  || process.env.NEXTAUTH_SECRET
  || 'dev-only-shared-nextauth-secret-change-me'

const child = spawn(command, commandArgs, {
  stdio: ['inherit', 'pipe', 'pipe'],
  shell: false,
  env: {
    ...process.env,
    DEV_LOG_NAME: logName,
    PORTAL_AUTH_SECRET: sharedSecret,
    NEXTAUTH_SECRET: sharedSecret,
  },
})

function forward(stream, target) {
  stream.on('data', (chunk) => {
    const data = chunk.toString()
    target.write(data)
    logStream.write(data)
  })
}

forward(child.stdout, process.stdout)
forward(child.stderr, process.stderr)

child.on('close', (code) => {
  logStream.end(() => {
    if (code !== 0) {
      process.exit(code)
    }
  })
})

child.on('error', (error) => {
  console.error(`[run-dev-with-logs] Failed to start command: ${error.message}`)
  logStream.end(() => process.exit(1))
})
