import { useAuth } from '@context/useAuth'
import { consultasService, relatoriosService } from '@services/api'
import { useEffect, useRef, useState } from 'react'
import styles from './Dashboard.module.css'
import reportStyles from './Relatorios.module.css'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LabelList,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip
} from 'recharts'

const formatMoneyCompact = (v) => `R$ ${Number(v || 0).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`

function MoneyLabelContent(props) {
  const { x, y, width, value } = props || {}
  const n = Number(value || 0)
  if (!Number.isFinite(n) || n <= 0) return null
  const cx = Number(x || 0) + Number(width || 0) / 2
  const cy = Number(y || 0) - 6
  return (
    <text x={cx} y={cy} textAnchor="middle" fontSize={10} fill="#111827">
      {formatMoneyCompact(n)}
    </text>
  )
}

export default function Dashboard() {
  const { user } = useAuth()
  const [_alertas, setAlertas] = useState([])
  const [receita, setReceita] = useState(0)
  const [totalPacientes, setTotalPacientes] = useState(0)
  const [consultasAll, setConsultasAll] = useState([])
  const [proximas, setProximas] = useState([])
  const [consultasRealizadasHoje, setConsultasRealizadasHoje] = useState(0)
  const [estoque, setEstoque] = useState([])
  const [consultasAgendadasHoje, setConsultasAgendadasHoje] = useState(0)
  const [consultasAgendadasTotal, setConsultasAgendadasTotal] = useState(0)
  const [suppressAgendadasUntil, _setSuppressAgendadasUntil] = useState(0)
  const [_pacientes, setPacientes] = useState([])
  const [loading, setLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState(null)

  const [acaoConsulta, setAcaoConsulta] = useState(null)
  const [acaoTipo, setAcaoTipo] = useState('realizada') // realizada | falta | cancelada | reagendar
  const [acaoPago, setAcaoPago] = useState(true)
  const [acaoMotivo, setAcaoMotivo] = useState('')
  const [acaoObs, setAcaoObs] = useState('')
  const [acaoData, setAcaoData] = useState(() => new Date().toISOString().split('T')[0])
  const [acaoHora, setAcaoHora] = useState('09:00')
  const [acaoLoading, setAcaoLoading] = useState(false)

  // Receita (mesmo layout da aba Relatórios)
  const HOUR_START = 8
  const HOUR_END = 17
  const [dailyChartDate, setDailyChartDate] = useState(() => new Date().toISOString().split('T')[0])
  const [dailyChartLoading, setDailyChartLoading] = useState(false)
  const [dailyChartError, setDailyChartError] = useState('')
  const [receitaDiaHoras, setReceitaDiaHoras] = useState(new Array(HOUR_END - HOUR_START + 1).fill(0))

  const [monthlyChartMonth, setMonthlyChartMonth] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })
  const [monthlyChartWeeks, setMonthlyChartWeeks] = useState(() => (
    [
      { label: '1–7', total: 0 },
      { label: '8–14', total: 0 },
      { label: '15–21', total: 0 },
      { label: '22–fim', total: 0 }
    ]
  ))
  const [monthlyChartLoading, setMonthlyChartLoading] = useState(false)
  const [monthlyChartError, setMonthlyChartError] = useState('')

  const carregarDadosRef = useRef(null)
  const carregarReceitaPorHoraRef = useRef(null)
  const carregarReceitaMensalSemanasRef = useRef(null)

  const ESTOQUE_ROWS = 5

  const formatMoney = (v) => `R$ ${Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`

  const ymdFromLocalDate = (dateLike) => {
    const dt = new Date(dateLike)
    if (Number.isNaN(dt.getTime())) return ''
    const y = dt.getFullYear()
    const m = String(dt.getMonth() + 1).padStart(2, '0')
    const d = String(dt.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }

  const monthRange = (ym) => {
    const [y, m] = String(ym || '').split('-').map(Number)
    if (!y || !m) return { start: '', end: '' }
    const start = new Date(y, m - 1, 1)
    const end = new Date(y, m, 0)
    return { start: ymdFromLocalDate(start), end: ymdFromLocalDate(end) }
  }

  const monthWeekRanges = (ym) => {
    const { start, end } = monthRange(ym)
    if (!start || !end) return []
    const monthStart = new Date(`${start}T00:00:00`)
    const monthEnd = new Date(`${end}T00:00:00`)

    // Monday-based weeks, label shows only the days inside the month.
    const startOfWeekMon = (date) => {
      const d = new Date(date)
      const day = (d.getDay() + 6) % 7
      d.setDate(d.getDate() - day)
      d.setHours(0, 0, 0, 0)
      return d
    }

    const ranges = []
    let wkStart = startOfWeekMon(monthStart)
    while (wkStart <= monthEnd) {
      const wkEnd = new Date(wkStart)
      wkEnd.setDate(wkStart.getDate() + 6)

      const from = new Date(Math.max(monthStart.getTime(), wkStart.getTime()))
      const to = new Date(Math.min(monthEnd.getTime(), wkEnd.getTime()))
      if (from <= to) {
        ranges.push({
          startYmd: ymdFromLocalDate(from),
          endYmd: ymdFromLocalDate(to),
          label: `Semana ${ranges.length + 1} (${from.getDate()}–${to.getDate()})`
        })
      }

      wkStart = new Date(wkStart)
      wkStart.setDate(wkStart.getDate() + 7)
    }
    return ranges
  }

  const isReceitaConsulta = (c) => {
    // mesma regra usada em Relatórios para não ficar sempre "sem receita"
    return Boolean(c?.pago) || String(c?.status || '').toLowerCase() === 'realizada'
  }

  const filterConsultasByRange = (consultas, startYmd, endYmd) => {
    const start = String(startYmd || '')
    const end = String(endYmd || '')
    if (!start || !end) return []
    return (consultas || []).filter(c => {
      const ymd = ymdFromLocalDate(c?.data_hora || c?.data)
      return ymd && ymd >= start && ymd <= end
    })
  }

  const computeHourTotals = (consultas, startHour = HOUR_START, endHour = HOUR_END) => {
    const len = (endHour - startHour + 1)
    const hourly = new Array(len).fill(0)
    ;(consultas || []).forEach(c => {
      if (!isReceitaConsulta(c)) return
      const dt = new Date(c.data_hora || c.data)
      const hour = dt.getHours()
      if (hour < startHour || hour > endHour) return
      const idx = hour - startHour
      const val = Number(c.valor || 0)
      hourly[idx] += Number.isFinite(val) ? val : 0
    })
    return hourly
  }

  const computeMonthlyWeekTotals = (consultas, ym) => {
    const ranges = monthWeekRanges(ym)
    if (!ranges.length) return []
    return ranges.map(r => {
      const total = (consultas || []).reduce((s, c) => {
        if (!isReceitaConsulta(c)) return s
        const ymd = ymdFromLocalDate(c?.data_hora || c?.data)
        if (!ymd) return s
        if (ymd < r.startYmd || ymd > r.endYmd) return s
        const val = Number(c?.valor || 0)
        return s + (Number.isFinite(val) ? val : 0)
      }, 0)
      return { label: r.label, total }
    })
  }

  const carregarReceitaPorHora = (diaYmd) => {
    setDailyChartLoading(true)
    setDailyChartError('')
    try {
      const ymd = String(diaYmd || '')
      if (!ymd) throw new Error('Selecione um dia válido')
      const dayRows = filterConsultasByRange(consultasAll, ymd, ymd)
      setReceitaDiaHoras(computeHourTotals(dayRows))
    } catch (err) {
      setReceitaDiaHoras(new Array(HOUR_END - HOUR_START + 1).fill(0))
      setDailyChartError(err?.message || String(err || 'Erro ao carregar gráfico diário'))
    } finally {
      setDailyChartLoading(false)
    }
  }

  carregarReceitaPorHoraRef.current = carregarReceitaPorHora

  const carregarReceitaMensalSemanas = (ym) => {
    setMonthlyChartLoading(true)
    setMonthlyChartError('')
    try {
      const { start, end } = monthRange(ym)
      if (!start || !end) throw new Error('Selecione um mês válido')
      const rows = filterConsultasByRange(consultasAll, start, end)
      setMonthlyChartWeeks(computeMonthlyWeekTotals(rows, ym))
    } catch (err) {
      setMonthlyChartWeeks([
        { label: '1–7', total: 0 },
        { label: '8–14', total: 0 },
        { label: '15–21', total: 0 },
        { label: '22–fim', total: 0 }
      ])
      setMonthlyChartError(err?.message || String(err || 'Erro ao carregar gráfico mensal'))
    } finally {
      setMonthlyChartLoading(false)
    }
  }

  carregarReceitaMensalSemanasRef.current = carregarReceitaMensalSemanas

  // helpers to persist daily counters so switching tabs doesn't show temporary zeros
  const storageKey = 'dashboardDaily_v1'
  const loadSavedDaily = () => {
    try {
      const raw = localStorage.getItem(storageKey)
      if (!raw) return null
      const parsed = JSON.parse(raw)
      return parsed
    } catch { return null }
  }
  const saveSavedDaily = (data) => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(data))
    } catch { /* ignore */ }
  }

  useEffect(() => {
    // restore daily counters from localStorage if same day to avoid flashing zeros
    const saved = loadSavedDaily()
    const today = new Date().toISOString().split('T')[0]
    if (saved && saved.date === today) {
      if (typeof saved.receita === 'number') setReceita(saved.receita)
      if (typeof saved.consultasRealizadasHoje === 'number') setConsultasRealizadasHoje(saved.consultasRealizadasHoje)
      if (typeof saved.consultasAgendadasHoje === 'number') setConsultasAgendadasHoje(saved.consultasAgendadasHoje)
      if (typeof saved.consultasAgendadasTotal === 'number') setConsultasAgendadasTotal(saved.consultasAgendadasTotal)
    }

    carregarDadosRef.current?.()
    const interval = setInterval(() => carregarDadosRef.current?.(), 10000) // polling a cada 10s

    // schedule a daily reset at next midnight
    const scheduleMidnightReset = () => {
      const now = new Date()
      const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
      const ms = nextMidnight.getTime() - now.getTime()
      return setTimeout(() => {
        const today = new Date().toISOString().split('T')[0]
        const now = new Date()
        const ymNow = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
        setReceita(0)
        setConsultasRealizadasHoje(0)
        setConsultasAgendadasHoje(0)
        setDailyChartDate(today)
        setMonthlyChartMonth(ymNow)
        // refresh data after reset
          // clear persisted daily data (new day)
          try { localStorage.removeItem(storageKey) } catch { /* ignore */ }
          carregarDadosRef.current?.()
        // schedule again for the following midnight
        scheduleMidnightReset()
      }, ms)
    }
    const midnightTimeout = scheduleMidnightReset()

    return () => { clearInterval(interval); clearTimeout(midnightTimeout) }
  }, [])

  const carregarDados = async () => {
    try {
      // Use consolidated dashboard endpoint for faster payload and simpler updates
      const dashboard = await relatoriosService.dashboard().catch(() => ({}))
      setAlertas([])
      setTotalPacientes(dashboard.total_pacientes || 0)
      // Prefer recently added products when available, otherwise show low-stock products
      setEstoque(dashboard.produtos_recentes && dashboard.produtos_recentes.length ? dashboard.produtos_recentes : (dashboard.produtos_baixo_estoque || []))
      setProximas(dashboard.next_consultas || [])

      // prepare local accumulators for daily values so we can persist them reliably
      let newReceita = dashboard.receita_hoje || 0
      let newConsultasRealizadasHoje = 0
      // carregar agendamentos para obter contagens: agendadas hoje e total agendadas
      let newAgendadasHoje = 0
      let newAgendadasTotal = 0
      try {
        const ag = await relatoriosService.agendamentos().catch(() => ({ consultas: [], por_status: {} }))
        const consultas = ag.consultas || []
        if (Array.isArray(consultas) && consultas.length) setConsultasAll(consultas)
        const hojeStr = new Date().toISOString().split('T')[0]

        // No Dashboard, o gráfico diário é sempre do dia atual
        if (dailyChartDate !== hojeStr) setDailyChartDate(hojeStr)

        // No Dashboard, o gráfico mensal é sempre do mês atual
        const now = new Date()
        const ymNow = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
        if (monthlyChartMonth !== ymNow) setMonthlyChartMonth(ymNow)

        // Contar consultas realizadas hoje (independente de pago) para não zerar no refresh
        newConsultasRealizadasHoje = (consultas || []).filter(c => {
          if (String(c?.status || '') !== 'realizada') return false
          try { return new Date(c.data_hora).toISOString().split('T')[0] === hojeStr } catch { return false }
        }).length
        setConsultasRealizadasHoje(newConsultasRealizadasHoje)

        // Importante: este card não deve diminuir ao finalizar uma consulta.
        // Portanto, consideramos tanto 'agendada' quanto 'realizada' nas contagens.
        const countedStatuses = new Set(['agendada', 'realizada'])
        newAgendadasHoje = (consultas || []).filter(c => countedStatuses.has(c.status) && (new Date(c.data_hora).toISOString().split('T')[0] === hojeStr)).length
        newAgendadasTotal = (consultas || []).filter(c => countedStatuses.has(c.status)).length
        // respect suppression flag set after a local finalize action so the small card
        // doesn't decrement immediately (user requested it to stay until next full refresh)
        if (Date.now() >= (suppressAgendadasUntil || 0)) {
          setConsultasAgendadasHoje(newAgendadasHoje)
          setConsultasAgendadasTotal(newAgendadasTotal)
        }
      } catch (err) {
        console.warn('não foi possível carregar agendamentos', err)
      }

      // persist daily counters (saved with today's date)
      try {
        const today = new Date().toISOString().split('T')[0]
        saveSavedDaily({ date: today, receita: newReceita, consultasRealizadasHoje: newConsultasRealizadasHoje, consultasAgendadasHoje: newAgendadasHoje, consultasAgendadasTotal: newAgendadasTotal })
      } catch { /* ignore */ }
      // set receita finally
      setReceita(newReceita)
      setPacientes(dashboard.recent_pacientes || [])
      setLastUpdated(new Date())
    } catch (err) {
      console.error('Erro ao carregar dados:', err)
    } finally {
      setLoading(false)
    }
  }

  carregarDadosRef.current = carregarDados

  const abrirModalAcoes = (consulta) => {
    if (!consulta) return
    setAcaoConsulta(consulta)
    setAcaoTipo('realizada')
    setAcaoPago(true)
    setAcaoMotivo('')
    setAcaoObs('')

    try {
      const dt = new Date(consulta.data_hora)
      if (!Number.isNaN(dt.getTime())) {
        const d = dt.toISOString().split('T')[0]
        const h = dt.toTimeString().slice(0, 5)
        setAcaoData(d)
        setAcaoHora(h)
      }
    } catch {
      // ignore
    }
  }

  const executarAcaoConsulta = async () => {
    if (!acaoConsulta?.id) return
    setAcaoLoading(true)
    try {
      if (acaoTipo === 'realizada') {
        await consultasService.atualizar(acaoConsulta.id, { status: 'realizada', pago: acaoPago ? 1 : 0 })
      } else if (acaoTipo === 'falta' || acaoTipo === 'cancelada') {
        await consultasService.atualizar(acaoConsulta.id, {
          status: acaoTipo,
          pago: 0,
          nao_finalizada_motivo: String(acaoMotivo || '').trim() || null,
          nao_finalizada_observacao: String(acaoObs || '').trim() || null
        })
      } else if (acaoTipo === 'reagendar') {
        if (!acaoData || !acaoHora) {
          alert('Selecione data e horário para reagendar.')
          return
        }
        // garante que não fica marcado como falta/cancelada
        await consultasService.atualizar(acaoConsulta.id, { status: 'agendada', pago: 0 })
        await consultasService.atualizarDados(acaoConsulta.id, { data_hora: `${acaoData} ${acaoHora}` })
      }

      await carregarDados()
      setAcaoConsulta(null)
    } catch (err) {
      console.error('Erro ao executar ação da consulta', err)
      alert('Não foi possível atualizar a consulta: ' + (err.message || err))
    } finally {
      setAcaoLoading(false)
    }
  }

  useEffect(() => {
    carregarReceitaPorHoraRef.current?.(dailyChartDate)
  }, [dailyChartDate, consultasAll])

  useEffect(() => {
    carregarReceitaMensalSemanasRef.current?.(monthlyChartMonth)
  }, [monthlyChartMonth, consultasAll])

  const finalizarConsulta = async (consulta) => {
    abrirModalAcoes(consulta)
  }

  if (loading) {
    return <div className={styles.loading}>Carregando...</div>
  }

  const StatIcon = ({ name }) => {
    const common = {
      width: 18,
      height: 18,
      viewBox: '0 0 24 24',
      fill: 'none',
      stroke: 'currentColor',
      strokeWidth: 2,
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      'aria-hidden': true,
      focusable: false
    }
    switch (name) {
      case 'money':
        return (
          <svg {...common}>
            <path d="M12 2v20" />
            <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7H14a3.5 3.5 0 0 1 0 7H6" />
          </svg>
        )
      case 'calendar':
        return (
          <svg {...common}>
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <path d="M16 2v4" />
            <path d="M8 2v4" />
            <path d="M3 10h18" />
          </svg>
        )
      case 'check':
        return (
          <svg {...common}>
            <path d="M20 6 9 17l-5-5" />
          </svg>
        )
      case 'users':
        return (
          <svg {...common}>
            <path d="M17 21a5 5 0 0 0-10 0" />
            <circle cx="12" cy="7" r="3" />
            <path d="M21 21a4 4 0 0 0-6-3.5" />
            <path d="M3 21a4 4 0 0 1 6-3.5" />
          </svg>
        )
      default:
        return null
    }
  }

  return (
    <div className={styles.dashboardWire}>
      <header className={styles.headerRow}>
        <div>
          <h1>Dashboard</h1>
          <p className={styles.welcome}>Bem-vindo de volta, {user?.nome}!</p>

          <div className={styles.topStatsRow}>
            <div className={styles.smallCard}>
              <div className={styles.smallTitle}>
                <span className={`${styles.smallIcon} ${styles.iconMoney}`}><StatIcon name="money" /></span>
                Receita Diária
              </div>
              <div className={styles.smallValue}>R$ {Number(receita).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
              <div className={styles.smallMeta}>R$ {Number(receita).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} hoje</div>
            </div>

            <div className={`${styles.smallCard} ${styles.agendadasCard}`}>
              <div className={styles.smallTitle}>Consultas Agendadas</div>
              <table className={styles.agendadasTable}>
                <thead>
                  <tr>
                    <th>Hoje</th>
                    <th className={styles.agSpacerHead}></th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className={styles.agValue}>{consultasAgendadasHoje}</td>
                    <td className={styles.agSpacer}></td>
                    <td className={styles.agValue}>{consultasAgendadasTotal}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className={styles.smallCard}>
              <div className={styles.smallTitle}>
                <span className={`${styles.smallIcon} ${styles.iconCheck}`}><StatIcon name="check" /></span>
                Consultas Realizadas
              </div>
              <div className={styles.smallValue}>{consultasRealizadasHoje}</div>
              <div className={styles.smallMeta}>Hoje</div>
            </div>

            <div className={styles.smallCard}>
              <div className={styles.smallTitle}>
                <span className={`${styles.smallIcon} ${styles.iconUsers}`}><StatIcon name="users" /></span>
                Pacientes
              </div>
              <div className={styles.smallValue}>{totalPacientes}</div>
              <div className={styles.smallMeta}>Total</div>
            </div>
          </div>
        </div>
        {lastUpdated && <div className={styles.updatedNote}>Atualizado: {new Date(lastUpdated).toLocaleTimeString('pt-BR')}</div>}
      </header>
      <div className={styles.mainGrid}>
        <div className={styles.topPanels}>
          <div className={`${styles.panel} ${styles.tableCard}`}>
            <div className={styles.panelHeader}>
              <h3>Próximas Consultas</h3>
              <a className={styles.panelLink} href="/agenda">Ver todas ›</a>
            </div>
            <div className={styles.tableCardInner}>
              <table className={`${styles.tableCardTable} ${styles.proximasTable}`}>
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Nome do Paciente</th>
                    <th>Procedimento</th>
                    <th style={{textAlign:'right'}}>Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {proximas.filter(c => c.status !== 'realizada').slice(0,8).map(c => (
                    <tr key={c.id} className={c.status === 'agendada' ? styles.scheduledRow : ''}>
                      <td>{new Date(c.data_hora).toLocaleDateString('pt-BR')} {new Date(c.data_hora).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</td>
                      <td>{c.paciente_nome}</td>
                      <td>{c.tipo_consulta}</td>
                      <td style={{textAlign:'right'}}>
                        <button className={styles.markPaidBtn} onClick={() => finalizarConsulta(c)}>Ações</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {acaoConsulta && (
            <div className={styles.actionOverlay} onMouseDown={() => setAcaoConsulta(null)}>
              <div className={styles.actionModal} onMouseDown={(e) => e.stopPropagation()}>
                <div className={styles.actionHeader}>
                  <div className={styles.actionTitle}>Consulta — Ações</div>
                  <button className={styles.actionClose} onClick={() => setAcaoConsulta(null)} aria-label="Fechar">✕</button>
                </div>

                <div className={styles.actionBody}>
                  <div className={styles.actionInfoRow}>
                    <div className={styles.actionIconBox} aria-hidden>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="4" width="18" height="18" rx="2" />
                        <path d="M16 2v4" />
                        <path d="M8 2v4" />
                        <path d="M3 10h18" />
                      </svg>
                    </div>
                    <div className={styles.actionInfoText}>
                      <span className={styles.actionPatient}>{acaoConsulta.paciente_nome}</span>
                      <span className={styles.actionDot}>•</span>
                      <span className={styles.actionDatetime}>{new Date(acaoConsulta.data_hora).toLocaleString('pt-BR')}</span>
                    </div>
                  </div>

                  <div className={styles.actionRadios}>
                    <label><input type="radio" name="acao" checked={acaoTipo === 'realizada'} onChange={() => setAcaoTipo('realizada')} /> Realizada</label>
                    <label><input type="radio" name="acao" checked={acaoTipo === 'falta'} onChange={() => setAcaoTipo('falta')} /> Falta</label>
                    <label><input type="radio" name="acao" checked={acaoTipo === 'cancelada'} onChange={() => setAcaoTipo('cancelada')} /> Cancelada</label>
                    <label><input type="radio" name="acao" checked={acaoTipo === 'reagendar'} onChange={() => setAcaoTipo('reagendar')} /> Reagendar</label>
                  </div>

                  {acaoTipo === 'realizada' && (
                    <div className={styles.actionSection}>
                      <label className={styles.actionCheck}>
                        <input type="checkbox" checked={acaoPago} onChange={(e) => setAcaoPago(e.target.checked)} />
                        Marcar como paga
                      </label>
                    </div>
                  )}

                  {(acaoTipo === 'falta' || acaoTipo === 'cancelada') && (
                    <div className={styles.actionSection}>
                      <label className={styles.actionLabel}>Motivo (curto)</label>
                      <input className={styles.actionInput} value={acaoMotivo} onChange={(e) => setAcaoMotivo(e.target.value)} placeholder="ex: paciente_cancelou, sem_confirmacao" />
                      <label className={styles.actionLabel} style={{ marginTop: 10 }}>Observação (opcional)</label>
                      <textarea className={styles.actionTextarea} rows={3} value={acaoObs} onChange={(e) => setAcaoObs(e.target.value)} placeholder="Detalhes adicionais..." />
                    </div>
                  )}

                  {acaoTipo === 'reagendar' && (
                    <div className={styles.actionSection}>
                      <div className={styles.actionRow}>
                        <div>
                          <label className={styles.actionLabel}>Data</label>
                          <input className={styles.actionInput} type="date" value={acaoData} onChange={(e) => setAcaoData(e.target.value)} />
                        </div>
                        <div>
                          <label className={styles.actionLabel}>Horário</label>
                          <input className={styles.actionInput} type="time" value={acaoHora} onChange={(e) => setAcaoHora(e.target.value)} />
                        </div>
                      </div>
                      <div className={styles.actionHint}>Reagendar mantém a consulta como agendada.</div>
                    </div>
                  )}
                </div>

                <div className={styles.actionFooter}>
                  <button className={styles.actionBtnSecondary} onClick={() => setAcaoConsulta(null)} disabled={acaoLoading}>Cancelar</button>
                  <button className={styles.actionBtnPrimary} onClick={executarAcaoConsulta} disabled={acaoLoading}>
                    {acaoLoading ? 'Salvando...' : 'Confirmar'}
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className={`${styles.panel} ${styles.tableCard}`}>
            <div className={styles.panelHeader}>
              <h3>Estoque</h3>
              <a className={styles.panelLink} href="/estoque">Ver todos ›</a>
            </div>
            <div className={styles.tableCardInner} style={{overflowX:'auto'}}>
              <table className={`${styles.tableCardTable} ${styles.estoqueTable}`}>
                <thead>
                  <tr><th>Produto</th><th>Quantidade</th><th>Status</th></tr>
                </thead>
                <tbody>
                  {estoque.slice(0, ESTOQUE_ROWS).map(p => (
                    <tr key={p.id}>
                      <td>{p.nome}</td>
                      <td>{p.quantidade}</td>
                      <td>
                        {(() => {
                          const q = Number(p?.quantidade || 0)
                          const min = Number(p?.quantidade_minima || 0)
                          const low = Number.isFinite(q) && Number.isFinite(min) && q <= min
                          return (
                            <span className={`${styles.badge} ${low ? styles.badgeWarning : styles.badgeSuccess}`}>
                              {low ? 'Baixo estoque' : 'Em estoque'}
                            </span>
                          )
                        })()}
                      </td>
                    </tr>
                  ))}

                  {/* Mantém sempre 5 linhas visíveis, sem crescer o card */}
                  {Array.from({ length: Math.max(0, ESTOQUE_ROWS - estoque.slice(0, ESTOQUE_ROWS).length) }).map((_, i) => (
                    <tr key={`estoque-placeholder-${i}`} className={styles.estoquePlaceholderRow}>
                      <td>—</td>
                      <td>—</td>
                      <td>—</td>
                    </tr>
                  ))}

                  {/* Linha extra fixa para indicar que existem mais itens */}
                  {(() => {
                    const outrosCount = Math.max(0, (estoque?.length || 0) - ESTOQUE_ROWS)
                    return (
                      <tr key="estoque-outros" className={styles.estoqueOutrosRow}>
                        <td>Outros</td>
                        <td>{outrosCount > 0 ? `+${outrosCount} produtos` : '—'}</td>
                        <td>
                          {outrosCount > 0 ? (
                            <a className={styles.panelLink} href="/estoque">Ver todos ›</a>
                          ) : (
                            '—'
                          )}
                        </td>
                      </tr>
                    )
                  })()}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        
        <div className={styles.fullWidthChart}>
          <div className={styles.chartsGrid}>
            <div className={`${styles.panel} ${styles.chartCard}`}>
              <h3>Receita diária</h3>
              <div className={styles.tableCardInner}>
                <div className={reportStyles.cardHeader}>
                  <div className={reportStyles.cardTitleWrap}>
                    <div className={reportStyles.cardSubtitle}>Hora × Receita (08h–17h)</div>
                  </div>

                  <div className={reportStyles.cardControls}>
                    <div className={reportStyles.metricValueMuted}>{new Date().toLocaleDateString('pt-BR')}</div>
                  </div>
                </div>

                <div className={reportStyles.metricsRow}>
                  <div className={reportStyles.metricItem}>
                    <div className={reportStyles.metricLabel}>Total do dia</div>
                    <div className={reportStyles.metricValue}>
                      {formatMoney((receitaDiaHoras || []).reduce((s, v) => s + Number(v || 0), 0))}
                    </div>
                  </div>
                  <div className={reportStyles.metricItem}>
                    <div className={reportStyles.metricLabel}>Dia</div>
                    <div className={reportStyles.metricValueMuted}>{new Date(`${dailyChartDate}T00:00:00`).toLocaleDateString('pt-BR')}</div>
                  </div>
                </div>

                <div className={reportStyles.chartPlaceholder}>
                  {dailyChartLoading ? (
                    <div className={reportStyles.chartMessage}>Carregando gráfico…</div>
                  ) : dailyChartError ? (
                    <div className={reportStyles.chartMessageError}>{dailyChartError}</div>
                  ) : (
                    <DailyHourChart data={receitaDiaHoras} startHour={HOUR_START} />
                  )}
                </div>
              </div>
            </div>

            <div className={`${styles.panel} ${styles.chartCard}`}>
              <h3>Receita mensal</h3>
              <div className={styles.tableCardInner}>
                <div className={reportStyles.cardHeader}>
                  <div className={reportStyles.cardTitleWrap}>
                    <div className={reportStyles.cardSubtitle}>Relatório mensal • receita agrupada por semana</div>
                  </div>

                  <div className={reportStyles.cardControls}>
                    <div className={reportStyles.metricValueMuted}>{monthlyChartMonth}</div>
                  </div>
                </div>

                <div className={reportStyles.metricsRow}>
                  <div className={reportStyles.metricItem}>
                    <div className={reportStyles.metricLabel}>Total do mês</div>
                    <div className={reportStyles.metricValue}>
                      {formatMoney((monthlyChartWeeks || []).reduce((s, w) => s + Number(w?.total || 0), 0))}
                    </div>
                  </div>
                  <div className={reportStyles.metricItem}>
                    <div className={reportStyles.metricLabel}>Mês</div>
                    <div className={reportStyles.metricValueMuted}>{monthlyChartMonth}</div>
                  </div>
                </div>

                <div className={reportStyles.chartPlaceholder}>
                  {monthlyChartLoading ? (
                    <div className={reportStyles.chartMessage}>Carregando gráfico…</div>
                  ) : monthlyChartError ? (
                    <div className={reportStyles.chartMessageError}>{monthlyChartError}</div>
                  ) : (
                    <div className={reportStyles.chartStack}>
                      <MonthlyWeeksChartRecharts weeks={monthlyChartWeeks} />
                      <div className={reportStyles.chartFootnote}>
                        {(() => {
                          const list = (monthlyChartWeeks || []).map(w => ({ label: w?.label, total: Number(w?.total || 0) }))
                          const max = Math.max(...list.map(x => x.total), 0)
                          if (max <= 0) return 'Sem receitas (consultas realizadas/pagas) para o período selecionado.'
                          const bestWeek = list.slice().sort((a, b) => (b.total || 0) - (a.total || 0))[0]
                          return bestWeek ? `A ${bestWeek.label} foi a mais lucrativa, com ${formatMoney(bestWeek.total)}.` : 'Sem dados para o período selecionado.'
                        })()}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function DailyHourChart({ data, startHour = 8 }) {
  const values = Array.isArray(data) ? data : []
  const maxRaw = Math.max(...values.map(v => Number(v || 0)), 0)

  if (maxRaw <= 0) {
    return <div className={reportStyles.chartMessage}>Sem receita para o período</div>
  }

  const chartData = values.map((v, i) => ({
    hora: String(startHour + i).padStart(2, '0'),
    valor: Number(v || 0)
  }))

  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={chartData} margin={{ top: 10, right: 16, left: 6, bottom: 8 }}>
        <CartesianGrid stroke="#e5e7eb" />
        <XAxis dataKey="hora" tick={{ fontSize: 12, fill: '#374151' }} />
        <YAxis tickFormatter={formatMoneyCompact} tick={{ fontSize: 11, fill: '#6b7280' }} width={64} />
        <Tooltip formatter={(value) => formatMoneyCompact(value)} labelFormatter={(label) => `${label}h`} />
        <Bar dataKey="valor" fill="#365c52" radius={[8, 8, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

function MonthlyWeeksChartRecharts({ weeks }) {
  const weekTotals = Array.isArray(weeks) ? weeks : []
  const values = weekTotals.map(w => Number(w?.total || 0))
  const maxRaw = Math.max(...values, 0)

  if (maxRaw <= 0) {
    return <div className={reportStyles.chartMessage}>Sem receita para o período</div>
  }

  const chartData = weekTotals.map(w => ({
    semana: String(w?.label || ''),
    total: Number(w?.total || 0)
  }))

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={chartData} margin={{ top: 10, right: 16, left: 6, bottom: 8 }}>
        <CartesianGrid stroke="#e5e7eb" />
        <XAxis dataKey="semana" tick={{ fontSize: 12, fill: '#374151' }} />
        <YAxis tickFormatter={formatMoneyCompact} tick={{ fontSize: 11, fill: '#6b7280' }} width={64} />
        <Tooltip formatter={(value) => formatMoneyCompact(value)} />
        <Bar dataKey="total" fill="#365c52" radius={[8, 8, 0, 0]}>
          <LabelList dataKey="total" content={MoneyLabelContent} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
