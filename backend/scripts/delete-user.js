#!/usr/bin/env node

require('dotenv').config()
const { db, initialize } = require('../config/database')

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

async function getRow(sql, params) {
  return db.get(sql, params)
}

async function main() {
  const arg1 = process.argv[2]
  const arg2 = process.argv[3]

  if (!arg1) {
    usage()
    process.exitCode = 1
    return
  }

  try {
    await initialize()

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
      ? await getRow('SELECT id, nome, email, role, ativo FROM usuarios WHERE id = ?', [userId])
      : await getRow('SELECT id, nome, email, role, ativo FROM usuarios WHERE lower(email) = lower(?)', [email])

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

    const { r1, r2, r3, r4, r5 } = await db.tx(async (trx) => {
      const r1 = await trx.run('UPDATE consultas SET dentista_id = NULL WHERE dentista_id = ?', [user.id])
      const r2 = await trx.run('UPDATE movimentacoes_estoque SET usuario_id = NULL WHERE usuario_id = ?', [user.id])
      const r3 = await trx.run('UPDATE relatorios SET gerado_por = NULL WHERE gerado_por = ?', [user.id])
      const r4 = await trx.run('DELETE FROM password_resets WHERE user_id = ?', [user.id])
      const r5 = await trx.run('UPDATE audit_logs SET user_id = NULL WHERE user_id = ?', [user.id])
      const r6 = await trx.run('DELETE FROM usuarios WHERE id = ?', [user.id])

      if (r6.changes !== 1) throw new Error('Falha ao remover usuário (changes != 1)')
      return { r1, r2, r3, r4, r5 }
    })

    console.log(`OK: usuário removido: ${user.email} (${user.nome || ''}) role=${user.role}`)
    console.log(`- consultas.dentista_id -> NULL: ${r1.changes}`)
    console.log(`- movimentacoes_estoque.usuario_id -> NULL: ${r2.changes}`)
    console.log(`- relatorios.gerado_por -> NULL: ${r3.changes}`)
    console.log(`- password_resets deletados: ${r4.changes}`)
    console.log(`- audit_logs.user_id -> NULL: ${r5.changes}`)
  } catch (e) {
    console.error('Erro ao apagar usuário:', e?.message || e)
    process.exitCode = 1
  } finally {
    await db.close()
  }
}

main()
