const express = require('express')
const bcrypt = require('bcryptjs')
const { v4: uuidv4 } = require('uuid')
const { db } = require('../config/database')
const { verifyToken, verifyRole, normalizeRole } = require('../middleware/auth')
const { logAudit } = require('../services/audit')
const router = express.Router()

const ALLOWED_ROLES = new Set(['admin', 'dentista', 'recepcao'])

const normalizeEmail = (email) => String(email || '').trim().toLowerCase()

// Listar usuários (opcional ?role=dentista)
router.get('/', verifyToken, verifyRole(['admin']), (req, res) => {
  const { role } = req.query
  if (role) {
    db.all('SELECT id, nome, email, role, ativo, criado_em FROM usuarios WHERE role = ?', [normalizeRole(role)], (err, rows) => {
      if (err) return res.status(500).json({ error: err.message })
      logAudit(req, 'usuarios.list', { details: { role } })
      res.json(rows)
    })
  } else {
    db.all('SELECT id, nome, email, role, ativo, criado_em FROM usuarios ORDER BY criado_em DESC', (err, rows) => {
      if (err) return res.status(500).json({ error: err.message })
      logAudit(req, 'usuarios.list')
      res.json(rows)
    })
  }
})

// Criar usuário (somente admin)
router.post('/', verifyToken, verifyRole(['admin']), (req, res) => {
  const { nome, email, senha, role } = req.body || {}
  const finalNome = String(nome || '').trim()
  const finalEmail = normalizeEmail(email)
  const finalSenha = String(senha || '')
  const finalRole = normalizeRole(role || 'recepcao')

  if (!finalNome || !finalEmail || finalSenha.length < 6) {
    return res.status(400).json({ error: 'Nome, email e senha (mín. 6 caracteres) são obrigatórios' })
  }
  if (!ALLOWED_ROLES.has(finalRole)) {
    return res.status(400).json({ error: 'Role inválida' })
  }

  db.get('SELECT id FROM usuarios WHERE email = ?', [finalEmail], (err, row) => {
    if (err) return res.status(500).json({ error: err.message })
    if (row) return res.status(400).json({ error: 'Email já registrado' })

    const id = uuidv4()
    const senhaHash = bcrypt.hashSync(finalSenha, 10)
    const now = new Date().toISOString()
    db.run(
      'INSERT INTO usuarios (id, nome, email, senha, role, ativo, criado_em) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, finalNome, finalEmail, senhaHash, finalRole, true, now],
      (e2) => {
        if (e2) return res.status(500).json({ error: e2.message })
        logAudit(req, 'usuarios.create', { entityType: 'usuario', entityId: id, details: { email: finalEmail, role: finalRole } })
        res.json({ id, nome: finalNome, email: finalEmail, role: finalRole, ativo: true })
      }
    )
  })
})

// Atualizar usuário (somente admin)
router.put('/:id', verifyToken, verifyRole(['admin']), (req, res) => {
  const id = req.params.id
  const { nome, email, role, ativo, senha } = req.body || {}

  db.get('SELECT id, email FROM usuarios WHERE id = ?', [id], (err, current) => {
    if (err) return res.status(500).json({ error: err.message })
    if (!current) return res.status(404).json({ error: 'Usuário não encontrado' })

    const updates = []
    const params = []

    if (nome !== undefined) {
      updates.push('nome = ?')
      params.push(String(nome || '').trim())
    }

    let finalEmail = null
    if (email !== undefined) {
      finalEmail = normalizeEmail(email)
      if (!finalEmail) return res.status(400).json({ error: 'Email inválido' })
    }

    const finalRole = role !== undefined ? normalizeRole(role) : null
    if (role !== undefined && !ALLOWED_ROLES.has(finalRole)) {
      return res.status(400).json({ error: 'Role inválida' })
    }

    if (role !== undefined) {
      updates.push('role = ?')
      params.push(finalRole)
    }

    if (ativo !== undefined) {
      updates.push('ativo = ?')
      params.push(Boolean(ativo))
    }

    if (senha !== undefined && String(senha).length) {
      const pwd = String(senha)
      if (pwd.length < 6) return res.status(400).json({ error: 'Senha deve ter no mínimo 6 caracteres' })
      updates.push('senha = ?')
      params.push(bcrypt.hashSync(pwd, 10))
    }

    const doUpdate = () => {
      if (!updates.length) return res.json({ success: true })
      params.push(id)
      db.run(`UPDATE usuarios SET ${updates.join(', ')} WHERE id = ?`, params, (e2) => {
        if (e2) return res.status(500).json({ error: e2.message })
        logAudit(req, 'usuarios.update', { entityType: 'usuario', entityId: id, details: { role: finalRole || undefined, ativo: ativo !== undefined ? Boolean(ativo) : undefined, email: finalEmail || undefined } })
        res.json({ success: true })
      })
    }

    if (finalEmail && finalEmail !== current.email) {
      db.get('SELECT id FROM usuarios WHERE email = ? AND id != ?', [finalEmail, id], (e3, exists) => {
        if (e3) return res.status(500).json({ error: e3.message })
        if (exists) return res.status(400).json({ error: 'Email já registrado' })
        updates.push('email = ?')
        params.push(finalEmail)
        doUpdate()
      })
    } else {
      doUpdate()
    }
  })
})

module.exports = router
