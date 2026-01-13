const express = require('express')
const { db } = require('../config/database')
const { verifyToken, verifyRole } = require('../middleware/auth')
const { logAudit } = require('../services/audit')

const router = express.Router()

// Visualizar logs (somente admin)
router.get('/', verifyToken, verifyRole(['admin']), (req, res) => {
  const limit = Math.min(Number(req.query.limit || 50), 200)
  const offset = Math.max(Number(req.query.offset || 0), 0)

  const { user_id, action, entity_type, entity_id, from, to } = req.query

  const where = []
  const params = []

  if (user_id) { where.push('user_id = ?'); params.push(String(user_id)) }
  if (action) { where.push('action = ?'); params.push(String(action)) }
  if (entity_type) { where.push('entity_type = ?'); params.push(String(entity_type)) }
  if (entity_id) { where.push('entity_id = ?'); params.push(String(entity_id)) }
  if (from) { where.push('created_at >= ?'); params.push(String(from)) }
  if (to) { where.push('created_at <= ?'); params.push(String(to)) }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''

  db.all(
    `SELECT id, user_id, user_role, action, entity_type, entity_id, ip, user_agent, details, created_at
     FROM audit_logs
     ${whereSql}
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message })
      logAudit(req, 'auditoria.list', { details: { limit, offset, filters: { user_id, action, entity_type, entity_id, from, to } } })
      res.json({ items: rows || [], limit, offset })
    }
  )
})

module.exports = router
