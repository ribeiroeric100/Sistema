#!/usr/bin/env node

require('dotenv').config()

const fs = require('fs')
const path = require('path')
const initSqlJs = require('sql.js')
const { Pool } = require('pg')

function parseArgs(argv) {
  const args = { _: [] }
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--truncate') args.truncate = true
    else if (a === '--dry-run') args.dryRun = true
    else if (a === '--strict') args.strict = true
    else if (a === '--skip-fk') args.skipFk = true
    else if (a === '--only') args.only = String(argv[++i] || '').split(',').map((s) => s.trim()).filter(Boolean)
    else args._.push(a)
  }
  return args
}

function qIdent(name) {
  // minimal safe identifier quoting
  return '"' + String(name).replace(/"/g, '""') + '"'
}

function isTableMissingError(e) {
  const msg = String(e?.message || '')
  return /no such table/i.test(msg)
}

function chunk(array, size) {
  const out = []
  for (let i = 0; i < array.length; i += size) out.push(array.slice(i, i + size))
  return out
}

async function loadSqlite(filePath) {
  const absolute = path.resolve(filePath)
  if (!fs.existsSync(absolute)) throw new Error(`SQLite file not found: ${absolute}`)

  const SQL = await initSqlJs()
  const fileBuffer = fs.readFileSync(absolute)
  const db = new SQL.Database(new Uint8Array(fileBuffer))
  return db
}

function sqliteAll(db, sql, params = []) {
  const stmt = db.prepare(sql)
  try {
    stmt.bind(params)
    const rows = []
    while (stmt.step()) rows.push(stmt.getAsObject())
    return rows
  } finally {
    stmt.free()
  }
}

async function getPgColumnTypes(client, table) {
  const res = await client.query(
    "select column_name, data_type from information_schema.columns where table_schema='public' and table_name=$1",
    [table]
  )
  const map = new Map()
  for (const r of res.rows || []) {
    map.set(r.column_name, r.data_type)
  }
  return map
}

function normalizeValueForPg(value, dataType) {
  if (value === undefined) return null

  // SQLite often stores empty strings for numbers/dates. Postgres rejects that.
  if (value === '') {
    const dt = String(dataType || '').toLowerCase()
    // For text columns, keep empty string.
    if (dt.includes('character') || dt === 'text') return ''
    return null
  }

  const dt = String(dataType || '').toLowerCase()

  if (dt === 'boolean') {
    if (value === 0 || value === 1) return Boolean(value)
    if (value === '0' || value === '1') return value === '1'
    return value
  }

  return value
}

async function withPostgres(fn) {
  const cs = String(process.env.DATABASE_URL || '').trim()
  if (!cs) throw new Error('DATABASE_URL ausente (Postgres)')

  const sslEnabled =
    String(process.env.NODE_ENV || '').toLowerCase() === 'production' ||
    String(process.env.PGSSL || '').toLowerCase() === 'true' ||
    /\bsupabase\.(co|com)\b/i.test(cs)

  const pool = new Pool({ connectionString: cs, ssl: sslEnabled ? { rejectUnauthorized: false } : undefined })
  const client = await pool.connect()
  try {
    return await fn(client)
  } finally {
    client.release()
    await pool.end()
  }
}

function buildInsertSQL(table, columns, conflict) {
  const colList = columns.map(qIdent).join(', ')
  const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ')
  const base = `INSERT INTO public.${qIdent(table)} (${colList}) VALUES (${placeholders})`

  if (!conflict) return base

  // conflict: { target: ['id'], update: ['col1','col2'] | 'all' | null }
  const target = Array.isArray(conflict.target) ? conflict.target.map(qIdent).join(', ') : qIdent(conflict.target)
  if (!conflict.update) return `${base} ON CONFLICT (${target}) DO NOTHING`

  const updateCols = conflict.update === 'all' ? columns.filter((c) => !conflict.target.includes(c)) : conflict.update
  if (!updateCols || updateCols.length === 0) return `${base} ON CONFLICT (${target}) DO NOTHING`

  const setSql = updateCols.map((c) => `${qIdent(c)} = EXCLUDED.${qIdent(c)}`).join(', ')
  return `${base} ON CONFLICT (${target}) DO UPDATE SET ${setSql}`
}

async function main() {
  const args = parseArgs(process.argv)
  const sqlitePath = args._[0]

  if (!sqlitePath) {
    console.error(
      'Uso: node scripts/import-sqlite-to-postgres.js <caminho-para.sqlite> [--truncate] [--dry-run] [--only tabela1,tabela2] [--skip-fk] [--strict]'
    )
    process.exit(1)
  }

  const tableOrder = [
    'usuarios',
    'pacientes',
    'produtos_estoque',
    'consultas',
    'movimentacoes_estoque',
    'relatorios',
    'alertas_estoque',
    'daily_receitas',
    'odontogramas',
    'configuracoes',
    'audit_logs',
    'password_resets'
  ]

  const conflictByTable = {
    usuarios: { target: ['id'], update: null },
    pacientes: { target: ['id'], update: null },
    produtos_estoque: { target: ['id'], update: null },
    consultas: { target: ['id'], update: null },
    movimentacoes_estoque: { target: ['id'], update: null },
    relatorios: { target: ['id'], update: null },
    alertas_estoque: { target: ['id'], update: null },
    audit_logs: { target: ['id'], update: null },
    password_resets: { target: ['id'], update: null },
    odontogramas: { target: ['paciente_id'], update: ['estado_json', 'atualizado_em', 'criado_em'] },
    configuracoes: { target: ['chave'], update: ['valor', 'atualizado_em'] },
    daily_receitas: { target: ['dia'], update: ['total'] }
  }

  const only = Array.isArray(args.only) && args.only.length > 0 ? new Set(args.only) : null
  const selectedTables = tableOrder.filter((t) => !only || only.has(t))

  console.log('SQLite file:', path.resolve(sqlitePath))
  console.log('Mode:', args.dryRun ? 'dry-run' : 'write')
  console.log('Truncate before import:', Boolean(args.truncate))
  console.log('FK handling:', args.strict ? 'strict (abort on errors)' : args.skipFk ? 'skip-fk (skip FK issues)' : 'auto (retry nullable FKs, otherwise abort)')
  console.log('Tables:', selectedTables.join(', '))

  const sqliteDb = await loadSqlite(sqlitePath)

  const sqliteTables = new Set(
    sqliteAll(sqliteDb, "select name from sqlite_master where type='table' and name not like 'sqlite_%' order by name").map((r) => r.name)
  )

  const missing = selectedTables.filter((t) => !sqliteTables.has(t))
  if (missing.length > 0) {
    console.log('Aviso: tabelas não encontradas no SQLite (serão puladas):', missing.join(', '))
  }

  if (args.dryRun) {
    for (const table of selectedTables) {
      if (!sqliteTables.has(table)) continue
      try {
        const rows = sqliteAll(sqliteDb, `select * from ${qIdent(table)}`)
        console.log(`${table}: ${rows.length} rows`) 
      } catch (e) {
        if (isTableMissingError(e)) console.log(`${table}: (missing)`) 
        else throw e
      }
    }
    sqliteDb.close()
    return
  }

  await withPostgres(async (client) => {
    const pgTypeCache = new Map()
    await client.query('BEGIN')
    try {
      if (args.truncate) {
        // Keep pgmigrations table; we only reset application data tables.
        const truncList = selectedTables.map((t) => `public.${qIdent(t)}`).join(', ')
        if (truncList) {
          await client.query(`TRUNCATE ${truncList} CASCADE`)
        }
      }

      for (const table of selectedTables) {
        if (!sqliteTables.has(table)) continue

        let typeMap = pgTypeCache.get(table)
        if (!typeMap) {
          typeMap = await getPgColumnTypes(client, table)
          pgTypeCache.set(table, typeMap)
        }

        const rows = sqliteAll(sqliteDb, `select * from ${qIdent(table)}`)
        if (!rows || rows.length === 0) {
          console.log(`${table}: 0 rows (skip)`) 
          continue
        }

        // Determine columns from first row; preserve order.
        // Keep only columns that exist in Postgres to avoid schema drift issues.
        const sqliteColumns = Object.keys(rows[0])
        const columns = sqliteColumns.filter((c) => typeMap.has(c))
        const dropped = sqliteColumns.filter((c) => !typeMap.has(c))
        if (dropped.length > 0) {
          console.log(`${table}: ignorando colunas não existentes no Postgres: ${dropped.join(', ')}`)
        }
        if (columns.length === 0) {
          console.log(`${table}: 0 colunas compatíveis (skip)`) 
          continue
        }
        const conflict = conflictByTable[table] || null
        const insertSql = buildInsertSQL(table, columns, conflict)

        let skipped = 0
        let fixedNullFk = 0

        // Insert in chunks to avoid very large packets.
        for (const group of chunk(rows, 250)) {
          for (const row of group) {
            const baseValues = columns.map((c) => normalizeValueForPg(row[c], typeMap.get(c)))

            // Use a savepoint so a single row error doesn't abort the whole transaction.
            await client.query('SAVEPOINT sp_row')
            try {
              await client.query(insertSql, baseValues)
              await client.query('RELEASE SAVEPOINT sp_row')
            } catch (e) {
              const code = e && e.code
              const constraint = e && e.constraint

              if (args.strict) {
                // Roll back to clear transaction state, then rethrow.
                await client.query('ROLLBACK TO SAVEPOINT sp_row')
                await client.query('RELEASE SAVEPOINT sp_row')
                throw e
              }

              const canRetryWithNull = (colName) => columns.includes(colName)
              const retryNullColumn = async (colName) => {
                const idx = columns.indexOf(colName)
                if (idx < 0) return false
                const next = baseValues.slice()
                next[idx] = null
                await client.query(insertSql, next)
                fixedNullFk++
                return true
              }

              try {
                if (code === '23503') {
                  if (constraint === 'consultas_dentista_id_fkey' && canRetryWithNull('dentista_id')) {
                    await retryNullColumn('dentista_id')
                    await client.query('RELEASE SAVEPOINT sp_row')
                    continue
                  }
                  if (constraint === 'audit_logs_user_id_fkey' && canRetryWithNull('user_id')) {
                    await retryNullColumn('user_id')
                    await client.query('RELEASE SAVEPOINT sp_row')
                    continue
                  }
                  if (constraint === 'movimentacoes_estoque_usuario_id_fkey' && canRetryWithNull('usuario_id')) {
                    await retryNullColumn('usuario_id')
                    await client.query('RELEASE SAVEPOINT sp_row')
                    continue
                  }

                  if (args.skipFk) {
                    skipped++
                    await client.query('ROLLBACK TO SAVEPOINT sp_row')
                    await client.query('RELEASE SAVEPOINT sp_row')
                    continue
                  }
                }

                // Not handled: rollback to keep transaction usable, then rethrow.
                await client.query('ROLLBACK TO SAVEPOINT sp_row')
                await client.query('RELEASE SAVEPOINT sp_row')
                throw e
              } catch (inner) {
                // If retry failed (or rollback failed), ensure we clear the savepoint and then throw.
                try {
                  await client.query('ROLLBACK TO SAVEPOINT sp_row')
                  await client.query('RELEASE SAVEPOINT sp_row')
                } catch (_) {
                  // ignore
                }
                throw inner
              }
            }
          }
        }

        const extraInfo = []
        if (fixedNullFk > 0) extraInfo.push(`fk->null ${fixedNullFk}`)
        if (skipped > 0) extraInfo.push(`skipped ${skipped}`)
        console.log(`${table}: processed ${rows.length}${extraInfo.length ? ` (${extraInfo.join(', ')})` : ''}`)
      }

      await client.query('COMMIT')
    } catch (e) {
      await client.query('ROLLBACK')
      throw e
    }
  })

  sqliteDb.close()

  console.log('Import finalizado.')
  console.log('Sugestão: rode `node scripts/db-check.js DATABASE_URL` para conferir contagens.')
}

main().catch((e) => {
  console.error('ERR:', e?.message || e)
  process.exit(1)
})
