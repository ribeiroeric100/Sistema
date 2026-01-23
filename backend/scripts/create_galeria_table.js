const { Pool } = require('pg')
const path = require('path')

const connectionString = String(process.env.DATABASE_URL || process.env.MIGRATIONS_DATABASE_URL || '').trim()
if (!connectionString) {
  console.error('[FATAL] DATABASE_URL não configurado. Exporte DATABASE_URL antes de rodar este script.')
  process.exit(1)
}

const pool = new Pool({ connectionString, ssl: (process.env.PGSSL === 'true') ? { rejectUnauthorized: false } : undefined })

async function run() {
  const client = await pool.connect()
  try {
    await client.query(`CREATE TABLE IF NOT EXISTS galeria_imagens (
      id text PRIMARY KEY,
      paciente_id text NOT NULL REFERENCES pacientes(id) ON DELETE CASCADE,
      url text NOT NULL,
      nome_arquivo text,
      data_upload timestamp DEFAULT CURRENT_TIMESTAMP
    );`)

    await client.query(`CREATE INDEX IF NOT EXISTS idx_galeria_imagens_paciente_id ON galeria_imagens(paciente_id);`)

    console.log('✅ Tabela galeria_imagens criada ou já existente no Postgres')
  } catch (e) {
    console.error('[ERROR] Falha ao criar tabela galeria_imagens:', e.message || e)
    process.exitCode = 1
  } finally {
    client.release()
    await pool.end()
  }
}

run()
