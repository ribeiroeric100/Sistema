#!/usr/bin/env node

const path = require('path')
const sqlite3 = require('sqlite3').verbose()

const dbPath = path.join(__dirname, '..', 'database.db')

function openDb() {
  return new sqlite3.Database(dbPath)
}

function usage() {
  const cmd = 'node scripts/delete-user.js'
  console.log('Uso:')
  console.log(`  ${cmd} <email>`)
  console.log(`  ${cmd} --id <userId>`)
  console.log('')
  console.log('Notas:')
  console.log('- Remove o usuário da tabela usuarios e limpa referências em tabelas relacionadas (define NULL).')
  console.log("- Por segurança, não remove usuários com role=admin.")
}

function getRow(db, sql, params) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) return reject(err)
      resolve(row || null)
    })
  })
}

function runSql(db, sql, params) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err)
      resolve({ changes: this.changes })
    })
  })
}

async function begin(db) {
  await runSql(db, 'BEGIN TRANSACTION', [])
}

async function commit(db) {
  await runSql(db, 'COMMIT', [])
}

async function rollback(db) {
  try {
    await runSql(db, 'ROLLBACK', [])
  } catch (_) {
    // ignore
  }
}

async function main() {
  const arg1 = process.argv[2]
  const arg2 = process.argv[3]

  if (!arg1) {
    usage()
    process.exitCode = 1
    return
  }

  const db = openDb()

  try {
    const byId = arg1 === '--id'
    const email = byId ? null : String(arg1 || '').trim()
    const userId = byId ? String(arg2 || '').trim() : null

    if (byId && !userId) {
      console.error('Erro: informe o userId após --id')
      usage()
      process.exitCode = 1
      return
    }

    const user = byId
      ? await getRow(db, 'SELECT id, nome, email, role, ativo FROM usuarios WHERE id = ?', [userId])
      : await getRow(db, 'SELECT id, nome, email, role, ativo FROM usuarios WHERE lower(email) = lower(?)', [email])

    if (!user) {
      console.error('Erro: usuário não encontrado.')
      process.exitCode = 1
      return
    }

    if (String(user.role || '').toLowerCase() === 'admin') {
      console.error('Erro: por segurança, não apago usuários admin por este script.')
      process.exitCode = 1
      return
    }

    await begin(db)

    const r1 = await runSql(db, 'UPDATE consultas SET dentista_id = NULL WHERE dentista_id = ?', [user.id])
    const r2 = await runSql(db, 'UPDATE movimentacoes_estoque SET usuario_id = NULL WHERE usuario_id = ?', [user.id])
    const r3 = await runSql(db, 'UPDATE relatorios SET gerado_por = NULL WHERE gerado_por = ?', [user.id])
    const r4 = await runSql(db, 'DELETE FROM password_resets WHERE user_id = ?', [user.id])
    const r5 = await runSql(db, 'UPDATE audit_logs SET user_id = NULL WHERE user_id = ?', [user.id])
    const r6 = await runSql(db, 'DELETE FROM usuarios WHERE id = ?', [user.id])

    if (r6.changes !== 1) {
      throw new Error('Falha ao remover usuário (changes != 1)')
    }

    await commit(db)

    console.log(`OK: usuário removido: ${user.email} (${user.nome || ''}) role=${user.role}`)
    console.log(`- consultas.dentista_id -> NULL: ${r1.changes}`)
    console.log(`- movimentacoes_estoque.usuario_id -> NULL: ${r2.changes}`)
    console.log(`- relatorios.gerado_por -> NULL: ${r3.changes}`)
    console.log(`- password_resets deletados: ${r4.changes}`)
    console.log(`- audit_logs.user_id -> NULL: ${r5.changes}`)
  } catch (e) {
    await rollback(db)
    console.error('Erro ao apagar usuário:', e?.message || e)
    process.exitCode = 1
  } finally {
    db.close()
  }
}

main()
