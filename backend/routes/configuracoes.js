const express = require('express')
const { db } = require('../config/database')
const { verifyToken, verifyRole } = require('../middleware/auth')
const { logAudit } = require('../services/audit')

const router = express.Router()

const ALLOWED_KEYS = [
  'nome_clinica',
  'telefone_clinica',
  'email_clinica',
  'endereco_clinica',
  'rodape_pdf'
]

const rowsToObject = (rows) => {
  const obj = {}
  for (const row of rows || []) {
    obj[row.chave] = row.valor
  }
  // ensure all allowed keys exist
  for (const key of ALLOWED_KEYS) {
    if (!(key in obj)) obj[key] = ''
  }
  return obj
}

// Buscar configurações básicas
router.get('/', verifyToken, (req, res) => {
  const placeholders = ALLOWED_KEYS.map(() => '?').join(',')
  db.all(
    `SELECT chave, valor FROM configuracoes WHERE chave IN (${placeholders})`,
    ALLOWED_KEYS,
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message })
      logAudit(req, 'configuracoes.get')
      res.json(rowsToObject(rows))
    }
  )
})

// Atualizar configurações básicas (somente admin)
router.put('/', verifyToken, verifyRole(['admin']), (req, res) => {
  const payload = req.body
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return res.status(400).json({ error: 'Payload inválido' })
  }

  const keysToUpdate = ALLOWED_KEYS.filter((k) => Object.prototype.hasOwnProperty.call(payload, k))
  if (!keysToUpdate.length) {
    return res.status(400).json({ error: 'Nenhuma configuração válida para atualizar' })
  }

  db.serialize(() => {
    const stmt = db.prepare(
      `INSERT INTO configuracoes (chave, valor, atualizado_em)
       VALUES (?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(chave) DO UPDATE SET
         valor = excluded.valor,
         atualizado_em = CURRENT_TIMESTAMP`
    )

    let hadError = false
    for (const key of keysToUpdate) {
      const value = payload[key]
      stmt.run([key, value === null || value === undefined ? '' : String(value)], (err) => {
        if (err && !hadError) {
          hadError = true
          return res.status(500).json({ error: err.message })
        }
      })
    }

    stmt.finalize((finalizeErr) => {
      if (finalizeErr) return res.status(500).json({ error: finalizeErr.message })
      if (hadError) return

      const placeholders = ALLOWED_KEYS.map(() => '?').join(',')
      db.all(
        `SELECT chave, valor FROM configuracoes WHERE chave IN (${placeholders})`,
        ALLOWED_KEYS,
        (err2, rows) => {
          if (err2) return res.status(500).json({ error: err2.message })
          logAudit(req, 'configuracoes.update', { details: { keys: keysToUpdate } })
          res.json(rowsToObject(rows))
        }
      )
    })
  })
})

module.exports = router
