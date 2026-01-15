const fs = require('fs')
const path = require('path')

// In some node-pg-migrate execution paths, the config file is evaluated before
// the CLI processes --envPath. To keep behavior consistent, we load .env here
// when present (dev/local), while production environments can rely on real env vars.
const envPath = path.join(process.cwd(), '.env')
if (fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath })
}

const NODE_ENV = String(process.env.NODE_ENV || '').toLowerCase()
const isProduction = NODE_ENV === 'production'

const connectionString = String(process.env.MIGRATIONS_DATABASE_URL || process.env.DATABASE_URL || '').trim()

// Supabase requires SSL. Many managed Postgres providers also require it.
const sslEnabled =
  isProduction ||
  String(process.env.PGSSL || '').toLowerCase() === 'true' ||
  /\bsupabase\.(co|com)\b/i.test(connectionString)

module.exports = {
  connectionString,
  ssl: sslEnabled ? { rejectUnauthorized: false } : undefined
}
