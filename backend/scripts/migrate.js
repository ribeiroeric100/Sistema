#!/usr/bin/env node

const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')

const direction = process.argv[2]
if (!direction || !['up', 'down', 'redo', 'create'].includes(direction)) {
  console.error('Uso: node scripts/migrate.js <up|down|redo|create> [args...]')
  process.exit(1)
}

const cwd = process.cwd()
const envPath = path.join(cwd, '.env')

const extraArgs = process.argv.slice(3)

// Always point to the repo migrations dir unless overridden.
const hasMigrationsDirFlag = extraArgs.includes('-m') || extraArgs.includes('--migrations-dir')
const hasConfigFileFlag = extraArgs.includes('-f') || extraArgs.includes('--config-file')
const hasRejectUnauthorizedFlag = extraArgs.includes('--reject-unauthorized')
const baseArgs = [direction]
if (!hasMigrationsDirFlag) baseArgs.push('-m', 'migrations')

// Load env here as well, because we may need to decide SSL flags before spawning.
if (fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath })
}

// Force SSL when needed (Supabase/managed Postgres). This fixes "SSL connection is required".
const NODE_ENV = String(process.env.NODE_ENV || '').toLowerCase()
const isProduction = NODE_ENV === 'production'
const connectionString = String(process.env.MIGRATIONS_DATABASE_URL || process.env.DATABASE_URL || '').trim()
if (!connectionString) {
  console.error('[FATAL] DATABASE_URL não configurado (ou MIGRATIONS_DATABASE_URL).')
  process.exit(1)
}
const sslEnabled =
  isProduction ||
  String(process.env.PGSSL || '').toLowerCase() === 'true' ||
  /\bsupabase\.(co|com)\b/i.test(connectionString)

if (sslEnabled && !hasRejectUnauthorizedFlag) baseArgs.push('--reject-unauthorized', 'false')

// Only ask node-pg-migrate to load dotenv if the file exists.
// This keeps production environments (Render/Supabase secrets) working without a .env file.
if (fs.existsSync(envPath)) {
  baseArgs.push('--envPath', '.env')
}

// node-pg-migrate v8+ loads --config-file as JSON (with import assertions).
// To keep our previous JS-config behavior (computed SSL, env support), we generate
// a temporary JSON config at runtime when the user didn't pass -f/--config-file.
let tempConfigPath = null
if (!hasConfigFileFlag) {
  tempConfigPath = path.join(cwd, `.tmp.node-pg-migrate.${process.pid}.json`)

  const configObj = {
    db: {
      connectionString,
      ...(sslEnabled ? { ssl: { rejectUnauthorized: false } } : {})
    }
  }

  fs.writeFileSync(tempConfigPath, JSON.stringify(configObj, null, 2), 'utf8')
  baseArgs.push('-f', tempConfigPath)
}

const finalArgs = baseArgs.concat(extraArgs)

const cmd = process.platform === 'win32' ? 'node-pg-migrate.cmd' : 'node-pg-migrate'
const result = spawnSync(cmd, finalArgs, { stdio: 'inherit', shell: true })

if (tempConfigPath) {
  try {
    fs.unlinkSync(tempConfigPath)
  } catch (_) {
    // ignore
  }
}

process.exit(result.status ?? 1)
