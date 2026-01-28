const express = require('express')
const { v4: uuidv4 } = require('uuid')
const { z } = require('zod')
const { db } = require('../config/database')
const { verifyToken, verifyRole } = require('../middleware/auth')
const { logAudit } = require('../services/audit')
const { validateBody } = require('../middleware/validate')
const router = express.Router()

const createConsultaSchema = z.object({
  paciente_id: z.string().trim().min(1, 'paciente_id é obrigatório'),
  dentista_id: z.string().trim().optional().nullable(),
  data_hora: z.string().trim().min(1, 'data_hora é obrigatório'),
  tipo_consulta: z.string().trim().optional(),
  descricao: z.any().optional(),
  observacoes: z.any().optional(),
  valor: z.any().optional(),
  procedimentos: z.any().optional(),
  materiais: z.any().optional()
})

const updateStatusSchema = z.object({
  status: z.enum(['agendada', 'realizada', 'cancelada', 'falta']),
  pago: z.any().optional(),
  nao_finalizada_motivo: z.string().trim().max(200).optional().nullable(),
  nao_finalizada_observacao: z.string().trim().max(1000).optional().nullable()
})

const normalizeDateTime = (v) => {
  const s = String(v || '').trim()
  // expecting "YYYY-MM-DD HH:MM"
  return s
}

const checkScheduleConflict = ({ consultaIdToIgnore = null, dataHora, dentistaId }, cb) => {
  const dt = normalizeDateTime(dataHora)
  if (!dt) return cb(null, false)

  const params = [dt, 'cancelada', 'falta']
  let sql = 'SELECT id FROM consultas WHERE data_hora = ? AND status NOT IN (?, ?)'

  if (dentistaId) {
    sql += ' AND dentista_id = ?'
    params.push(dentistaId)
  } else {
    // compatibilidade com agenda sem dentista: bloqueia apenas conflitos sem dentista definido
    sql += ' AND dentista_id IS NULL'
  }

  if (consultaIdToIgnore) {
    sql += ' AND id != ?'
    params.push(consultaIdToIgnore)
  }

  sql += ' LIMIT 1'
  db.get(sql, params, (err, row) => {
    if (err) return cb(err)
    return cb(null, !!row)
  })
}

const ymd = (d) => {
  try {
    const dt = d instanceof Date ? d : new Date(d)
    if (Number.isNaN(dt.getTime())) return ''
    return dt.toISOString().slice(0, 10)
  } catch {
    return ''
  }
}

const monthStartYmd = () => {
  const now = new Date()
  return ymd(new Date(now.getFullYear(), now.getMonth(), 1))
}

// Métricas de consultas não finalizadas (canceladas ou faltas)
router.get('/metricas/nao-finalizadas', verifyToken, verifyRole(['admin', 'dentista', 'recepcao']), (req, res) => {
  const data_inicio = String(req.query.data_inicio || '').trim() || monthStartYmd()
  const data_fim = String(req.query.data_fim || '').trim() || ymd(new Date())
  const dentista_id = String(req.query.dentista_id || '').trim() || null

  const paramsBase = [data_inicio, data_fim]
  const dentistaFilter = dentista_id ? ' AND c.dentista_id = ?' : ''
  const paramsDentista = dentista_id ? [...paramsBase, dentista_id] : paramsBase

  const toAll = (sql, params) => new Promise((resolve, reject) => db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows)))
  const toGet = (sql, params) => new Promise((resolve, reject) => db.get(sql, params, (err, row) => err ? reject(err) : resolve(row)))

  Promise.all([
    // Totais gerais do período
    toAll(
      `SELECT COALESCE(status,'agendada') as status, COUNT(*) as total
       FROM consultas c
       WHERE DATE(c.data_hora) >= ? AND DATE(c.data_hora) <= ?${dentistaFilter}
       GROUP BY COALESCE(status,'agendada')`,
      paramsDentista
    ),
    // Motivos (somente não finalizadas)
    toAll(
      `SELECT COALESCE(c.nao_finalizada_motivo,'(sem motivo)') as motivo, COUNT(*) as total
       FROM consultas c
       WHERE DATE(c.data_hora) >= ? AND DATE(c.data_hora) <= ?
         AND c.status IN ('cancelada','falta')${dentistaFilter}
       GROUP BY COALESCE(c.nao_finalizada_motivo,'(sem motivo)')
       ORDER BY total DESC`,
      paramsDentista
    ),
    // Série diária (cancelada/falta)
    toAll(
      `SELECT DATE(c.data_hora) as dia, c.status, COUNT(*) as total
       FROM consultas c
       WHERE DATE(c.data_hora) >= ? AND DATE(c.data_hora) <= ?
         AND c.status IN ('cancelada','falta')${dentistaFilter}
       GROUP BY DATE(c.data_hora), c.status
       ORDER BY dia ASC`,
      paramsDentista
    ),
    // Por dentista (se não filtrar por um dentista específico)
    dentista_id
      ? Promise.resolve([])
      : toAll(
          `SELECT c.dentista_id, COALESCE(u.nome,'(Sem dentista)') as dentista_nome,
                  SUM(CASE WHEN c.status = 'cancelada' THEN 1 ELSE 0 END) as canceladas,
                  SUM(CASE WHEN c.status = 'falta' THEN 1 ELSE 0 END) as faltas,
                  COUNT(*) as total
           FROM consultas c
           LEFT JOIN usuarios u ON c.dentista_id = u.id
           WHERE DATE(c.data_hora) >= ? AND DATE(c.data_hora) <= ?
             AND c.status IN ('cancelada','falta')
           GROUP BY c.dentista_id
           ORDER BY total DESC`,
          paramsBase
        ),
    // Total do período (todas as consultas)
    toGet(
      `SELECT COUNT(*) as total
       FROM consultas c
       WHERE DATE(c.data_hora) >= ? AND DATE(c.data_hora) <= ?${dentistaFilter}`,
      paramsDentista
    )
  ])
    .then(([rowsByStatus, motivos, serie, porDentista, totalRow]) => {
      const totals = {
        total: Number(totalRow?.total || 0),
        realizadas: 0,
        agendadas: 0,
        canceladas: 0,
        faltas: 0
      }

      ;(rowsByStatus || []).forEach(r => {
        const st = String(r.status || '').toLowerCase()
        const n = Number(r.total || 0)
        if (st === 'realizada') totals.realizadas += n
        else if (st === 'cancelada') totals.canceladas += n
        else if (st === 'falta') totals.faltas += n
        else totals.agendadas += n
      })

      const timelineMap = new Map()
      ;(serie || []).forEach(r => {
        const dia = String(r.dia || '')
        if (!dia) return
        const entry = timelineMap.get(dia) || { dia, canceladas: 0, faltas: 0 }
        const st = String(r.status || '').toLowerCase()
        const n = Number(r.total || 0)
        if (st === 'cancelada') entry.canceladas += n
        if (st === 'falta') entry.faltas += n
        timelineMap.set(dia, entry)
      })

      logAudit(req, 'consultas.metricas.nao_finalizadas', { details: { data_inicio, data_fim, dentista_id } })
      res.json({
        periodo: { data_inicio, data_fim, dentista_id },
        totals,
        by_motivo: motivos || [],
        timeline: Array.from(timelineMap.values()),
        by_dentista: porDentista || [],
        taxas: {
          cancelamento: totals.total ? totals.canceladas / totals.total : 0,
          falta: totals.total ? totals.faltas / totals.total : 0,
          nao_finalizadas: totals.total ? (totals.canceladas + totals.faltas) / totals.total : 0
        }
      })
    })
    .catch(err => res.status(500).json({ error: err.message }))
})

// Listar consultas
router.get('/', verifyToken, (req, res) => {
  db.all(
    `SELECT c.*, p.nome as paciente_nome, u.nome as dentista_nome 
     FROM consultas c
     JOIN pacientes p ON c.paciente_id = p.id
     LEFT JOIN usuarios u ON c.dentista_id = u.id
     ORDER BY c.data_hora DESC`,
    (err, consultas) => {
      if (err) return res.status(500).json({ error: err.message })
      res.json(consultas)
    }
  )
})

// Consultas de um paciente
router.get('/paciente/:paciente_id', verifyToken, (req, res) => {
  db.all(
    `SELECT c.*, p.nome as paciente_nome, u.nome as dentista_nome 
     FROM consultas c
     JOIN pacientes p ON c.paciente_id = p.id
     LEFT JOIN usuarios u ON c.dentista_id = u.id
     WHERE c.paciente_id = ?
     ORDER BY c.data_hora DESC`,
    [req.params.paciente_id],
    (err, consultas) => {
      if (err) return res.status(500).json({ error: err.message })
      res.json(consultas)
    }
  )
})

// Agendar consulta
router.post('/', verifyToken, verifyRole(['admin', 'dentista', 'recepcao']), validateBody(createConsultaSchema), (req, res) => {
  // Accept both `descricao` and `observacoes` from frontend (some clients use observacoes)
  let { paciente_id, dentista_id, data_hora, tipo_consulta, descricao, observacoes, valor, procedimentos, materiais } = req.body
  const id = uuidv4()

  // prefer descricao, fall back to observacoes
  descricao = descricao || observacoes || null

  // normalize valor: accept strings like "R$ 10,00" or numeric
  let valorNormalized = null
  if (valor !== undefined && valor !== null && String(valor).trim() !== '') {
    try {
      // remove currency symbols and spaces, convert comma to dot
      const cleaned = String(valor).replace(/[^0-9,.-]/g, '').replace(',', '.')
      valorNormalized = Number(cleaned)
      if (Number.isNaN(valorNormalized)) valorNormalized = null
    } catch (e) {
      valorNormalized = null
    }
  }

  // Ensure procedimentos/materiais are stored as JSON strings
  const procedimentosJSON = procedimentos ? (typeof procedimentos === 'string' ? procedimentos : JSON.stringify(procedimentos)) : null
  const materiaisJSON = materiais ? (typeof materiais === 'string' ? materiais : JSON.stringify(materiais)) : null

  const dt = normalizeDateTime(data_hora)
  checkScheduleConflict({ dataHora: dt, dentistaId: dentista_id || null }, (confErr, hasConflict) => {
    if (confErr) return res.status(500).json({ error: confErr.message })
    if (hasConflict) {
      return res.status(409).json({ error: 'Conflito de horário: já existe uma consulta agendada neste horário.' })
    }

    db.run(
      `INSERT INTO consultas (id, paciente_id, dentista_id, data_hora, tipo_consulta, descricao, valor, procedimentos, materiais)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, paciente_id, dentista_id || null, dt, tipo_consulta || 'geral', descricao, valorNormalized, procedimentosJSON, materiaisJSON],
      function(err) {
        if (err) return res.status(500).json({ error: err.message })
        logAudit(req, 'consultas.create', { entityType: 'consulta', entityId: id, details: { paciente_id, dentista_id: dentista_id || null, data_hora: dt, tipo_consulta: tipo_consulta || 'geral' } })
        // After creating, attempt to send confirmation/reminder via WhatsApp if configured
        (async () => {
          try {
            const cfgRows = await new Promise((resolve, reject) => db.all('SELECT chave, valor FROM configuracoes', (e, r) => e ? reject(e) : resolve(r)))
            const cfg = {}
            for (const r of cfgRows || []) cfg[r.chave] = r.valor

            const sendConfirmacao = String(cfg.whatsapp_confirmacao_agendamento_ativo || 'false') === 'true'
            const mensagemTpl = cfg.mensagem_confirmacao_consulta || 'Olá {{paciente}}! Sua consulta com {{dentista}} foi agendada para {{data}} às {{hora}}.'

            if (sendConfirmacao) {
              // fetch paciente telefone and nome
              const paciente = await new Promise((resolve, reject) => db.get('SELECT nome, telefone FROM pacientes WHERE id = ?', [paciente_id], (e, r) => e ? reject(e) : resolve(r)))
              const dentista = dentista_id ? await new Promise((resolve, reject) => db.get('SELECT nome FROM usuarios WHERE id = ?', [dentista_id], (e, r) => e ? reject(e) : resolve(r))) : null

              const pacienteNome = paciente?.nome || ''
              const dentistaNome = dentista?.nome || ''
              const hora = (new Date(dt)).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
              const data = (new Date(dt)).toLocaleDateString('pt-BR')

              const message = String(mensagemTpl)
                .replace(/{{\s*paciente\s*}}/gi, pacienteNome)
                .replace(/{{\s*dentista\s*}}/gi, dentistaNome)
                .replace(/{{\s*hora\s*}}/gi, hora)
                .replace(/{{\s*data\s*}}/gi, data)

              try {
                const smsSvc = require('../services/sms.example')
                if (paciente?.telefone) {
                  await smsSvc.enviarWhatsAppMessage(paciente.telefone, message)
                  logAudit(req, 'consultas.send_whatsapp', { entityType: 'consulta', entityId: id, details: { paciente_id, telefone: paciente.telefone } })
                }
              } catch (e) {
                console.error('Erro ao enviar WhatsApp na criação da consulta:', e)
              }
            }
          } catch (e) {
            console.error('Erro ao processar envio após criar consulta:', e)
          }
        })()

        res.json({ id, paciente_id, data_hora: dt, status: 'agendada' })
      }
    )
  })
})

// Atualizar status da consulta
router.put('/:id/status', verifyToken, verifyRole(['admin', 'dentista', 'recepcao']), validateBody(updateStatusSchema), (req, res) => {
  const { status, pago, nao_finalizada_motivo, nao_finalizada_observacao } = req.body

  const id = req.params.id

  // get previous estado to detect pago change and previous status
  db.get('SELECT pago, valor, DATE(data_hora) as dia, status, materiais FROM consultas WHERE id = ?', [id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message })

    const previousPago = row ? (row.pago ? 1 : 0) : 0
    const valorConsulta = row ? (row.valor || 0) : 0
    const dia = row ? row.dia : new Date().toISOString().split('T')[0]
    const previousStatus = row ? row.status : null
    const materiaisJSON = row ? row.materiais : null

    const statusNormalized = String(status || '').toLowerCase()
    const isNaoFinalizada = statusNormalized === 'cancelada' || statusNormalized === 'falta'

    const newPago = isNaoFinalizada ? 0 : (pago ? 1 : 0)
    const markAt = isNaoFinalizada ? new Date().toISOString().replace('T', ' ').slice(0, 19) : null
    const motivo = isNaoFinalizada ? (String(nao_finalizada_motivo || '').trim() || null) : null
    const obs = isNaoFinalizada ? (String(nao_finalizada_observacao || '').trim() || null) : null
    const markedBy = isNaoFinalizada ? (req.user?.id || null) : null

    db.run(
      `UPDATE consultas
       SET status = ?,
           pago = ?,
           nao_finalizada_tipo = ?,
           nao_finalizada_motivo = ?,
           nao_finalizada_observacao = ?,
           nao_finalizada_em = ?,
           nao_finalizada_por = ?
       WHERE id = ?`,
      [statusNormalized, newPago, isNaoFinalizada ? statusNormalized : null, motivo, obs, markAt, markedBy, id],
      function(err) {
        if (err) return res.status(500).json({ error: err.message })

        // If pago changed from 0 -> 1, add to daily_receitas; if 1 -> 0, subtract
        if (previousPago !== newPago) {
          if (newPago === 1) {
            // add valor to daily_receitas for the day of the consulta
            db.run(
              `INSERT INTO daily_receitas (dia, total) VALUES (?, ?) 
               ON CONFLICT(dia) DO UPDATE SET total = total + excluded.total`,
              [dia, valorConsulta],
              (err2) => {
                if (err2) console.error('Erro ao atualizar daily_receitas (add):', err2)
              }
            )
          } else {
            // subtract the value (if unmarked)
            db.run(
              `UPDATE daily_receitas SET total = total - ? WHERE dia = ?`,
              [valorConsulta, dia],
              (err2) => {
                if (err2) console.error('Erro ao atualizar daily_receitas (sub):', err2)
              }
            )
          }
        }

        // If status changed to 'realizada' and it wasn't 'realizada' before, decrement estoque based on materiais
        if (statusNormalized === 'realizada' && previousStatus !== 'realizada' && materiaisJSON) {
          let materiais
          try { materiais = JSON.parse(materiaisJSON) } catch (e) { materiais = materiaisJSON }

          if (Array.isArray(materiais) && materiais.length) {
            materiais.forEach(m => {
              const produtoId = m.produto_id || m.id || m.produto_id
              const qtd = Number(m.quantidade || 0)
              if (!produtoId || !qtd) return

              // decrement product quantity
              db.run('UPDATE produtos_estoque SET quantidade = quantidade - ? WHERE id = ?', [qtd, produtoId], function(err2) {
                if (err2) console.error('Erro ao decrementar estoque:', err2)
              })

              // record movimentacao
              const movId = uuidv4()
              db.run('INSERT INTO movimentacoes_estoque (id, produto_id, tipo, quantidade, motivo, usuario_id) VALUES (?, ?, ?, ?, ?, ?)',
                [movId, produtoId, 'saida', qtd, `Uso em consulta ${id}`, req.user?.id || null], (err3) => {
                  if (err3) console.error('Erro ao registrar movimentacao:', err3)
                }
              )

              // criar alerta de estoque mínimo se necessário
              db.get('SELECT quantidade, quantidade_minima FROM produtos_estoque WHERE id = ?', [produtoId], (e4, product) => {
                if (e4 || !product) return
                if (Number(product.quantidade) <= Number(product.quantidade_minima)) {
                  const alerta_id = uuidv4()
                  db.run(
                    'INSERT INTO alertas_estoque (id, produto_id, tipo, mensagem) VALUES (?, ?, ?, ?)',
                    [alerta_id, produtoId, 'reposicao', `Produto com estoque baixo: ${product.quantidade} un.`]
                  )
                }
              })
            })
          }
        }

        logAudit(req, 'consultas.update_status', {
          entityType: 'consulta',
          entityId: id,
          details: {
            status: statusNormalized,
            pago: newPago,
            nao_finalizada_motivo: motivo,
            nao_finalizada_observacao: obs
          }
        })

        res.json({ success: true })
      }
    )
  })
})

// Atualizar dados da consulta (data_hora, tipo_consulta, descricao, valor, dentista_id)
router.put('/:id', verifyToken, verifyRole(['admin', 'dentista', 'recepcao']), (req, res) => {
  const id = req.params.id
  const { data_hora, tipo_consulta, descricao, valor, dentista_id } = req.body

  // fetch current row to detect pago and previous day
  db.get('SELECT pago, valor, DATE(data_hora) as dia FROM consultas WHERE id = ?', [id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message })

    const previousPago = row ? (row.pago ? 1 : 0) : 0
    const previousValor = row ? (row.valor || 0) : 0
    const previousDia = row ? row.dia : null

    const updates = []
    const params = []
    if (data_hora !== undefined) { updates.push('data_hora = ?'); params.push(data_hora) }
    if (tipo_consulta !== undefined) { updates.push('tipo_consulta = ?'); params.push(tipo_consulta) }
    if (descricao !== undefined) { updates.push('descricao = ?'); params.push(descricao) }
    if (valor !== undefined) { updates.push('valor = ?'); params.push(valor) }
    if (dentista_id !== undefined) { updates.push('dentista_id = ?'); params.push(dentista_id) }

    if (!updates.length) return res.json({ success: true })

    params.push(id)
    const sql = `UPDATE consultas SET ${updates.join(', ')} WHERE id = ?`

    const dt = data_hora !== undefined ? normalizeDateTime(data_hora) : null

    const runUpdate = () => {
      // replace data_hora param if provided
      const params2 = [...params]
      if (data_hora !== undefined) {
        // data_hora param is at index where it was pushed
        const idx = updates.findIndex(u => u.startsWith('data_hora'))
        if (idx >= 0) params2[idx] = dt
      }

      db.run(sql, params2, function(err2) {
        if (err2) return res.status(500).json({ error: err2.message })

        // if consulta was paid and data_hora changed, move value between daily_receitas days
        if (previousPago === 1 && dt) {
          const newDia = dt.split(' ')[0]
        const val = (valor !== undefined) ? Number(valor) : Number(previousValor)

        // subtract from previous day
        if (previousDia) {
          db.run('UPDATE daily_receitas SET total = total - ? WHERE dia = ?', [val, previousDia], (e) => { if (e) console.error(e) })
        }

        // add to new day (insert or update)
        db.run(
          `INSERT INTO daily_receitas (dia, total) VALUES (?, ?) ON CONFLICT(dia) DO UPDATE SET total = total + excluded.total`,
          [newDia, val],
          (e) => { if (e) console.error(e) }
        )
      }

        logAudit(req, 'consultas.update', { entityType: 'consulta', entityId: id, details: { data_hora: dt || undefined, tipo_consulta, dentista_id, valor } })
        res.json({ success: true })
      })
    }

    if (data_hora !== undefined) {
      checkScheduleConflict({ consultaIdToIgnore: id, dataHora: dt, dentistaId: dentista_id || null }, (confErr, hasConflict) => {
        if (confErr) return res.status(500).json({ error: confErr.message })
        if (hasConflict) {
          return res.status(409).json({ error: 'Conflito de horário: já existe uma consulta agendada neste horário.' })
        }
        return runUpdate()
      })
    } else {
      return runUpdate()
    }
  })
})

// Horários disponíveis
router.get('/disponibilidade/:data', verifyToken, (req, res) => {
  const horariosClinicos = ['08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00']

  db.all(
    'SELECT data_hora FROM consultas WHERE DATE(data_hora) = ? AND status NOT IN (?, ?)',
    [req.params.data, 'cancelada', 'falta'],
    (err, reservas) => {
      if (err) return res.status(500).json({ error: err.message })

      const ocupados = reservas.map(r => r.data_hora.split(' ')[1])
      const disponiveis = horariosClinicos.filter(h => !ocupados.includes(h))

      res.json({ data: req.params.data, horarios_disponiveis: disponiveis })
    }
  )
})

// Deletar consulta
router.delete('/:id', verifyToken, verifyRole(['admin', 'dentista', 'recepcao']), (req, res) => {
  const id = req.params.id

  db.get('SELECT pago, valor, DATE(data_hora) as dia, status, materiais FROM consultas WHERE id = ?', [id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message })
    if (!row) return res.status(404).json({ error: 'Consulta não encontrada' })

    const previousPago = row.pago ? 1 : 0
    const valorConsulta = row.valor || 0
    const dia = row.dia || new Date().toISOString().split('T')[0]
    const previousStatus = row.status || null
    const materiaisJSON = row.materiais || null

    db.run('DELETE FROM consultas WHERE id = ?', [id], function(err2) {
      if (err2) return res.status(500).json({ error: err2.message })

      // if it was paid, subtract from daily_receitas
      if (previousPago === 1) {
        db.run('UPDATE daily_receitas SET total = total - ? WHERE dia = ?', [valorConsulta, dia], (e) => { if (e) console.error('Erro ao atualizar daily_receitas (delete):', e) })
      }

      // if it was realizada, try to restore estoque based on materiais
      if (previousStatus === 'realizada' && materiaisJSON) {
        let materiais
        try { materiais = JSON.parse(materiaisJSON) } catch (e) { materiais = materiaisJSON }

        if (Array.isArray(materiais) && materiais.length) {
          materiais.forEach(m => {
            const produtoId = m.produto_id || m.id || m.produto_id
            const qtd = Number(m.quantidade || 0)
            if (!produtoId || !qtd) return

            // increment product quantity
            db.run('UPDATE produtos_estoque SET quantidade = quantidade + ? WHERE id = ?', [qtd, produtoId], function(err3) {
              if (err3) console.error('Erro ao incrementar estoque:', err3)
            })

            // record movimentacao (entrada)
            const movId = uuidv4()
            db.run('INSERT INTO movimentacoes_estoque (id, produto_id, tipo, quantidade, motivo, usuario_id) VALUES (?, ?, ?, ?, ?, ?)',
              [movId, produtoId, 'entrada', qtd, `Restaurado por exclusão de consulta ${id}`, req.user?.id || null], (err4) => {
                if (err4) console.error('Erro ao registrar movimentacao (restaura):', err4)
              }
            )
          })
        }
      }

      logAudit(req, 'consultas.delete', { entityType: 'consulta', entityId: id, details: { previousPago, previousStatus } })
      res.json({ success: true })
    })
  })
})

module.exports = router
