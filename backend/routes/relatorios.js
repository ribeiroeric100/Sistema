const express = require('express')
const { v4: uuidv4 } = require('uuid')
const { db } = require('../config/database')
const { verifyToken, verifyRole } = require('../middleware/auth')
const PDFDocument = require('pdfkit')
const ExcelJS = require('exceljs')
const fs = require('fs')
const path = require('path')
const { logAudit } = require('../services/audit')
const router = express.Router()

function drawPdfBrandHeader(doc) {
  const left = doc.page.margins.left || 50
  const top = doc.page.margins.top || 50
  const imgPath = path.resolve(__dirname, '..', '..', 'frontend', 'src', 'assets', 'dente.png')
  try {
    if (fs.existsSync(imgPath)) {
      doc.image(imgPath, left, top, { width: 26, height: 26 })
    }
  } catch {
    // ignore missing image
  }

  doc.fillColor('#111827')
  doc.font('Helvetica-Bold').fontSize(18).text('DR. NETO ABREU', left + 34, top + 4, { align: 'left' })
  doc.moveDown(1.25)
}

// Dashboard summary (estatísticas rápidas)
router.get('/dashboard', verifyToken, (req, res) => {
  const hoje = new Date().toISOString().split('T')[0]
  const daqui7 = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  const toPromise = (fn) => new Promise((resolve, reject) => fn((err, row) => err ? reject(err) : resolve(row)))

  try {
    const totalPacientes = toPromise(cb => db.get('SELECT COUNT(*) as total FROM pacientes WHERE ativo IS TRUE', cb))
    const consultasHoje = toPromise(cb => db.get('SELECT COUNT(*) as total FROM consultas WHERE DATE(data_hora) = ?', [hoje], cb))
    const proximas7 = toPromise(cb => db.get('SELECT COUNT(*) as total FROM consultas WHERE DATE(data_hora) >= ? AND DATE(data_hora) <= ?', [hoje, daqui7], cb))
    const receitaHoje = toPromise(cb => db.get('SELECT COALESCE(SUM(valor),0) as total FROM consultas WHERE pago IS TRUE AND DATE(data_hora) = ?', [hoje], cb))
    const produtosBaixos = toPromise(cb => db.all('SELECT id, nome, quantidade, quantidade_minima FROM produtos_estoque WHERE ativo IS TRUE AND quantidade <= quantidade_minima', [], cb))
    const recentPacientes = toPromise(cb => db.all('SELECT id, nome, criado_em FROM pacientes WHERE ativo IS TRUE ORDER BY criado_em DESC LIMIT 5', [], cb))
    const recentProdutos = toPromise(cb => db.all('SELECT id, nome, quantidade, quantidade_minima, criado_em FROM produtos_estoque WHERE ativo IS TRUE ORDER BY criado_em DESC LIMIT 6', [], cb))
    const nextConsultas = toPromise(cb => db.all(`SELECT c.id, c.data_hora, c.tipo_consulta, c.descricao, c.procedimentos, c.status, p.nome as paciente_nome, u.nome as dentista_nome 
      FROM consultas c 
      JOIN pacientes p ON c.paciente_id = p.id 
      LEFT JOIN usuarios u ON c.dentista_id = u.id 
      WHERE DATE(c.data_hora) >= ? AND c.status NOT IN ('cancelada','falta') 
      ORDER BY c.data_hora ASC LIMIT 5`, [hoje], cb))

    Promise.all([totalPacientes, consultasHoje, proximas7, receitaHoje, produtosBaixos, recentPacientes, nextConsultas, recentProdutos])
      .then(([tp, ch, p7, rh, pb, rp, nc, rprod]) => {
        logAudit(req, 'relatorios.dashboard')
        res.json({
          total_pacientes: tp.total || 0,
          consultas_hoje: ch.total || 0,
          proximas_7dias: p7.total || 0,
          receita_hoje: rh.total || 0,
          produtos_baixo_estoque: pb || [],
          recent_pacientes: rp || [],
          next_consultas: nc || [],
          produtos_recentes: rprod || []
        })
      })
      .catch(err => res.status(500).json({ error: err.message }))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Relatório de Estoque
router.get('/estoque', verifyToken, verifyRole(['admin', 'dentista']), (req, res) => {
  db.all(
    `SELECT p.*, 
            (SELECT SUM(quantidade) FROM movimentacoes_estoque WHERE produto_id = p.id AND tipo = 'entrada') as total_entrada,
            (SELECT SUM(quantidade) FROM movimentacoes_estoque WHERE produto_id = p.id AND tipo = 'saida') as total_saida
     FROM produtos_estoque p
     WHERE p.ativo IS TRUE`,
    (err, produtos) => {
      if (err) return res.status(500).json({ error: err.message })

      const relatorio = {
        tipo: 'Relatório de Estoque',
        data_geracao: new Date(),
        total_produtos: produtos.length,
        valor_total_estoque: produtos.reduce((sum, p) => sum + (p.quantidade * p.preco_unitario), 0),
        produtos: produtos
      }

      logAudit(req, 'relatorios.estoque')
      res.json(relatorio)
    }
  )
})

// Relatório de Receita (por período)
router.get('/receita', verifyToken, verifyRole(['admin', 'dentista']), (req, res) => {
  const { data_inicio, data_fim } = req.query

  db.all(
    `SELECT c.*, p.nome as paciente_nome
     FROM consultas c
     JOIN pacientes p ON c.paciente_id = p.id
    WHERE c.pago IS TRUE 
     AND DATE(c.data_hora) >= ? 
     AND DATE(c.data_hora) <= ?
     ORDER BY c.data_hora DESC`,
    [data_inicio || '2024-01-01', data_fim || new Date().toISOString().split('T')[0]],
    (err, consultas) => {
      if (err) return res.status(500).json({ error: err.message })

      const total_receita = consultas.reduce((sum, c) => sum + (c.valor || 0), 0)
      const relatorio = {
        tipo: 'Relatório de Receita',
        periodo: `${data_inicio} a ${data_fim}`,
        total_receita,
        total_consultas: consultas.length,
        consultas
      }

      logAudit(req, 'relatorios.receita', { details: { data_inicio, data_fim } })
      res.json(relatorio)
    }
  )
})

// Receitas diárias persistidas
router.get('/daily-receitas', verifyToken, (req, res) => {
  db.all('SELECT dia, total FROM daily_receitas ORDER BY dia DESC LIMIT 60', (err, rows) => {
    if (err) return res.status(500).json({ error: err.message })
    logAudit(req, 'relatorios.daily_receitas')
    res.json(rows)
  })
})

// Relatório de Agendamentos
router.get('/agendamentos', verifyToken, (req, res) => {
  db.all(
    `SELECT c.*, p.nome as paciente_nome, u.nome as dentista_nome 
     FROM consultas c
     JOIN pacientes p ON c.paciente_id = p.id
     LEFT JOIN usuarios u ON c.dentista_id = u.id
     ORDER BY c.data_hora DESC`,
    (err, consultas) => {
      if (err) return res.status(500).json({ error: err.message })

      const relatorio = {
        tipo: 'Relatório de Agendamentos',
        total: consultas.length,
        por_status: {
          agendada: consultas.filter(c => c.status === 'agendada').length,
          realizada: consultas.filter(c => c.status === 'realizada').length,
          cancelada: consultas.filter(c => c.status === 'cancelada').length,
          falta: consultas.filter(c => c.status === 'falta').length
        },
        consultas
      }

      logAudit(req, 'relatorios.agendamentos')
      res.json(relatorio)
    }
  )
})

// Exportar relatório em PDF
router.post('/exportar-pdf', verifyToken, verifyRole(['admin', 'dentista']), (req, res) => {
  const { tipo, dados } = req.body

  try {
    const doc = new PDFDocument()
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="relatorio-${tipo}-${new Date().getTime()}.pdf"`)

    doc.pipe(res)

    doc.on('pageAdded', () => drawPdfBrandHeader(doc))
    drawPdfBrandHeader(doc)

    doc.font('Helvetica-Bold').fontSize(16).text(`Relatório de ${tipo}`, { align: 'left' })
    doc.font('Helvetica').fontSize(12).text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`)
    doc.moveDown(0.75)

    if (dados) {
      Object.entries(dados).forEach(([key, value]) => {
        doc.text(`${key}: ${JSON.stringify(value)}`)
      })
    }

    logAudit(req, 'relatorios.exportar_pdf', { details: { tipo } })

    doc.end()
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Exportar relatório em Excel
router.post('/exportar-excel', verifyToken, verifyRole(['admin', 'dentista']), async (req, res) => {
  const { tipo, dados } = req.body

  try {
    const workbook = new ExcelJS.Workbook()
    const worksheet = workbook.addWorksheet(tipo)

    worksheet.columns = [
      { header: 'Campo', key: 'campo', width: 20 },
      { header: 'Valor', key: 'valor', width: 30 }
    ]

    if (dados && Array.isArray(dados)) {
      dados.forEach((item, index) => {
        Object.entries(item).forEach(([key, value]) => {
          worksheet.addRow({ campo: `${key} (${index + 1})`, valor: value })
        })
      })
    }

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', `attachment; filename="relatorio-${tipo}-${new Date().getTime()}.xlsx"`)

    await workbook.xlsx.write(res)
    res.end()
    logAudit(req, 'relatorios.exportar_excel', { details: { tipo } })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
