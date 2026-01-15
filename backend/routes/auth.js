const express = require('express')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const crypto = require('crypto')
const { v4: uuidv4 } = require('uuid')
const { z } = require('zod')
const { db } = require('../config/database')
const { logAudit, getRequestIp } = require('../services/audit')
const { normalizeRole, verifyToken } = require('../middleware/auth')
const { authLoginLimiter, authRegisterLimiter, forgotPasswordLimiter, resetPasswordLimiter } = require('../middleware/rateLimit')
const { validateBody } = require('../middleware/validate')
const nodemailer = require('nodemailer')
const router = express.Router()

function getSecret(name, { allowDevFallback = false, devFallback = '' } = {}) {
  const nodeEnv = String(process.env.NODE_ENV || '').toLowerCase()
  const isProd = nodeEnv === 'production'
  const value = String(process.env[name] || '').trim()
  if (value) return value
  if (isProd) {
    console.error(`[FATAL] ${name} não configurado em produção.`)
    process.exit(1)
  }
  if (allowDevFallback && devFallback) return devFallback
  return ''
}

const JWT_SECRET = getSecret('JWT_SECRET', { allowDevFallback: true, devFallback: 'dev_jwt_secret_change_me' })
const RESET_TOKEN_SECRET = getSecret('RESET_TOKEN_SECRET') || JWT_SECRET

const ALLOWED_ROLES = new Set(['admin', 'dentista', 'recepcao'])

const isInactive = (v) => v === false || v === 0 || v === '0'

// Zod's .email() is strict and rejects common local-dev emails like "admin@local".
// For this app we accept "user@host" with optional dotted suffix ("user@host.com").
const emailLikeSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, 'Email é obrigatório')
  .refine((v) => /^[^\s@]+@[^\s@]+(\.[^\s@]+)*$/.test(v), 'Email inválido')

const registerSchema = z.object({
  nome: z.string().trim().min(1, 'Nome é obrigatório'),
  email: emailLikeSchema,
  senha: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres'),
  role: z.string().optional()
})

const loginSchema = z.object({
  email: emailLikeSchema,
  senha: z.string().min(1, 'Senha é obrigatória')
})

const resetPasswordSchema = z.object({
  token: z.string().trim().min(1, 'Token é obrigatório'),
  novaSenha: z.string().min(6, 'Nova senha deve ter no mínimo 6 caracteres')
})

function buildTransporter() {
  const host = process.env.SMTP_HOST
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS
  const port = Number(process.env.SMTP_PORT || 587)

  if (!host || !user || !pass) return null
  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass }
  })
}

function hashResetToken(token) {
  return crypto.createHmac('sha256', RESET_TOKEN_SECRET).update(String(token)).digest('hex')
}

function getUserFromBearer(req) {
  const token = req.headers['authorization']?.split(' ')[1]
  if (!token) return null
  try {
    const decoded = jwt.verify(token, JWT_SECRET)
    return { ...decoded, role: normalizeRole(decoded?.role) }
  } catch (e) {
    return null
  }
}

// Registro
router.post('/register', authRegisterLimiter, validateBody(registerSchema), (req, res) => {
  const { nome, email, senha, role } = req.body

  // Registro em produção: apenas bootstrap do primeiro admin ou criação por admin autenticado.
  db.get('SELECT COUNT(*) as total FROM usuarios', (countErr, countRow) => {
    if (countErr) return res.status(500).json({ error: 'Erro ao verificar usuários' })

    const totalUsers = Number(countRow?.total || 0)
    const requester = getUserFromBearer(req)

    if (totalUsers > 0) {
      if (!requester || requester.role !== 'admin') {
        return res.status(403).json({ error: 'Registro desabilitado. Apenas administradores podem criar usuários.' })
      }
    }

    // Verificar se email já existe
    db.get('SELECT id FROM usuarios WHERE email = ?', [email], (err, user) => {
    if (err) {
      return res.status(500).json({ error: 'Erro ao verificar email' })
    }

    if (user) {
      return res.status(400).json({ error: 'Email já registrado' })
    }

    const senhaHash = bcrypt.hashSync(senha, 10)
    const id = uuidv4()
    const now = new Date().toISOString()

    // Role: primeiro usuário vira admin automaticamente.
    let finalRole = (totalUsers === 0) ? 'admin' : normalizeRole(role || 'recepcao')
    if (!ALLOWED_ROLES.has(finalRole)) finalRole = 'recepcao'

    db.run(
      'INSERT INTO usuarios (id, nome, email, senha, role, ativo, criado_em) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, nome, email, senhaHash, finalRole, true, now],
      function(err) {
        if (err) {
          return res.status(500).json({ error: err.message })
        }

        // Gerar token após registrar
        const token = jwt.sign(
          { id, email, role: finalRole, nome },
          JWT_SECRET,
          { expiresIn: '24h' }
        )

        logAudit(req, 'auth.register', { entityType: 'usuario', entityId: id, details: { email, role: finalRole } })

        res.json({
          token,
          user: { id, nome, email, role: finalRole }
        })
      }
    )
    })
  })
})

// Login
router.post('/login', authLoginLimiter, validateBody(loginSchema), (req, res) => {
  const { email, senha } = req.body

  db.get('SELECT * FROM usuarios WHERE email = ?', [email], (err, user) => {
    if (err || !user) {
      logAudit(req, 'auth.login_failed', { details: { email, reason: 'not_found', ip: getRequestIp(req) } })
      return res.status(401).json({ error: 'Usuário não encontrado' })
    }

    if (isInactive(user.ativo)) {
      logAudit(req, 'auth.login_failed', { details: { email, reason: 'inactive', ip: getRequestIp(req) } })
      return res.status(403).json({ error: 'Usuário desativado' })
    }

    if (!bcrypt.compareSync(senha, user.senha)) {
      logAudit(req, 'auth.login_failed', { entityType: 'usuario', entityId: user.id, details: { email, reason: 'wrong_password', ip: getRequestIp(req) } })
      return res.status(401).json({ error: 'Senha incorreta' })
    }

    const roleNormalized = normalizeRole(user.role)

    const token = jwt.sign(
      { id: user.id, email: user.email, role: roleNormalized, nome: user.nome },
      JWT_SECRET,
      { expiresIn: '24h' }
    )

    // for audit we attach req.user temporarily (route is public)
    req.user = { id: user.id, role: roleNormalized, email: user.email, nome: user.nome }
    logAudit(req, 'auth.login', { entityType: 'usuario', entityId: user.id })

    res.json({ token, user: { id: user.id, nome: user.nome, email: user.email, role: roleNormalized } })
  })
})

// Logout (apenas para auditoria; JWT é stateless)
router.post('/logout', verifyToken, (req, res) => {
  logAudit(req, 'auth.logout', { entityType: 'usuario', entityId: req.user?.id })
  res.json({ success: true })
})

// Esqueci minha senha
router.post('/forgot-password', forgotPasswordLimiter, (req, res) => {
  const { email } = req.body || {}
  const safeEmail = String(email || '').trim().toLowerCase()

  // Sempre responder 200 para evitar enumeração de usuários
  const okResponse = (extra = {}) => res.json({ success: true, message: 'Se o e-mail existir, enviaremos instruções para redefinir a senha.', ...extra })

  if (!safeEmail) return okResponse()

  db.get('SELECT id, nome, email, ativo FROM usuarios WHERE email = ?', [safeEmail], async (err, user) => {
    if (err) return okResponse()
    if (!user || isInactive(user.ativo)) return okResponse()

    const rawToken = crypto.randomBytes(32).toString('hex')
    const tokenHash = hashResetToken(rawToken)
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000) // 1h
    const id = uuidv4()
    const ip = getRequestIp(req)

    db.run(
      'INSERT INTO password_resets (id, user_id, token_hash, expires_at, created_ip) VALUES (?, ?, ?, ?, ?)',
      [id, user.id, tokenHash, expiresAt.toISOString(), ip],
      async () => {
        // Não bloquear a resposta por envio de e-mail
        try {
          const transporter = buildTransporter()
          const from = process.env.SMTP_FROM || process.env.SMTP_USER
          const appUrl = process.env.APP_URL || 'http://localhost:5173'
          const resetLink = `${appUrl}/reset-password?token=${rawToken}`

          if (transporter && from) {
            await transporter.sendMail({
              from,
              to: user.email,
              subject: 'Redefinição de senha',
              text: `Olá ${user.nome},\n\nPara redefinir sua senha, acesse o link (válido por 1 hora):\n${resetLink}\n\nSe você não solicitou isso, ignore este e-mail.`,
              html: `<p>Olá ${user.nome},</p><p>Para redefinir sua senha, acesse o link (válido por 1 hora):</p><p><a href="${resetLink}">${resetLink}</a></p><p>Se você não solicitou isso, ignore este e-mail.</p>`
            })
          }
        } catch (e) {
          // ignora erro de e-mail
        }

        // auditoria
        req.user = { id: user.id, role: normalizeRole(user.role), email: user.email, nome: user.nome }
        logAudit(req, 'auth.forgot_password', { entityType: 'usuario', entityId: user.id })

        // Em DEV, ajudar testes retornando token quando e-mail não estiver configurado
        const transporter = buildTransporter()
        if (!transporter && String(process.env.NODE_ENV || '').toLowerCase() !== 'production') {
          return okResponse({ dev_token: rawToken })
        }

        return okResponse()
      }
    )
  })
})

// Redefinir senha
router.post('/reset-password', resetPasswordLimiter, validateBody(resetPasswordSchema), async (req, res) => {
  const { token, novaSenha } = req.body || {}
  const tokenHash = hashResetToken(token)

  try {
    const row = await db.get(
      `SELECT pr.*, u.email, u.nome, u.role, u.ativo
       FROM password_resets pr
       JOIN usuarios u ON pr.user_id = u.id
       WHERE pr.token_hash = ? AND pr.used_at IS NULL
       ORDER BY pr.created_at DESC
       LIMIT 1`,
      [tokenHash]
    )

    if (!row) return res.status(400).json({ error: 'Token inválido ou expirado' })

    const exp = new Date(row.expires_at)
    if (Number.isNaN(exp.getTime()) || exp.getTime() < Date.now()) {
      return res.status(400).json({ error: 'Token inválido ou expirado' })
    }

    if (isInactive(row.ativo)) return res.status(403).json({ error: 'Usuário desativado' })

    const senhaHash = bcrypt.hashSync(String(novaSenha || ''), 10)

    await db.tx(async (trx) => {
      await trx.run('UPDATE usuarios SET senha = ? WHERE id = ?', [senhaHash, row.user_id])
      await trx.run('UPDATE password_resets SET used_at = CURRENT_TIMESTAMP WHERE id = ?', [row.id])
    })

    req.user = { id: row.user_id, role: normalizeRole(row.role), email: row.email, nome: row.nome }
    logAudit(req, 'auth.reset_password', { entityType: 'usuario', entityId: row.user_id })

    return res.json({ success: true })
  } catch (e) {
    return res.status(500).json({ error: 'Erro ao redefinir senha' })
  }
})

module.exports = router
