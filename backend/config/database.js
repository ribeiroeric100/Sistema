const { Pool } = require('pg')

const NODE_ENV = String(process.env.NODE_ENV || '').toLowerCase()
const isProduction = NODE_ENV === 'production'

let pool

function getPool() {
  if (pool) return pool

  const connectionString = String(process.env.DATABASE_URL || '').trim()

  if (!connectionString) {
    const msg = '[FATAL] DATABASE_URL não configurado. Configure Postgres (ex.: Render fornece DATABASE_URL automaticamente).'
    if (isProduction) {
      console.error(msg)
      process.exit(1)
    }
    throw new Error(msg)
  }

  const sslEnabled =
    isProduction ||
    String(process.env.PGSSL || '').toLowerCase() === 'true' ||
    /\bsupabase\.(co|com)\b/i.test(connectionString)
  pool = new Pool({
    connectionString,
    ssl: sslEnabled ? { rejectUnauthorized: false } : undefined
  })

  return pool
}

function normalizeQueryArgs(sql, params, cb) {
  if (typeof params === 'function') return { sql, params: [], cb: params }
  if (typeof cb === 'function') return { sql, params: Array.isArray(params) ? params : [], cb }
  return { sql, params: Array.isArray(params) ? params : [], cb: null }
}

function replaceSqlitePlaceholders(sql) {
  let i = 0
  return String(sql).replace(/\?/g, () => `$${++i}`)
}

async function execQuery({ sql, params, client = null }) {
  const text = replaceSqlitePlaceholders(sql)
  const runner = client ? client : getPool()
  return runner.query(text, params)
}

function makeDb(client) {
  return {
    async all(sql, params, cb) {
      const args = normalizeQueryArgs(sql, params, cb)
      const p = execQuery({ sql: args.sql, params: args.params, client }).then((r) => r.rows || [])
      if (args.cb) {
        p.then((rows) => args.cb(null, rows)).catch((e) => args.cb(e))
        return
      }
      return p
    },
    async get(sql, params, cb) {
      const args = normalizeQueryArgs(sql, params, cb)
      const p = execQuery({ sql: args.sql, params: args.params, client }).then((r) => (r.rows && r.rows[0]) || undefined)
      if (args.cb) {
        p.then((row) => args.cb(null, row)).catch((e) => args.cb(e))
        return
      }
      return p
    },
    async run(sql, params, cb) {
      const args = normalizeQueryArgs(sql, params, cb)
      const p = execQuery({ sql: args.sql, params: args.params, client }).then((r) => ({ changes: Number(r.rowCount || 0) }))
      if (args.cb) {
        p.then((meta) => args.cb.call(meta, null)).catch((e) => args.cb(e))
        return
      }
      return p
    },
    async tx(fn) {
      const outerPool = getPool()
      const txClient = await outerPool.connect()
      try {
        await txClient.query('BEGIN')
        const result = await fn(makeDb(txClient))
        await txClient.query('COMMIT')
        return result
      } catch (e) {
        try {
          await txClient.query('ROLLBACK')
        } catch (_) {
          // ignore rollback errors
        }
        throw e
      } finally {
        txClient.release()
      }
    },
    async close() {
      if (!pool) return
      const p = pool
      pool = null
      await p.end()
    }
  }
}

const db = makeDb(null)

async function initialize() {
  await getPool().query('SELECT 1')
  console.log('✅ Conectado ao Postgres')
}

module.exports = { db, initialize }
