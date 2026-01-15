#!/usr/bin/env node

require('dotenv').config()
const { Pool } = require('pg')

function safeDbInfo(connectionString) {
  const url = new URL(connectionString)
  return {
    host: url.host,
    database: String(url.pathname || '').replace(/^\//, '') || '(vazio)'
  }
}

async function main() {
  const envKey = String(process.argv[2] || 'DATABASE_URL').trim()
  const cs = String(process.env[envKey] || '').trim()
  if (!cs) {
    console.error(`${envKey} ausente`)
    process.exit(1)
  }

  console.log('Using:', envKey)
  const info = safeDbInfo(cs)
  console.log('DB host:', info.host)
  console.log('DB name:', info.database)

  // Supabase/managed Postgres often requires SSL; rejectUnauthorized=false matches existing app config.
  const pool = new Pool({ connectionString: cs, ssl: { rejectUnauthorized: false } })

  try {
    const current = await pool.query('select current_database() as db, current_schema() as schema')
    console.log('current:', current.rows[0])

    const tables = await pool.query(
      "select table_name from information_schema.tables where table_schema='public' order by table_name"
    )
    const tableNames = tables.rows.map((r) => r.table_name)
    console.log('public tables:', tableNames.join(', ') || '(nenhuma)')

    const hasCoreTables = ['pacientes', 'consultas', 'usuarios'].every((t) => tableNames.includes(t))
    if (hasCoreTables) {
      const counts = await pool.query(
        "select (select count(*) from public.pacientes) as pacientes, (select count(*) from public.consultas) as consultas, (select count(*) from public.usuarios) as usuarios"
      )
      console.log('counts:', counts.rows[0])
    } else {
      console.log('counts: (pulado — tabelas base ainda não existem)')
    }
  } finally {
    await pool.end()
  }
}

main().catch((e) => {
  console.error('ERR:', e?.message || e)
  process.exit(1)
})
