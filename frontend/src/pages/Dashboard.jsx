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
import BreadcrumbTitle from '@components/common/BreadcrumbTitle'

const formatMoneyCompact = (v) => `R$ ${Number(v || 0).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`

const formatMonthLabelPtBr = (ym) => {
  const [y, m] = String(ym || '').split('-').map(Number)
  if (!y || !m) return String(ym || '')
  const dt = new Date(y, m - 1, 1)
  try {
    const text = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(dt)
    // normalize to Title Case-ish for UI ("janeiro de 2026" -> "Janeiro 2026")
    const cleaned = String(text).replace(/\s+de\s+/i, ' ').trim()
    return cleaned.charAt(0).toUpperCase() + cleaned.slice(1)
  } catch {
    const mm = String(m).padStart(2, '0')
    return `${y}-${mm}`
  }
}

const formatLongDatePtBr = (ymd) => {
  try {
    const raw = String(ymd || '')
    if (!raw) return ''
    const dt = new Date(`${raw}T00:00:00`)
    if (Number.isNaN(dt.getTime())) return raw
    return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }).format(dt)
  } catch {
    return String(ymd || '')
  }
}

function MoneyLabelContent(props) {
  const { x, y, width, value } = props || {}
  const n = Number(value || 0)
  if (!Number.isFinite(n) || n <= 0) return null
  const cx = Number(x || 0) + Number(width || 0) / 2
  const cy = Number(y || 0) - 6
  return (
    <text x={cx} y={cy} textAnchor="middle" fontSize={10} fill="var(--text, #111827)">
      {formatMoneyCompact(n)}
    </text>
  )
}

export default function Dashboard() {
  const { user } = useAuth()
  const role = String(user?.role || '').toLowerCase()
  const isRecepcao = role === 'recepcao'
  const [_alertas, setAlertas] = useState([])
  const [receita, setReceita] = useState(0)
  const [totalPacientes, setTotalPacientes] = useState(0)
  const [consultasAll, setConsultasAll] = useState([])
  const [proximas, setProximas] = useState([])
  const [estoque, setEstoque] = useState([])
  const [consultasAgendadasHoje, setConsultasAgendadasHoje] = useState(0)
  const [consultasAgendadasTotal, setConsultasAgendadasTotal] = useState(0)
  const [suppressAgendadasUntil, _setSuppressAgendadasUntil] = useState(0)
  const [_pacientes, setPacientes] = useState([])
  const [loading, setLoading] = useState(true)

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

  const [keepProximasUntil, setKeepProximasUntil] = useState(() => ({}))
  const keepProximasUntilRef = useRef({})
  useEffect(() => {
    keepProximasUntilRef.current = keepProximasUntil || {}
  }, [keepProximasUntil])

  const carregarDadosRef = useRef(null)
  const carregarReceitaPorHoraRef = useRef(null)
  const carregarReceitaMensalSemanasRef = useRef(null)

  const ESTOQUE_ROWS = 4
  const PROXIMAS_ROWS = 4

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
    const st = String(c?.status || '').toLowerCase()
    return Boolean(c?.pago) || st === 'realizada' || st === 'feita'
  }

  const normalizeStatus = (s) => String(s || '').trim().toLowerCase()

  const getStatusUi = (consulta) => {
    const st = normalizeStatus(consulta?.status)

    if (st === 'feita' || st === 'realizada') return { label: 'Feita', tone: 'done' }
    if (st === 'cancelada') return { label: 'Cancelada', tone: 'cancel' }
    if (st === 'falta') return { label: 'Falta', tone: 'miss' }

    const conf = normalizeStatus(consulta?.confirmacao_status || consulta?.status_confirmacao || consulta?.confirmacao)
    const confirmed = conf === 'confirmado' || consulta?.confirmado === true || String(consulta?.confirmado) === '1'
    if (confirmed) return { label: 'Confirmado', tone: 'ok' }
    if (conf === 'aguardando' || conf === 'pendente') return { label: 'Aguardando', tone: 'warn' }

    return { label: 'Agendado', tone: 'muted' }
  }

  const getProcedureLabel = (consulta) => {
    const pacienteNome = String(consulta?.paciente_nome || '').trim()
    const pacienteNomeNorm = pacienteNome.toLowerCase()

    const isValidCandidate = (value) => {
      const v = String(value || '').trim()
      if (!v) return false
      if (pacienteNomeNorm && v.toLowerCase() === pacienteNomeNorm) return false
      return true
    }

    const procedimentos = consulta?.procedimentos
    const fromArray = (arr) => {
      if (!Array.isArray(arr) || !arr.length) return ''
      const first = arr[0]
      if (typeof first === 'string') return first
      if (first && typeof first === 'object') {
        return String(first.nome || first.titulo || first.descricao || '').trim()
      }
      return ''
    }

    if (Array.isArray(procedimentos)) {
      const v = fromArray(procedimentos)
      if (isValidCandidate(v)) return String(v).trim()
    }

    if (typeof procedimentos === 'string' && procedimentos.trim()) {
      const raw = procedimentos.trim()
      if (raw.startsWith('[') || raw.startsWith('{')) {
        try {
          const parsed = JSON.parse(raw)
          const v = fromArray(parsed)
          if (isValidCandidate(v)) return String(v).trim()
        } catch {
          // ignore parse errors
        }
      }
    }

    const tipo = String(consulta?.tipo_consulta || '').trim()
    if (tipo) {
      const tipoNorm = tipo.toLowerCase()
      if (tipoNorm !== 'geral' && isValidCandidate(tipo)) return tipo

      const descricao = String(consulta?.descricao || '').trim()
      if (isValidCandidate(descricao)) return descricao

      // if tipo is 'geral', keep it; if tipo is invalid (ex: equals paciente), fall back to 'geral'
      return tipoNorm === 'geral' ? tipo : 'geral'
    }

    const descricao = String(consulta?.descricao || '').trim()
    if (isValidCandidate(descricao)) return descricao

    return 'geral'
  }

  const timeRangeLabel = (consulta) => {
    try {
      const dt = new Date(consulta?.data_hora)
      if (Number.isNaN(dt.getTime())) return '—'
      const duration = Number(consulta?.duracao_minutos || 60)
      const start = dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
      const endDt = new Date(dt.getTime() + (Number.isFinite(duration) ? duration : 60) * 60000)
      const end = endDt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
      return `${start} - ${end}`
    } catch {
      return '—'
    }
  }

  const dayHintLabel = (consulta) => {
    try {
      const dt = new Date(consulta?.data_hora)
      if (Number.isNaN(dt.getTime())) return ''
      const ymd = dt.toISOString().split('T')[0]
      const today = new Date().toISOString().split('T')[0]
      if (ymd === today) return 'Hoje'
      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      if (ymd === tomorrow) return 'Amanhã'
      return dt.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
    } catch {
      return ''
    }
  }

  const mergePinnedProximas = (incoming, previous) => {
    const list = Array.isArray(incoming) ? incoming : []
    const prev = Array.isArray(previous) ? previous : []
    const keepMap = keepProximasUntilRef.current || {}
    const now = Date.now()

    const byId = new Map()
    list.forEach((c) => {
      if (c?.id == null) return
      byId.set(String(c.id), c)
    })

    Object.entries(keepMap).forEach(([id, until]) => {
      const untilMs = Number(until || 0)
      if (!Number.isFinite(untilMs) || untilMs <= now) return
      if (byId.has(String(id))) return
      const existing = prev.find((c) => String(c?.id) === String(id))
      if (!existing) return
      byId.set(String(id), existing)
    })

    return Array.from(byId.values()).sort((a, b) => {
      const ta = new Date(a?.data_hora || 0).getTime()
      const tb = new Date(b?.data_hora || 0).getTime()
      return ta - tb
    })
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
        setConsultasAgendadasHoje(0)
        setConsultasAgendadasTotal(0)
        setKeepProximasUntil({})
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
      setProximas((prev) => mergePinnedProximas(dashboard.next_consultas || [], prev))

      // prepare local accumulators for daily values so we can persist them reliably
      let newReceita = dashboard.receita_hoje || 0
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

        // Importante: este card não deve diminuir ao finalizar uma consulta.
        // Portanto, consideramos tanto 'agendada' quanto as concluídas ('realizada'/'feita') nas contagens.
        const countedStatuses = new Set(['agendada', 'realizada', 'feita'])
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
        saveSavedDaily({ date: today, receita: newReceita, consultasAgendadasHoje: newAgendadasHoje, consultasAgendadasTotal: newAgendadasTotal })
      } catch { /* ignore */ }
      // set receita finally
      setReceita(newReceita)
      setPacientes(dashboard.recent_pacientes || [])
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
        // Backend pode passar a usar 'feita'. Mantém compatibilidade com versões antigas.
        try {
          await consultasService.atualizar(acaoConsulta.id, { status: 'feita', pago: acaoPago ? 1 : 0 })
        } catch {
          await consultasService.atualizar(acaoConsulta.id, { status: 'realizada', pago: acaoPago ? 1 : 0 })
        }

        // Mantém a consulta na lista de próximas até virar o dia (apenas muda o status no UI)
        const now = new Date()
        const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
        const until = nextMidnight.getTime()
        setKeepProximasUntil((prev) => ({ ...(prev || {}), [String(acaoConsulta.id)]: until }))
        setProximas((prev) => (prev || []).map((c) => {
          if (String(c?.id) !== String(acaoConsulta.id)) return c
          return { ...c, status: 'feita' }
        }))
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
          <div className={styles.pageHeader}>
            <div className={styles.pageHeaderLeft}>
              <BreadcrumbTitle current="Dashboard" />
              <h1 className={styles.pageTitle}>Resumo Geral</h1>
            </div>

            <div className={styles.pageHeaderRight}>
              <div className={styles.datePill} aria-label="Data do relatório">
                <span className={styles.datePillIcon} aria-hidden="true">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="5" width="18" height="16" rx="2" />
                    <path d="M16 3v4" />
                    <path d="M8 3v4" />
                    <path d="M3 11h18" />
                  </svg>
                </span>
                {formatLongDatePtBr(dailyChartDate)}
              </div>
            </div>
          </div>
          <p className={styles.welcome}>Bem-vindo de volta, {user?.nome}!</p>

          <div className={isRecepcao ? `${styles.topStatsRow} ${styles.topStatsRowTwo}` : styles.topStatsRow}>
            {!isRecepcao && (
              <>
                <div className={styles.smallCard}>
                  <div className={styles.smallTitle}>
                    <span className={`${styles.smallIcon} ${styles.iconMoney}`}><StatIcon name="money" /></span>
                    Receita Diária
                  </div>
                  <div className={styles.smallValue}>R$ {Number(receita).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                  <div className={styles.smallMeta}>R$ {Number(receita).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} hoje</div>
                </div>

                <div className={styles.smallCard}>
                  <div className={styles.smallTitle}>
                    <span className={`${styles.smallIcon} ${styles.iconMoney}`}><StatIcon name="money" /></span>
                    Receita Mensal
                  </div>
                  <div className={styles.smallValue}>{formatMoney((monthlyChartWeeks || []).reduce((s, w) => s + Number(w?.total || 0), 0))}</div>
                  <div className={styles.smallMeta}>{formatMonthLabelPtBr(monthlyChartMonth)}</div>
                </div>
              </>
            )}

            <div className={`${styles.smallCard} ${styles.agendadasCard}`}>
              <div className={styles.smallTitle}>
                <span className={`${styles.smallIcon} ${styles.iconCalendar}`}><StatIcon name="calendar" /></span>
                Consultas
              </div>

              <div className={styles.splitMetrics}>
                <div className={styles.splitMetricCol}>
                  <div className={styles.splitMetricValue}>{consultasAgendadasHoje}</div>
                  <div className={styles.splitMetricLabel}>Hoje</div>
                </div>

                <div className={styles.splitMetricDivider} aria-hidden="true" />

                <div className={styles.splitMetricCol}>
                  <div className={styles.splitMetricValue}>{consultasAgendadasTotal}</div>
                  <div className={styles.splitMetricLabel}>Mês</div>
                </div>
              </div>
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
      </header>
      <div className={styles.mainGrid}>
        <div className={styles.topPanels}>
          <div className={`${styles.panel} ${styles.tableCard}`}>
            <div className={styles.panelHeader}>
              <div className={styles.panelHeaderText}>
                <h3>Próximas Consultas</h3>
                <div className={styles.panelSub}>Agendamentos para os próximos 2 dias</div>
              </div>
              <a className={styles.panelLink} href="/agenda">Ver todas →</a>
            </div>
            <div className={styles.tableCardInner}>
              <table className={`${styles.tableCardTable} ${styles.proximasTable}`}>
                <thead>
                  <tr>
                    <th>Paciente</th>
                    <th>Horário</th>
                    <th>Procedimento</th>
                    <th>Status</th>
                    <th className={styles.actionTh}>Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {(proximas || []).slice(0, PROXIMAS_ROWS).map(c => {
                    const statusUi = getStatusUi(c)
                    const isDone = statusUi.tone === 'done'

                    return (
                      <tr key={c.id} className={isDone ? styles.rowDone : ''}>
                        <td>
                          <div className={styles.patientNameOnly}>{c?.paciente_nome || '—'}</div>
                        </td>

                        <td>
                          <div className={styles.timeCell2}>
                            <div className={styles.timeRange}>{timeRangeLabel(c)}</div>
                            <div className={styles.dayHint}>{dayHintLabel(c)}</div>
                          </div>
                        </td>

                        <td>
                          <span className={styles.procPill}>{getProcedureLabel(c)}</span>
                        </td>

                        <td>
                          <span className={styles.statusWrap}>
                            <span className={`${styles.statusDot} ${styles[`statusDot_${statusUi.tone}`]}`} aria-hidden="true" />
                            <span className={`${styles.statusText} ${styles[`statusText_${statusUi.tone}`]}`}>{statusUi.label}</span>
                          </span>
                        </td>

                        <td className={styles.actionTd}>
                          <button
                            type="button"
                            className={styles.kebabBtn}
                            onClick={() => finalizarConsulta(c)}
                            aria-label="Ações da consulta"
                            title="Ações"
                          >
                            <span className={styles.kebabIcon} aria-hidden="true">⋮</span>
                          </button>
                        </td>
                      </tr>
                    )
                  })}
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
                    <label><input type="radio" name="acao" checked={acaoTipo === 'realizada'} onChange={() => setAcaoTipo('realizada')} /> Feita</label>
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
              <a className={styles.panelLink} href="/estoque">Ver todos →</a>
            </div>
            <div className={styles.tableCardInner}>
              <table className={`${styles.tableCardTable} ${styles.estoqueTable}`}>
                <thead>
                  <tr><th>Produto</th><th>Quantidade</th><th>Ação</th></tr>
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
                            <div className={styles.stockAction}>
                              <span className={`${styles.badge} ${low ? styles.badgeWarning : styles.badgeSuccess}`}>
                                {low ? 'Baixo estoque' : 'Em estoque'}
                              </span>
                              <span className={styles.chevron} aria-hidden="true">›</span>
                            </div>
                          )
                        })()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {!isRecepcao && (
          <div className={styles.fullWidthChart}>
            <div className={styles.chartsGrid}>
              <div className={`${styles.panel} ${styles.chartCard}`}>
                <h3>Receita Diária</h3>
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
                <h3>Receita Mensal</h3>
                <div className={styles.tableCardInner}>
                  <div className={reportStyles.cardHeader}>
                    <div className={reportStyles.cardTitleWrap}>
                      <div className={reportStyles.cardSubtitle}>Relatório Mensal • receita agrupada por semana</div>
                    </div>

                    <div className={reportStyles.cardControls}>
                        <div className={reportStyles.metricValueMuted}>{formatMonthLabelPtBr(monthlyChartMonth)}</div>
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
                      <div className={reportStyles.metricValueMuted}>{formatMonthLabelPtBr(monthlyChartMonth)}</div>
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
        )}
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
