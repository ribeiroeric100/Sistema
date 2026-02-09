const express = require('express')
const { db } = require('../config/database')
const { verifyToken, verifyRole } = require('../middleware/auth')
const { logAudit } = require('../services/audit')
const multer = require('multer')
const path = require('path')
const fs = require('fs')

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
  'mensagem_lembrete',
  'reminder_hours_before',
  'whatsapp_confirmacao_agendamento_ativo',
  'mensagem_confirmacao_consulta'
]

// Add personalizado keys and logo_personalizado for custom theme persistence
const PERSONALIZADO_KEYS = [
  'logo_personalizado',
  'personalizado_sidebar_bg',
  'personalizado_sidebar_fg',
  'personalizado_table_head_bg',
  'personalizado_bg',
  'personalizado_surface',
  'personalizado_text',
  'personalizado_sidebar_start',
  'personalizado_sidebar_end'
]

// Extend allowed keys
for (const k of PERSONALIZADO_KEYS) ALLOWED_KEYS.push(k)

const DEFAULTS = {
  nome_clinica: 'DENTALY',
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
  // Lembrete padrão (funciona bem com 2h antes)
  mensagem_lembrete: 'Olá {{paciente}}! Lembrete: sua consulta com {{dentista}} é em {{data}} às {{hora}}.',
  // Quantas horas antes do horário da consulta devemos enviar o lembrete
  reminder_hours_before: '2',
  // Confirmação imediata ao criar a consulta (opcional; default off para evitar custo/duplicidade)
  whatsapp_confirmacao_agendamento_ativo: 'false',
  mensagem_confirmacao_consulta: 'Olá {{paciente}}! Sua consulta com {{dentista}} foi agendada para {{data}} às {{hora}}.'
}

// Defaults for personalizado keys
for (const k of PERSONALIZADO_KEYS) {
  if (!(k in DEFAULTS)) DEFAULTS[k] = ''
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

// Endpoint to upload sidebar logo for personalizado theme
// Expects multipart/form-data with field name `file`
// Note: we add this after module.exports to keep existing flow; router is still exported by reference.
const uploadsDir = path.join(__dirname, '..', 'uploads')
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true })

const storage = multer.diskStorage({
  destination: uploadsDir,
  filename: (req, file, cb) => {
    const safe = file.originalname.replace(/[^a-z0-9.\-_]/gi, '_')
    const name = `${Date.now()}_${safe}`
    cb(null, name)
  }
})

const upload = multer({ storage })

// mount route on the same router instance
router.post('/logo', verifyToken, verifyRole(['admin', 'dentista', 'recepcao']), upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Arquivo não enviado' })
    const publicPath = `/uploads/${req.file.filename}`
    logAudit(req, 'configuracoes.upload_logo', { filename: req.file.filename })
    return res.json({ url: publicPath })
  } catch (err) {
    console.error('upload logo error', err)
    return res.status(500).json({ error: 'Erro ao enviar arquivo' })
  }
})
