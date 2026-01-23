const fs = require('fs')
const path = require('path')

// Carrega .env em dev/local para que a CLI consiga encontrar DATABASE_URL
const envPath = path.join(process.cwd(), '.env')
if (fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath })
}

const NODE_ENV = String(process.env.NODE_ENV || '').toLowerCase()
const isProduction = NODE_ENV === 'production'

const connectionString = String(process.env.MIGRATIONS_DATABASE_URL || process.env.DATABASE_URL || '').trim()

const sslEnabled =
  isProduction ||
  String(process.env.PGSSL || '').toLowerCase() === 'true' ||
  /\bsupabase\.(co|com)\b/i.test(connectionString)

module.exports = {
  connectionString,
  ssl: sslEnabled ? { rejectUnauthorized: false } : undefined
}
