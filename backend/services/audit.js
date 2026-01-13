const { v4: uuidv4 } = require('uuid')
const { db } = require('../config/database')

const safeString = (v) => {
  try {
    if (v === null || v === undefined) return null
    const s = String(v)
    return s.length > 2000 ? s.slice(0, 2000) : s
  } catch (e) {
    return null
  }
}

const safeJson = (obj) => {
  try {
    if (obj === undefined) return null
    const json = JSON.stringify(obj)
    return json.length > 20000 ? json.slice(0, 20000) : json
  } catch (e) {
    return null
  }
}

function getRequestIp(req) {
  const xf = req.headers['x-forwarded-for']
  if (typeof xf === 'string' && xf.trim()) return xf.split(',')[0].trim()
  return req.ip || req.connection?.remoteAddress || null
}

function logAudit(req, action, meta = {}) {
  try {
    const id = uuidv4()
    const userId = req?.user?.id || null
    const userRole = req?.user?.role || null
    const ip = getRequestIp(req)
    const userAgent = safeString(req?.headers?.['user-agent'] || null)

    const entityType = safeString(meta.entityType || null)
    const entityId = safeString(meta.entityId || null)
    const details = safeJson(meta.details)

    db.run(
      `INSERT INTO audit_logs (id, user_id, user_role, action, entity_type, entity_id, ip, user_agent, details)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, userId, userRole, safeString(action), entityType, entityId, ip, userAgent, details],
      (err) => {
        if (err) console.error('Erro ao gravar audit log:', err.message)
      }
    )
  } catch (e) {
    // não pode quebrar request
  }
}

module.exports = { logAudit, getRequestIp }
