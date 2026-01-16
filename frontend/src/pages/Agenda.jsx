import { consultasService, pacientesService } from '@services/api'
import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import styles from './Agenda.module.css'

function startOfWeek(date) {
  const d = new Date(date)
  const day = (d.getDay() + 6) % 7
  d.setDate(d.getDate() - day)
  return d
}

function buildWeeksForMonth(year, monthIndex) {
  const monthStart = new Date(year, monthIndex, 1)
  const monthEnd = new Date(year, monthIndex + 1, 0)
  const weeks = []
  let wkStart = startOfWeek(monthStart) // Monday
  while (wkStart <= monthEnd) {
    const wkEnd = new Date(wkStart)
    wkEnd.setDate(wkStart.getDate() + 6) // Sunday

    const from = new Date(Math.max(monthStart.getTime(), wkStart.getTime()))
    const to = new Date(Math.min(monthEnd.getTime(), wkEnd.getTime()))

    if (from <= to) {
      const fromDay = from.getDate()
      const toDay = to.getDate()
      weeks.push({
        start: wkStart,
        end: wkEnd,
        from,
        to,
        label: `Semana ${weeks.length + 1} (${fromDay}–${toDay})`
      })
    }

    wkStart = new Date(wkStart)
    wkStart.setDate(wkStart.getDate() + 7)
  }
  return weeks
}

function currentWeekOfMonth(d = new Date()) {
  const year = d.getFullYear()
  const month = d.getMonth()
  const weeks = buildWeeksForMonth(year, month)
  const day = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const idx = weeks.findIndex(w => day >= w.start && day <= w.end)
  return (idx >= 0 ? (idx + 1) : 1)
}

export default function Agenda() {
  const [consultas, setConsultas] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [filterYear, setFilterYear] = useState(() => new Date().getFullYear())
  const [filterMonth, setFilterMonth] = useState(new Date().getMonth())
  const [showNewModal, setShowNewModal] = useState(false)
  const [newConsulta, setNewConsulta] = useState({ paciente_id: '', data: new Date().toISOString().split('T')[0], hora: '09:00', tipo_consulta: 'geral', valor: '' })
  const [pacientes, setPacientes] = useState([])
  const [showNewConsultaGlobal, setShowNewConsultaGlobal] = useState(false)
  const [newConsultaGlobal, setNewConsultaGlobal] = useState({ paciente_id: '', data: new Date().toISOString().split('T')[0], hora: '09:00', tipo_consulta: 'geral', valor: '', procedimentos: [], observacoes: '' })
  const [procDescG, setProcDescG] = useState('')
  const [procValorG, setProcValorG] = useState('')

  const [filterWeek, setFilterWeek] = useState(() => currentWeekOfMonth())
  const [hoverConsulta, setHoverConsulta] = useState(null)
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 })
  const [selectedConsulta, setSelectedConsulta] = useState(null)

  const availableWeeks = useMemo(() => {
    const year = Number(filterYear)
    const monthIndex = Number(filterMonth)
    return buildWeeksForMonth(year, monthIndex)
  }, [filterYear, filterMonth])

  // keep filterWeek within the available range when month changes
  useEffect(() => {
    const maxWeek = Math.max(1, (availableWeeks || []).length)
    setFilterWeek((prev) => {
      const n = Number(prev || 1)
      if (n > maxWeek) return maxWeek
      if (n < 1) return 1
      return n
    })
  }, [availableWeeks])

  const OPERACOES = [
    'Consulta Geral',
    'Profilaxia (Limpeza)',
    'Restauração (Obturação)',
    'Endodontia (Tratamento de Canal)',
    'Extração',
    'Cirurgia Oral',
    'Periodontia (Raspagem)',
    'Prótese (Coroa/Prótese)',
    'Implante',
    'Clareamento',
    'Ortodontia (Aparelho)'
  ]

  useEffect(() => {
    // load pacientes and estoque for modal selects
    pacientesService.listar().then(d => setPacientes(d)).catch(() => {})
  }, [])

  // Ensure we open the agenda on the current week/month/year on first mount
  // and schedule an automatic update at every midnight so the view always
  // reflects the current day/week while the user keeps the tab open.
  useEffect(() => {
    const applyNow = (d = new Date()) => {
      setFilterMonth(d.getMonth())
      setFilterYear(d.getFullYear())
      setFilterWeek(currentWeekOfMonth(d))
      setSelectedDate(d)
    }

    applyNow()

    const scheduleNextMidnight = () => {
      const now = new Date()
      const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
      const ms = nextMidnight.getTime() - now.getTime()
      return setTimeout(() => {
        applyNow(new Date())
        // schedule again
        timerId = scheduleNextMidnight()
      }, ms)
    }

    let timerId = scheduleNextMidnight()

    const onVisible = () => {
      if (document.visibilityState === 'visible') applyNow(new Date())
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => { clearTimeout(timerId); document.removeEventListener('visibilitychange', onVisible) }
  }, [])

  const abrirNovaGlobal = () => {
    setNewConsultaGlobal({ paciente_id: pacientes && pacientes.length ? pacientes[0].id : '', data: new Date().toISOString().split('T')[0], hora: '09:00', tipo_consulta: 'geral', valor: '', procedimentos: [], observacoes: '' })
    setShowNewConsultaGlobal(true)
  }

  const irSemanaAnterior = () => {
    const week = Math.max(1, Number(filterWeek) || 1)
    if (week > 1) {
      setFilterWeek(week - 1)
      return
    }

    const year = Number(filterYear)
    let month = Number(filterMonth) - 1
    if (month < 0) month = 11
    const weeks = buildWeeksForMonth(year, month)
    setFilterMonth(month)
    setFilterWeek(Math.max(1, weeks.length || 1))
  }

  const irProximaSemana = () => {
    const week = Math.max(1, Number(filterWeek) || 1)
    const maxWeek = Math.max(1, (availableWeeks || []).length)
    if (week < maxWeek) {
      setFilterWeek(week + 1)
      return
    }

    const year = Number(filterYear)
    let month = Number(filterMonth) + 1
    if (month > 11) month = 0
    const weeks = buildWeeksForMonth(year, month)
    setFilterMonth(month)
    setFilterWeek(Math.min(1, Math.max(1, weeks.length || 1)))
  }

  const handleCreate = async (e) => {
    e.preventDefault()
    const data_hora = `${newConsulta.data} ${newConsulta.hora}`
    try {
      await import('@services/api').then(mod => mod.consultasService.agendar({ paciente_id: newConsulta.paciente_id, data_hora, tipo_consulta: newConsulta.tipo_consulta, valor: newConsulta.valor }))
      setShowNewModal(false)
      // refresh list
      const data = await consultasService.listar()
      setConsultas(data)
    } catch (err) {
      console.error('Erro ao agendar:', err)
    }
  }

  const handleCreateConsultaGlobal = async (e) => {
    e.preventDefault()
    try {
      // derive tipo if procedimentos present
      let tipoG = newConsultaGlobal.tipo_consulta
      const procsG = newConsultaGlobal.procedimentos || []
      if (procsG.length > 0) {
        tipoG = procsG.length === 1 ? (procsG[0].descricao || String(procsG[0])) : procsG.map(p => p.descricao || p).join(', ')
      }
      // valor fallback from procedimentos
      let valorG = newConsultaGlobal.valor
      if ((!valorG || String(valorG).trim() === '') && procsG.length > 0) {
        const somaG = procsG.reduce((s, p) => s + (Number(p.valor) || 0), 0)
        valorG = somaG || ''
      }

      const payload = {
        paciente_id: newConsultaGlobal.paciente_id,
        data_hora: `${newConsultaGlobal.data} ${newConsultaGlobal.hora}`,
        tipo_consulta: tipoG || 'geral',
        valor: valorG,
        procedimentos: newConsultaGlobal.procedimentos,
        observacoes: newConsultaGlobal.observacoes || ''
      }

      await consultasService.criar(payload)
      setShowNewConsultaGlobal(false)
      const data = await consultasService.listar()
      setConsultas(data)
    } catch (err) {
      console.error('Erro ao criar consulta (global):', err)
      alert('Erro ao criar consulta (global): ' + (err.message || JSON.stringify(err)))
    }
  }

  useEffect(() => {
    consultasService.listar().then(data => {
      setConsultas(data)
      setLoading(false)
    })
  }, [])

  /* ─────────────────── SEMANA ─────────────────── */

  

  const weekDays = useMemo(() => {
    const start = startOfWeek(selectedDate)
    return Array.from({ length: 6 }).map((_, i) => {
      const d = new Date(start)
      d.setDate(start.getDate() + i)
      return d
    })
  }, [selectedDate])

  // when filterYear, filterMonth or filterWeek change, set selectedDate to corresponding week of chosen month
  useEffect(() => {
    const year = Number(filterYear)
    const monthIndex = Number(filterMonth)
    const weekIdx = Math.max(1, Number(filterWeek) || 1) - 1
    const weeks = buildWeeksForMonth(year, monthIndex)
    const wk = weeks[weekIdx] || weeks[0]
    if (!wk) return
    const candidate = new Date(wk.start)
    candidate.setDate(candidate.getDate() + 2) // mid-week for a stable view
    setSelectedDate(candidate)
  }, [filterYear, filterMonth, filterWeek])

  const horarios = Array.from({ length: 10 }, (_, i) => `${8 + i}:00`)

  const consultasMap = useMemo(() => {
    const map = {}
    consultas.forEach(c => {
      const date = c.data_hora.slice(0, 10)
      map[date] = map[date] || []
      map[date].push(c)
    })
    return map
  }, [consultas])

  const handleDragStart = (e, consultaId) => {
    e.dataTransfer.setData('text/plain', consultaId)
  }

  const handleDrop = async (e, dateKey, hora) => {
    e.preventDefault()
    const id = e.dataTransfer.getData('text/plain')
    if (!id) return
    const newDataHora = `${dateKey} ${hora}`
    try {
      await consultasService.atualizarDados(id, { data_hora: newDataHora })
      const data = await consultasService.listar()
      setConsultas(data)
    } catch (err) {
      console.error('Erro ao mover consulta:', err)
      alert('Não foi possível mover a consulta: ' + (err.message || err))
    }
  }

  const handleDeleteConsulta = async (id, pacienteId) => {
    if (!confirm('Deseja realmente excluir esta consulta?')) return
    try {
      await consultasService.deletar(id)
      const data = await consultasService.listar()
      setConsultas(data)
      // notify other views (e.g., paciente perfil) to refresh
      try { window.dispatchEvent(new CustomEvent('consultaDeleted', { detail: { id, paciente_id: pacienteId } })) } catch { /* ignore */ }
    } catch (err) {
      console.error('Erro ao deletar consulta:', err)
      alert('Não foi possível excluir a consulta: ' + (err.message || err))
    }
  }

  const refreshConsultas = async () => {
    const data = await consultasService.listar()
    setConsultas(data)
  }

  const marcarNaoFinalizada = async (consulta, tipo) => {
    const tipoNormalized = String(tipo || '').toLowerCase()
    const label = tipoNormalized === 'falta' ? 'Falta' : 'Cancelada'

    const motivo = prompt(`Motivo (${label}) — ex: paciente_cancelou, sem_confirmacao, doenca`, consulta?.nao_finalizada_motivo || '')
    if (motivo === null) return
    const observacao = prompt('Observação (opcional):', consulta?.nao_finalizada_observacao || '')
    if (observacao === null) return

    try {
      await consultasService.atualizar(consulta.id, {
        status: tipoNormalized,
        pago: 0,
        nao_finalizada_motivo: String(motivo || '').trim() || null,
        nao_finalizada_observacao: String(observacao || '').trim() || null
      })
      await refreshConsultas()
      setSelectedConsulta(null)
    } catch (err) {
      console.error('Erro ao marcar não finalizada', err)
      alert('Não foi possível atualizar a consulta: ' + (err.message || err))
    }
  }

  if (loading) return <div className={styles.loading}>Carregando...</div>

  return (
    <div className={styles.container}>

      {/* ───── Mobile Header + Filters (match screenshot) ───── */}
      <div className={styles.mobileToolbar}>
        <div className={styles.mobileHeaderRow}>
          <h1 className={styles.mobileTitle}>Agenda</h1>
          <button className={`${styles.btnNova} ${styles.btnNovaMobile}`} onClick={abrirNovaGlobal}>
             Marcar Consulta <span className={styles.btnChevron} aria-hidden="true">›</span>
          </button>
        </div>

        <div className={styles.mobileFiltersRow}>
          <button type="button" className={styles.navBtn} onClick={irSemanaAnterior} aria-label="Semana anterior">‹</button>

          <select className={styles.filterSelect} value={filterMonth} onChange={e => setFilterMonth(Number(e.target.value))} aria-label="Mês">
            {Array.from({ length: 12 }).map((_, i) => (
              <option key={i} value={i}>
                {new Date(0, i).toLocaleString('pt-BR', { month: 'long' })}
              </option>
            ))}
          </select>

          <select className={styles.filterSelect} value={filterWeek} onChange={e => setFilterWeek(Number(e.target.value))} aria-label="Semana">
            {(availableWeeks || []).map((w, idx) => (
              <option key={idx} value={idx + 1}>{w.label}</option>
            ))}
          </select>

          <select className={styles.filterSelect} value={filterYear} onChange={e => setFilterYear(Number(e.target.value))} aria-label="Ano">
            <option value={new Date().getFullYear()}>{new Date().getFullYear()}</option>
          </select>

          <button type="button" className={styles.navBtn} onClick={irProximaSemana} aria-label="Próxima semana">›</button>
        </div>
      </div>

      {/* ───── Toolbar ───── */}
      <div className={styles.toolbarDesktop}>
        <select value={filterMonth} onChange={e => setFilterMonth(Number(e.target.value))}>
          {Array.from({length:12}).map((_,i) => (
            <option key={i} value={i}>{new Date(0, i).toLocaleString('pt-BR', { month: 'long' })}</option>
          ))}
        </select>

        <select value={filterWeek} onChange={e => setFilterWeek(Number(e.target.value))}>
          {(availableWeeks || []).map((w, idx) => (
            <option key={idx} value={idx + 1}>{w.label}</option>
          ))}
        </select>

        <select value={filterYear} onChange={e => setFilterYear(Number(e.target.value))}>
          <option value={new Date().getFullYear()}>{new Date().getFullYear()}</option>
        </select>

        <button className={`${styles.btnNova} ${styles.secondary}`} onClick={abrirNovaGlobal}>Marcar Consulta</button>
      </div>

      {/* ───── Grade ───── */}
      <div className={styles.grid}>

        {/* Horários */}
        <div className={styles.hours}>
          <div className={styles.empty}></div>
          {horarios.map(h => (
            <div key={h} className={styles.hour}>{h}</div>
          ))}
        </div>

        {/* Dias */}
        {weekDays.map(day => {
          const dateKey = day.toISOString().slice(0, 10)
          const weekdayLabel = day.toLocaleDateString('pt-BR', { weekday: 'long' })
          const dateLabel = day.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })

          return (
            <div key={dateKey} className={styles.dayColumn}>
              <div className={styles.dayHeader}>
                <div className={styles.dayName}>{weekdayLabel}</div>
                <div className={styles.dayDate}>{dateLabel}</div>
              </div>

              <div className={styles.slotsWrap}>
                {horarios.map(hora => (
                  <div key={hora} className={styles.slot} onDragOver={(ev) => ev.preventDefault()} onDrop={(ev) => handleDrop(ev, dateKey, hora)}></div>
                ))}

                {/* render appointments positioned */}
                {(consultasMap[dateKey] || []).map(c => {
                  const dt = new Date(c.data_hora)
                  const startHour = dt.getHours()
                  const startMin = dt.getMinutes()
                  const dayStart = 8 // first slot hour
                  const minutesFromDayStart = (startHour - dayStart) * 60 + startMin
                  const SLOT_HEIGHT = 60 // px per hour (matches CSS)
                  const top = (minutesFromDayStart / 60) * SLOT_HEIGHT
                  const duration = c.duracao_minutos || 60
                  const height = (duration / 60) * SLOT_HEIGHT - 6

                  return (
                    <div
                      key={c.id}
                      className={`${styles.appointment} ${c.status === 'cancelada' ? styles.appointmentCancelled : ''} ${c.status === 'falta' ? styles.appointmentFalta : ''} ${c.status === 'realizada' ? styles.appointmentRealizada : ''}`}
                      style={{ top: `${top}px`, height: `${height}px` }}
                      draggable
                      onDragStart={(e) => handleDragStart(e, c.id)}
                      onClick={(e) => { e.stopPropagation(); setSelectedConsulta(c) }}
                      onMouseEnter={(e) => { e.stopPropagation(); setHoverConsulta(c); setTooltipPos({ x: e.clientX, y: e.clientY }) }}
                      onMouseMove={(e) => { setTooltipPos({ x: e.clientX, y: e.clientY }) }}
                      onMouseLeave={() => setHoverConsulta(null)}
                    >
                      <div className={styles.appCard}>
                        <button className={styles.deleteBtn} onClick={(e) => { e.stopPropagation(); handleDeleteConsulta(c.id, c.paciente_id) }} aria-label="Excluir consulta">✕</button>
                        <strong>{c.paciente_nome}</strong>
                        <div className={styles.appTime}>{dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} - {new Date(dt.getTime() + duration*60000).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</div>
                      </div>
                    </div>
                  )
                })}
                {hoverConsulta && createPortal(
                  <div className={styles.tooltip} style={{ left: tooltipPos.x + 12, top: tooltipPos.y + 12 }}>
                    <div className={styles.tooltipCard}>
                      <div style={{fontWeight:700, marginBottom:6}}>{new Date(hoverConsulta.data_hora).toLocaleDateString('pt-BR')} — {new Date(hoverConsulta.data_hora).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</div>
                      <div style={{fontSize:13, marginBottom:6}}><strong>Paciente:</strong> {hoverConsulta.paciente_nome}</div>
                      <div style={{fontSize:13, marginBottom:6}}><strong>Procedimentos:</strong> {(() => {
                        let procedimentos = hoverConsulta.procedimentos
                        if (!procedimentos) return '—'
                        if (typeof procedimentos === 'string') {
                          try { procedimentos = JSON.parse(procedimentos) } catch { procedimentos = [procedimentos] }
                        }
                        if (Array.isArray(procedimentos) && procedimentos.length > 0) return procedimentos.map(p => p.descricao || p).join(', ')
                        return String(procedimentos)
                      })()}</div>
                      <div style={{fontSize:13, marginBottom:6}}><strong>Observações:</strong> {((hoverConsulta.observacoes && String(hoverConsulta.observacoes).trim()) || (hoverConsulta.descricao && String(hoverConsulta.descricao).trim())) ? (hoverConsulta.observacoes && String(hoverConsulta.observacoes).trim() ? hoverConsulta.observacoes : hoverConsulta.descricao) : 'Observação não registrada'}</div>
                      <div style={{fontSize:13}}><strong>Valor:</strong> R$ {hoverConsulta.valor ? Number(hoverConsulta.valor).toFixed(2) : '0,00'}</div>
                    </div>
                  </div>
                , document.body)}
              </div>
            </div>
          )
        })}
      </div>

      {showNewModal && (
        <div className={styles.modal}>
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <h3>Nova Consulta</h3>
              <button className={styles.modalClose} onClick={() => setShowNewModal(false)}>✕</button>
            </div>
            <div className={styles.modalBody}>
              <form onSubmit={handleCreate}>
                <label className={styles.formLabel}>Paciente</label>
                <select className={styles.formInput} value={newConsulta.paciente_id} onChange={e => setNewConsulta({...newConsulta, paciente_id: e.target.value})} required>
                  <option value="">Selecione paciente</option>
                  {pacientes.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
                </select>

                <label className={styles.formLabel}>Data</label>
                <input className={styles.formInput} type="date" value={newConsulta.data} onChange={e => setNewConsulta({...newConsulta, data: e.target.value})} required />

                <label className={styles.formLabel}>Hora</label>
                <input className={styles.formInput} type="time" value={newConsulta.hora} onChange={e => setNewConsulta({...newConsulta, hora: e.target.value})} required />

                <label className={styles.formLabel}>Tipo</label>
                <input className={styles.formInput} type="text" placeholder="Tipo" value={newConsulta.tipo_consulta} onChange={e => setNewConsulta({...newConsulta, tipo_consulta: e.target.value})} />

                <label className={styles.formLabel}>Valor</label>
                <input className={styles.formInput} type="number" placeholder="Valor" value={newConsulta.valor} onChange={e => setNewConsulta({...newConsulta, valor: e.target.value})} />

                <div className={styles.modalFooter}>
                  <button type="button" className={styles.btnSecondary} onClick={() => setShowNewModal(false)}>Cancelar</button>
                  <button type="submit" className={styles.btnPrimary}>Salvar</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {selectedConsulta && (
        <div className={styles.modal} onMouseDown={() => setSelectedConsulta(null)}>
          <div className={styles.modalContent} onMouseDown={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>Consulta</h3>
              <button className={styles.modalClose} onClick={() => setSelectedConsulta(null)}>✕</button>
            </div>

            <div className={styles.modalBody}>
              <div style={{fontWeight:700, marginBottom:8}}>
                {selectedConsulta.paciente_nome} — {new Date(selectedConsulta.data_hora).toLocaleString('pt-BR')}
              </div>
              <div style={{marginBottom:6}}><strong>Status:</strong> {selectedConsulta.status || 'agendada'}</div>
              {String(selectedConsulta.status || '') === 'cancelada' || String(selectedConsulta.status || '') === 'falta' ? (
                <div style={{marginBottom:10}}>
                  <div style={{marginBottom:6}}><strong>Motivo:</strong> {selectedConsulta.nao_finalizada_motivo || '(sem motivo)'}</div>
                  <div><strong>Obs:</strong> {selectedConsulta.nao_finalizada_observacao || '(sem observação)'}</div>
                </div>
              ) : null}

              <div className={styles.modalFooter}>
                <button type="button" className={styles.btnSecondary} onClick={() => setSelectedConsulta(null)}>Fechar</button>
                <button type="button" className={styles.btnSecondary} onClick={() => marcarNaoFinalizada(selectedConsulta, 'cancelada')}>Marcar Cancelada</button>
                <button type="button" className={styles.btnSecondary} onClick={() => marcarNaoFinalizada(selectedConsulta, 'falta')}>Marcar Falta</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showNewConsultaGlobal && (
        <div className={`${styles.modal} ${styles.dialogOverlay}`}>
          <div className={`${styles.dialogContent} ${styles.mcDialog}`}>
      <button
        type="button"
        className={styles.dialogClose}
        onClick={() => setShowNewConsultaGlobal(false)}
        aria-label="Fechar"
      >
        ✕
      </button>

      <form onSubmit={handleCreateConsultaGlobal} className={styles.dialogBody}>

        <div className={styles.mcBlock}>
          <div className={styles.mcBlockHeader}>ATENDIMENTO</div>
          <div className={styles.mcBlockBody}>
            <div>
              <label className={styles.formLabel}>Paciente</label>
              <select className={styles.formInput} value={newConsultaGlobal.paciente_id} onChange={e => setNewConsultaGlobal({...newConsultaGlobal, paciente_id: e.target.value})} required>
                <option value="">Selecionar paciente</option>
                {pacientes.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
              </select>
            </div>

            <div className={styles.mcRow}>
              <div>
                <label className={styles.formLabel}>Data</label>
                <input type="date" className={styles.formInput} value={newConsultaGlobal.data} onChange={e => setNewConsultaGlobal({...newConsultaGlobal, data: e.target.value})} required />
              </div>
              <div className={styles.mcTime}>
                <label className={styles.formLabel}>Horário</label>
                <input type="time" className={styles.formInput} value={newConsultaGlobal.hora} onChange={e => setNewConsultaGlobal({...newConsultaGlobal, hora: e.target.value})} required />
              </div>
            </div>

            <div>
              <label className={styles.formLabel}>Tipo de Procedimento — Valor</label>
              <div className={styles.inlineRow}>
                <select className={styles.formInput} value={procDescG} onChange={e => setProcDescG(e.target.value)}>
                  <option value="">Selecionar</option>
                  {OPERACOES.map((op,i) => <option key={i} value={op}>{op}</option>)}
                </select>
                <input type="number" className={styles.smallInput} placeholder="R$ 0,00" value={procValorG} onChange={e => setProcValorG(e.target.value)} />
                <button type="button" className={styles.addBlue} onClick={() => {
                  if (!procDescG) return
                  const arr = [...newConsultaGlobal.procedimentos, { descricao: procDescG, valor: procValorG || 0 }]
                  let tipoG = newConsultaGlobal.tipo_consulta
                  if ((!tipoG || tipoG === 'geral') && arr.length > 0) {
                    tipoG = arr.length === 1 ? arr[0].descricao : arr.map(p => p.descricao).join(', ')
                  }
                  setNewConsultaGlobal({...newConsultaGlobal, procedimentos: arr, tipo_consulta: tipoG})
                  setProcDescG('')
                  setProcValorG('')
                }}>+</button>
              </div>
            </div>

            <div>
              <label className={styles.formLabel}>Observações</label>
              <textarea className={styles.formInput} rows={3} value={newConsultaGlobal.observacoes || ''} onChange={e => setNewConsultaGlobal({...newConsultaGlobal, observacoes: e.target.value})} />
            </div>
          </div>
        </div>

        <div className={styles.mcBlock}>
          <div className={styles.mcBlockHeader}>Procedimentos adicionados</div>
          <div className={styles.mcBlockBody}>
            <div className={styles.chipList}>
              {newConsultaGlobal.procedimentos.map((p, idx) => (
                <div key={idx} className={styles.chip}>{p.descricao}<button type="button" onClick={() => { const arr = [...newConsultaGlobal.procedimentos]; arr.splice(idx,1); setNewConsultaGlobal({...newConsultaGlobal, procedimentos: arr}) }}>✕</button></div>
              ))}
            </div>
          </div>
        </div>

        <div className={styles.dialogFooter}>
          <button type="button" className={styles.btnSecondary} onClick={() => setShowNewConsultaGlobal(false)}>Cancelar</button>
          <button type="submit" className={styles.btnPrimary}>Salvar</button>
        </div>
      </form>
          </div>
        </div>
      )}
    </div>
  )
}
