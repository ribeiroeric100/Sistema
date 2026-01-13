const express = require('express')
const { v4: uuidv4 } = require('uuid')
const { db } = require('../config/database')
const { verifyToken, verifyRole } = require('../middleware/auth')
const { logAudit } = require('../services/audit')
const PDFDocument = require('pdfkit')
const router = express.Router()

// Listar pacientes
router.get('/', verifyToken, (req, res) => {
  db.all('SELECT * FROM pacientes WHERE ativo = 1 ORDER BY nome', (err, pacientes) => {
    if (err) return res.status(500).json({ error: err.message })
    logAudit(req, 'pacientes.list')
    res.json(pacientes)
  })
})

// Buscar paciente por ID
router.get('/:id', verifyToken, (req, res) => {
  db.get('SELECT * FROM pacientes WHERE id = ?', [req.params.id], (err, paciente) => {
    if (err) return res.status(500).json({ error: err.message })
    if (!paciente) return res.status(404).json({ error: 'Paciente não encontrado' })
    logAudit(req, 'pacientes.get', { entityType: 'paciente', entityId: req.params.id })
    res.json(paciente)
  })
})

// Buscar odontograma (estado atual) por paciente
router.get('/:id/odontograma', verifyToken, (req, res) => {
  db.get(
    'SELECT estado_json, atualizado_em FROM odontogramas WHERE paciente_id = ?',
    [req.params.id],
    (err, row) => {
      if (err) return res.status(500).json({ error: err.message })
      if (!row) return res.json({ estado: {}, atualizado_em: null })

      let estado = {}
      try {
        estado = JSON.parse(row.estado_json || '{}') || {}
      } catch (e) {
        estado = {}
      }

      res.json({ estado, atualizado_em: row.atualizado_em || null })
    }
  )
})

// Salvar odontograma (estado atual) por paciente
router.put('/:id/odontograma', verifyToken, verifyRole(['admin', 'dentista']), (req, res) => {
  const estado = req.body?.estado

  if (!estado || typeof estado !== 'object' || Array.isArray(estado)) {
    return res.status(400).json({ error: 'Campo "estado" inválido' })
  }

  const estadoJson = JSON.stringify(estado)

  db.get(
    'SELECT paciente_id FROM odontogramas WHERE paciente_id = ?',
    [req.params.id],
    (err, row) => {
      if (err) return res.status(500).json({ error: err.message })

      if (row) {
        db.run(
          'UPDATE odontogramas SET estado_json = ?, atualizado_em = CURRENT_TIMESTAMP WHERE paciente_id = ?',
          [estadoJson, req.params.id],
          function (e2) {
            if (e2) return res.status(500).json({ error: e2.message })
            logAudit(req, 'odontograma.update', { entityType: 'paciente', entityId: req.params.id })
            return res.json({ success: true })
          }
        )
      } else {
        db.run(
          'INSERT INTO odontogramas (paciente_id, estado_json) VALUES (?, ?)',
          [req.params.id, estadoJson],
          function (e2) {
            if (e2) return res.status(500).json({ error: e2.message })
            logAudit(req, 'odontograma.create', { entityType: 'paciente', entityId: req.params.id })
            return res.json({ success: true })
          }
        )
      }
    }
  )
})

// Criar paciente
router.post('/', verifyToken, verifyRole(['admin', 'dentista', 'recepcao']), (req, res) => {
  const { nome, email, telefone, cpf, data_nascimento, endereco, numero, complemento, bairro, cidade, cep, observacoes } = req.body
  const id = uuidv4()

  if (!nome || !telefone) {
    return res.status(400).json({ error: 'Nome e telefone obrigatórios' })
  }

  db.run(
    `INSERT INTO pacientes (id, nome, email, telefone, cpf, data_nascimento, endereco, numero, complemento, bairro, cidade, cep, observacoes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, nome, email, telefone, cpf, data_nascimento, endereco, numero, complemento, bairro, cidade, cep, observacoes],
    function(err) {
      if (err) return res.status(500).json({ error: err.message })
      logAudit(req, 'pacientes.create', { entityType: 'paciente', entityId: id })
      res.json({ id, nome, email, telefone })
    }
  )
})

// Atualizar paciente
router.put('/:id', verifyToken, verifyRole(['admin', 'dentista', 'recepcao']), (req, res) => {
  const { nome, email, telefone, cpf, observacoes } = req.body

  db.run(
    'UPDATE pacientes SET nome = ?, email = ?, telefone = ?, cpf = ?, observacoes = ? WHERE id = ?',
    [nome, email, telefone, cpf, observacoes, req.params.id],
    function(err) {
      if (err) return res.status(500).json({ error: err.message })
      logAudit(req, 'pacientes.update', { entityType: 'paciente', entityId: req.params.id })
      res.json({ success: true })
    }
  )
})

// Deletar paciente
router.delete('/:id', verifyToken, verifyRole(['admin']), (req, res) => {
  db.run(
    'DELETE FROM pacientes WHERE id = ?',
    [req.params.id],
    function(err) {
      if (err) return res.status(500).json({ error: err.message })
      logAudit(req, 'pacientes.delete', { entityType: 'paciente', entityId: req.params.id })
      res.json({ success: true })
    }
  )
})

// Exportar prontuário completo em PDF (backend)
router.get('/:id/prontuario/pdf', verifyToken, verifyRole(['admin', 'dentista']), (req, res) => {
  const pacienteId = req.params.id

  const getConfig = () => new Promise((resolve) => {
    db.all(
      `SELECT chave, valor FROM configuracoes WHERE chave IN ('nome_clinica', 'endereco_clinica', 'telefone_clinica', 'email_clinica')`,
      (err, rows) => {
        if (err) return resolve({})
        const cfg = {}
        for (const r of rows || []) cfg[r.chave] = r.valor
        resolve(cfg)
      }
    )
  })

  const getPaciente = () => new Promise((resolve, reject) => {
    db.get('SELECT * FROM pacientes WHERE id = ?', [pacienteId], (err, row) => {
      if (err) return reject(err)
      if (!row) return resolve(null)
      resolve(row)
    })
  })

  const getConsultas = () => new Promise((resolve, reject) => {
    db.all(
      `SELECT c.*, u.nome as dentista_nome
       FROM consultas c
       LEFT JOIN usuarios u ON c.dentista_id = u.id
       WHERE c.paciente_id = ?
       ORDER BY c.data_hora DESC`,
      [pacienteId],
      (err, rows) => {
        if (err) return reject(err)
        resolve(rows || [])
      }
    )
  })

  const getOdontograma = () => new Promise((resolve) => {
    db.get('SELECT estado_json, atualizado_em FROM odontogramas WHERE paciente_id = ?', [pacienteId], (err, row) => {
      if (err || !row) return resolve({ estado: null, atualizado_em: null })
      let estado = null
      try { estado = JSON.parse(row.estado_json || 'null') } catch (e) { estado = null }
      resolve({ estado, atualizado_em: row.atualizado_em || null })
    })
  })

  Promise.all([getConfig(), getPaciente(), getConsultas(), getOdontograma()])
    .then(([cfg, paciente, consultas, od]) => {
      if (!paciente) return res.status(404).json({ error: 'Paciente não encontrado' })

      const clinicName = String(cfg.nome_clinica || 'DR. NETO ABREU')

      const doc = new PDFDocument({ size: 'A4', margin: 50 })
      res.setHeader('Content-Type', 'application/pdf')
      res.setHeader('Content-Disposition', `attachment; filename="prontuario-${paciente.nome}-${Date.now()}.pdf"`)

      doc.pipe(res)

      // Cabeçalho
      doc.fontSize(18).text(clinicName, { align: 'left' })
      doc.fontSize(10).fillColor('#444')
      const contactLine = [cfg.endereco_clinica, cfg.telefone_clinica, cfg.email_clinica].filter(Boolean).join(' • ')
      if (contactLine) doc.text(contactLine)
      doc.moveDown(0.5)
      doc.fillColor('#000')
      doc.fontSize(16).text('Prontuário do Paciente', { align: 'left' })
      doc.moveDown(0.75)

      // Dados do paciente
      doc.fontSize(12).text('Dados do paciente', { underline: true })
      doc.moveDown(0.25)
      doc.fontSize(10)
      doc.text(`Nome: ${paciente.nome}`)
      if (paciente.cpf) doc.text(`CPF: ${paciente.cpf}`)
      if (paciente.data_nascimento) doc.text(`Data de nascimento: ${paciente.data_nascimento}`)
      if (paciente.telefone) doc.text(`Telefone: ${paciente.telefone}`)
      if (paciente.email) doc.text(`Email: ${paciente.email}`)
      if (paciente.endereco || paciente.numero || paciente.bairro || paciente.cidade || paciente.cep) {
        const end = [paciente.endereco, paciente.numero, paciente.complemento, paciente.bairro, paciente.cidade, paciente.cep].filter(Boolean).join(', ')
        if (end) doc.text(`Endereço: ${end}`)
      }
      if (paciente.observacoes) {
        doc.moveDown(0.25)
        doc.text(`Observações: ${paciente.observacoes}`)
      }
      doc.moveDown(0.75)

      // Histórico
      doc.fontSize(12).text('Histórico de consultas', { underline: true })
      doc.moveDown(0.25)
      doc.fontSize(10)

      if (!consultas.length) {
        doc.text('Nenhuma consulta registrada.')
      } else {
        consultas.forEach((c, idx) => {
          const dateStr = (() => {
            try { return new Date(c.data_hora).toLocaleString('pt-BR') } catch (e) { return String(c.data_hora || '') }
          })()

          doc.font('Helvetica-Bold').text(`${idx + 1}. ${dateStr} — ${c.tipo_consulta || 'Consulta'}`)
          doc.font('Helvetica').text(`Status: ${c.status || 'agendada'} • Pago: ${c.pago ? 'Sim' : 'Não'} • Valor: R$ ${(Number(c.valor || 0)).toFixed(2)}`)
          if (c.dentista_nome) doc.text(`Profissional: ${c.dentista_nome}`)
          if (c.descricao) doc.text(`Observações clínicas: ${c.descricao}`)

          // Procedimentos
          let procs = null
          if (c.procedimentos) {
            try { procs = JSON.parse(c.procedimentos) } catch (e) { procs = c.procedimentos }
          }
          if (Array.isArray(procs) && procs.length) {
            const procText = procs.map(p => (p && typeof p === 'object') ? (p.descricao || p.nome || JSON.stringify(p)) : String(p)).join('; ')
            doc.text(`Procedimentos: ${procText}`)
          }

          // Materiais
          let mats = null
          if (c.materiais) {
            try { mats = JSON.parse(c.materiais) } catch (e) { mats = c.materiais }
          }
          if (Array.isArray(mats) && mats.length) {
            const matText = mats.map(m => {
              if (m && typeof m === 'object') {
                const nome = m.nome || m.produto_nome || m.produto_id || m.id
                const qtd = m.quantidade || 0
                return `${nome} (${qtd})`
              }
              return String(m)
            }).join('; ')
            doc.text(`Materiais: ${matText}`)
          }

          doc.moveDown(0.5)
        })
      }

      doc.addPage()

      // Odontograma
      doc.fontSize(12).text('Odontograma', { underline: true })
      doc.moveDown(0.25)
      doc.fontSize(10)
      if (!od.estado) {
        doc.text('Nenhum odontograma registrado.')
      } else {
        doc.text('Estado do odontograma (resumo):')
        const entries = Object.entries(od.estado || {}).slice(0, 120)
        if (!entries.length) {
          doc.text('— (vazio)')
        } else {
          entries.forEach(([k, v]) => {
            const val = (v && typeof v === 'object') ? JSON.stringify(v) : String(v)
            doc.text(`${k}: ${val}`)
          })
          if (Object.keys(od.estado || {}).length > entries.length) {
            doc.text('... (resumo truncado)')
          }
        }
        if (od.atualizado_em) doc.text(`Atualizado em: ${od.atualizado_em}`)
      }

      doc.moveDown(1)
      doc.fontSize(10).fillColor('#444')
      doc.text(`Emitido em: ${new Date().toLocaleString('pt-BR')}`)
      doc.text(`Responsável: ${req.user?.nome || ''} (${req.user?.role || ''})`)
      doc.fillColor('#000')

      logAudit(req, 'pacientes.export_prontuario_pdf', { entityType: 'paciente', entityId: pacienteId })
      doc.end()
    })
    .catch((e) => res.status(500).json({ error: e.message }))
})

module.exports = router
