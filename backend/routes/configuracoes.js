const express = require('express')
const { db } = require('../config/database')
const { verifyToken, verifyRole } = require('../middleware/auth')
const { logAudit } = require('../services/audit')

const router = express.Router()

const ALLOWED_KEYS = [
  'nome_clinica',
  'cro_responsavel',
  'telefone_clinica',
  'email_clinica',
  'endereco_clinica',
  'rodape_pdf',
  'logo_claro',
  'logo_escuro',
  'tema_ui',
  'tema_ui_admin',
  'tema_ui_dentista',
  'tema_ui_recepcao',
  'cor_primaria',
  'lembrete_whatsapp_ativo',
  'lembrete_email_ativo',
  'mensagem_lembrete'
]

const DEFAULTS = {
  nome_clinica: 'DR. NETO ABREU',
  cro_responsavel: '',
  telefone_clinica: '',
  email_clinica: '',
  endereco_clinica: '',
  rodape_pdf: '',
  logo_claro: '',
  logo_escuro: '',
  tema_ui: 'system',
  tema_ui_admin: '',
  tema_ui_dentista: '',
  tema_ui_recepcao: '',
  cor_primaria: '#2563eb',
  lembrete_whatsapp_ativo: 'true',
  lembrete_email_ativo: 'false',
  mensagem_lembrete: 'Olá {{paciente}}, sua consulta com o Dr. {{dentista}} é amanhã às {{hora}}.'
}

const rowsToObject = (rows) => {
  const obj = {}
  for (const row of rows || []) {
    obj[row.chave] = row.valor
  }
  // ensure all allowed keys exist
  for (const key of ALLOWED_KEYS) {
    if (!(key in obj)) obj[key] = Object.prototype.hasOwnProperty.call(DEFAULTS, key) ? DEFAULTS[key] : ''
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

// Atualizar configurações básicas (admin, dentista e recepcao)
router.put('/', verifyToken, verifyRole(['admin', 'dentista', 'recepcao']), async (req, res) => {
  const payload = req.body
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return res.status(400).json({ error: 'Payload inválido' })
  }

  const keysToUpdate = ALLOWED_KEYS.filter((k) => Object.prototype.hasOwnProperty.call(payload, k))
  if (!keysToUpdate.length) {
    return res.status(400).json({ error: 'Nenhuma configuração válida para atualizar' })
  }

  try {
    await db.tx(async (trx) => {
      for (const key of keysToUpdate) {
        const value = payload[key]
        await trx.run(
          `INSERT INTO configuracoes (chave, valor, atualizado_em)
           VALUES (?, ?, CURRENT_TIMESTAMP)
           ON CONFLICT (chave) DO UPDATE SET
             valor = excluded.valor,
             atualizado_em = CURRENT_TIMESTAMP`,
          [key, value === null || value === undefined ? '' : String(value)]
        )
      }
    })

    const placeholders = ALLOWED_KEYS.map(() => '?').join(',')
    const rows = await db.all(
      `SELECT chave, valor FROM configuracoes WHERE chave IN (${placeholders})`,
      ALLOWED_KEYS
    )

    logAudit(req, 'configuracoes.update', { details: { keys: keysToUpdate } })
    return res.json(rowsToObject(rows))
  } catch (err) {
    return res.status(500).json({ error: err?.message || 'Erro interno' })
  }
})

module.exports = router
