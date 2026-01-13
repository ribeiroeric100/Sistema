const jwt = require('jsonwebtoken')

function getJwtSecret() {
  const nodeEnv = String(process.env.NODE_ENV || '').toLowerCase()
  const isProd = nodeEnv === 'production'
  const secret = String(process.env.JWT_SECRET || '').trim()
  if (secret) return secret
  if (isProd) {
    console.error('[FATAL] JWT_SECRET não configurado em produção.')
    process.exit(1)
  }
  return 'dev_jwt_secret_change_me'
}

const normalizeRole = (role) => {
  const r = String(role || '').trim().toLowerCase()
  if (!r) return ''
  if (r === 'assistente') return 'recepcao'
  if (r === 'recepção') return 'recepcao'
  if (r === 'recepcao') return 'recepcao'
  if (r === 'dentista') return 'dentista'
  if (r === 'admin' || r === 'administrador') return 'admin'
  return r
}

const verifyToken = (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1]

  if (!token) {
    return res.status(401).json({ error: 'Token não fornecido' })
  }

  jwt.verify(token, getJwtSecret(), (err, decoded) => {
    if (err) {
      return res.status(401).json({ error: 'Token inválido' })
    }
    req.user = { ...decoded, role: normalizeRole(decoded?.role) }
    next()
  })
}

const verifyRole = (rolesPermitidas) => {
  return (req, res, next) => {
    const allowed = (rolesPermitidas || []).map(normalizeRole)
    const current = normalizeRole(req.user?.role)
    if (!allowed.includes(current)) {
      return res.status(403).json({ error: 'Acesso negado' })
    }
    next()
  }
}

module.exports = { verifyToken, verifyRole, normalizeRole }
