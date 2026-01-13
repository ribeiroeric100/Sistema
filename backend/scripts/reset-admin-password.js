#!/usr/bin/env node

const path = require('path')
const sqlite3 = require('sqlite3').verbose()
const bcrypt = require('bcryptjs')

const dbPath = path.join(__dirname, '..', 'database.db')

function openDb() {
  return new sqlite3.Database(dbPath)
}

function usage() {
  const cmd = 'node scripts/reset-admin-password.js'
  console.log('Uso:')
  console.log(`  ${cmd} <email> <novaSenha>`)
  console.log(`  ${cmd} --all-admins <novaSenha>`) 
  console.log('')
  console.log('Dicas:')
  console.log(`  ${cmd}              # lista usuários admin`) 
}

function listAdmins(db) {
  return new Promise((resolve, reject) => {
    db.all(
      "SELECT id, nome, email, role, ativo, criado_em FROM usuarios WHERE role = 'admin' ORDER BY criado_em ASC",
      (err, rows) => {
        if (err) return reject(err)
        resolve(rows || [])
      }
    )
  })
}

function getUserByEmail(db, email) {
  return new Promise((resolve, reject) => {
    db.get('SELECT id, email, role, ativo FROM usuarios WHERE lower(email) = lower(?)', [email], (err, row) => {
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

async function main() {
  const arg1 = process.argv[2]
  const arg2 = process.argv[3]

  const db = openDb()

  try {
    if (!arg1) {
      const admins = await listAdmins(db)
      if (admins.length === 0) {
        console.log('Nenhum usuário admin encontrado no banco.')
        console.log('Se este for o primeiro setup, você pode registrar um novo usuário e ele vira admin automaticamente (quando não existe nenhum usuário).')
      } else {
        console.log('Admins encontrados:')
        for (const u of admins) {
          console.log(`- ${u.email} (${u.nome}) ativo=${u.ativo}`)
        }
      }
      console.log('')
      usage()
      process.exitCode = 0
      return
    }

    const isAllAdmins = arg1 === '--all-admins'

    const newPassword = isAllAdmins ? arg2 : arg2
    const email = isAllAdmins ? null : arg1

    if (!newPassword || String(newPassword).length < 6) {
      console.error('Erro: novaSenha deve ter no mínimo 6 caracteres.')
      usage()
      process.exitCode = 1
      return
    }

    const senhaHash = bcrypt.hashSync(String(newPassword), 10)

    if (isAllAdmins) {
      const result = await runSql(db, "UPDATE usuarios SET senha = ? WHERE role = 'admin'", [senhaHash])
      console.log(`OK: senha atualizada para ${result.changes} usuário(s) admin.`)
      return
    }

    const user = await getUserByEmail(db, email)
    if (!user) {
      console.error(`Erro: usuário não encontrado para email: ${email}`)
      const admins = await listAdmins(db)
      if (admins.length) {
        console.log('Admins existentes no banco:')
        for (const u of admins) console.log(`- ${u.email} (${u.nome})`) 
      }
      process.exitCode = 1
      return
    }

    if (user.ativo === 0) {
      console.error('Aviso: usuário está desativado (ativo=0). A senha ainda será atualizada.')
    }

    const result = await runSql(db, 'UPDATE usuarios SET senha = ? WHERE id = ?', [senhaHash, user.id])
    if (result.changes !== 1) {
      console.error('Erro: nenhuma linha foi atualizada (changes != 1).')
      process.exitCode = 1
      return
    }

    console.log(`OK: senha atualizada para ${user.email} (role=${user.role}).`)
  } catch (e) {
    console.error('Erro ao resetar senha:', e?.message || e)
    process.exitCode = 1
  } finally {
    db.close()
  }
}

main()
