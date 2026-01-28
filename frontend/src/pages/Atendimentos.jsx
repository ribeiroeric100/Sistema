import { estoqueService, relatoriosService, configuracoesService } from '@services/api'
import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'
import { useEffect, useRef, useState } from 'react'
import logoFallback from '../assets/dr-neto-logo.png'
import logoPdf from '../assets/logo_pdf.png'
import BreadcrumbTitle from '@components/common/BreadcrumbTitle'
import styles from './Relatorios.module.css'
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

export default function Relatorios() {
  const [, setDailyReceitas] = useState([]) // [{dia, total}]
  const [receitaHojeHoras, setReceitaHojeHoras] = useState(new Array(10).fill(0))
  const [recentConsultas, setRecentConsultas] = useState([])
  const [procedimentos, setProcedimentos] = useState([])
  const [consultasAll, setConsultasAll] = useState([])

  const [showAllConsultas, setShowAllConsultas] = useState(false)
  const [showAllProcedimentos, setShowAllProcedimentos] = useState(false)

  // Filtros (futuro) para a visualização dos gráficos na tela
  const [dailyChartDate, setDailyChartDate] = useState(() => new Date().toISOString().split('T')[0])
  const [dailyChartDateInput, setDailyChartDateInput] = useState(() => new Date().toISOString().split('T')[0])
  const [dailyChartLoading, setDailyChartLoading] = useState(false)
  const [dailyChartError, setDailyChartError] = useState('')

  const [monthlyChartMonth, setMonthlyChartMonth] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })
  const [monthlyChartMonthInput, setMonthlyChartMonthInput] = useState(() => {
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

  const [reportPeriodType, setReportPeriodType] = useState('diario')
  const [reportDate, setReportDate] = useState(new Date().toISOString().split('T')[0])
  const [reportWeekStart, setReportWeekStart] = useState(() => {
    const d = new Date()
    const day = d.getDay()
    const diffToMonday = (day + 6) % 7
    const monday = new Date(d)
    monday.setDate(d.getDate() - diffToMonday)
    return monday.toISOString().split('T')[0]
  })
  const [reportWeekEnd, setReportWeekEnd] = useState(() => {
    const d = new Date()
    const day = d.getDay()
    const diffToMonday = (day + 6) % 7
    const monday = new Date(d)
    monday.setDate(d.getDate() - diffToMonday)
    const sunday = new Date(monday)
    sunday.setDate(monday.getDate() + 6)
    return sunday.toISOString().split('T')[0]
  })
  const [reportMonth, setReportMonth] = useState(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}` })

  const carregarRelatoriosRef = useRef(null)
  const carregarReceitaPorHoraRef = useRef(null)
  const carregarReceitaMensalSemanasRef = useRef(null)

  useEffect(() => {
    carregarRelatoriosRef.current?.()
  }, [])

  useEffect(() => {
    // polling somente quando o dia selecionado for "hoje"
    const iv = setInterval(() => {
      const hoje = new Date().toISOString().split('T')[0]
      if (dailyChartDate === hoje) carregarReceitaPorHoraRef.current?.(hoje)
    }, 10000)
    return () => clearInterval(iv)
  }, [dailyChartDate])

  useEffect(() => {
    setDailyChartDateInput(dailyChartDate)
    carregarReceitaPorHoraRef.current?.(dailyChartDate)
  }, [dailyChartDate])

  useEffect(() => {
    setMonthlyChartMonthInput(monthlyChartMonth)
    carregarReceitaMensalSemanasRef.current?.(monthlyChartMonth)
  }, [monthlyChartMonth])

  const HOUR_START = 8
  const HOUR_END = 17

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
    // Na prática, muitas vezes o usuário marca "realizada" mas não marca "pago".
    // Para os gráficos de receita na tela, vamos considerar receita quando:
    // - pago = 1 OU
    // - status = 'realizada'
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

  async function carregarReceitaPorHora(diaYmd) {
    setDailyChartLoading(true)
    setDailyChartError('')
    try {
      const ymd = String(diaYmd || '')
      if (!ymd) throw new Error('Selecione um dia válido')
      const dayRows = filterConsultasByRange(consultasAll, ymd, ymd)
      const horas = computeHourTotals(dayRows)
      setReceitaHojeHoras(horas)
    } catch (err) {
      setReceitaHojeHoras(new Array(10).fill(0))
      setDailyChartError(err?.message || String(err || 'Erro ao carregar gráfico diário'))
    } finally {
      setDailyChartLoading(false)
    }
  }

  carregarReceitaPorHoraRef.current = carregarReceitaPorHora

  async function carregarReceitaMensalSemanas(ym) {
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

  async function carregarRelatorios() {
    try {
      const daily = await relatoriosService.dailyReceitas().catch(() => null)
      if (daily) setDailyReceitas(daily || [])

      // consultas recentes
      let consultas = null
      try {
        const ag = await relatoriosService.agendamentos()
        consultas = ag?.consultas
      } catch (e) {
        // Importante: NÃO limpar a tela quando o backend oscila.
        // Mantém o último dataset válido para evitar o gráfico "sumir".
        console.warn('Falha ao buscar agendamentos para relatórios', e)
      }

      if (Array.isArray(consultas)) {
        setConsultasAll(consultas)

        const consultasOrdenadas = (consultas || []).slice().sort((a, b) => {
          const da = new Date(a?.data_hora || a?.data)
          const db = new Date(b?.data_hora || b?.data)
          return (db.getTime() || 0) - (da.getTime() || 0)
        })
        setRecentConsultas(consultasOrdenadas)

        // procedimentos: agregação por procedimento (top 3)
        const counts = {}
        ;(consultas || []).forEach(c => {
          let list = []

          const v = c?.procedimentos
          if (v) {
            if (typeof v === 'string') {
              try {
                const parsed = JSON.parse(v)
                if (Array.isArray(parsed)) list = parsed
                else list = [parsed]
              } catch {
                list = [v]
              }
            } else if (Array.isArray(v)) {
              list = v
            } else {
              list = [v]
            }
          }

          const names = list
            .map(p => (p && typeof p === 'object') ? (p.descricao || p.nome) : String(p || ''))
            .flatMap(s => String(s || '').split(',').map(x => x.trim()).filter(Boolean))

          if (names.length === 0) names.push(c?.tipo_consulta || 'Outros')

          names.forEach(nome => {
            const key = nome || 'Outros'
            counts[key] = (counts[key] || 0) + 1
          })
        })

        const procArr = Object.entries(counts)
          .map(([nome, total]) => ({ id: nome, nome, total }))
          .sort((a, b) => b.total - a.total)

        setProcedimentos(procArr)
      }
    } catch (err) {
      console.error('Erro ao carregar relatórios', err)
    }
  }

  carregarRelatoriosRef.current = carregarRelatorios

  useEffect(() => {
    // Quando atualiza a lista de consultas, recalcula os gráficos
    if (!Array.isArray(consultasAll) || consultasAll.length === 0) {
      // se não há consultas, ainda assim deixa os gráficos no estado vazio
      carregarReceitaPorHoraRef.current?.(dailyChartDate)
      carregarReceitaMensalSemanasRef.current?.(monthlyChartMonth)
      return
    }
    carregarReceitaPorHoraRef.current?.(dailyChartDate)
    carregarReceitaMensalSemanasRef.current?.(monthlyChartMonth)
  }, [consultasAll, dailyChartDate, monthlyChartMonth])

  // Generate a PDF report for the selected period (diario, semanal, mensal)
  async function gerarPDF() {
    try {
      const formatBRDate = (iso) => {
        try {
          const d = new Date(iso)
          return d.toLocaleDateString('pt-BR')
        } catch {
          return String(iso || '')
        }
      }
      const formatMoney = (v) => `R$ ${Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
      const formatWeekdayShort = (ymd) => {
        try {
          const d = new Date(`${ymd}T00:00:00`)
          const map = ['Dom.', 'Seg.', 'Ter.', 'Qua.', 'Qui.', 'Sex.', 'Sáb.']
          return map[d.getDay()] || ''
        } catch {
          return ''
        }
      }

      let start, end, label
      if (reportPeriodType === 'diario') {
        start = reportDate
        end = reportDate
        label = `diario_${start}`
      } else if (reportPeriodType === 'semanal') {
        start = reportWeekStart
        end = reportWeekEnd
        label = `semanal_${start}_a_${end}`
      } else {
        // mensal: reportMonth like YYYY-MM
        const [y, m] = reportMonth.split('-').map(Number)
        start = new Date(y, m-1, 1).toISOString().split('T')[0]
        end = new Date(y, m, 0).toISOString().split('T')[0]
        label = `mensal_${y}-${String(m).padStart(2,'0')}`
      }

      // Configurações da clínica (nome/rodapé) para personalizar o PDF
      let clinicName = ''
      let pdfFooterText = ''
      try {
        const cfg = await configuracoesService.buscar().catch(() => null)
        if (cfg?.nome_clinica) clinicName = String(cfg.nome_clinica)
        if (cfg?.rodape_pdf) pdfFooterText = String(cfg.rodape_pdf)
      } catch {
        // ignore
      }

      // Para o relatório diário precisamos das consultas COMPLETAS do período,
      // não apenas as pagas (o endpoint /relatorios/receita filtra pago=1).
      const toYMDLocal = (dateLike) => {
        const dt = new Date(dateLike)
        if (Number.isNaN(dt.getTime())) return ''
        const y = dt.getFullYear()
        const m = String(dt.getMonth() + 1).padStart(2, '0')
        const d = String(dt.getDate()).padStart(2, '0')
        return `${y}-${m}-${d}`
      }

      const ag = await relatoriosService.agendamentos().catch(() => ({ consultas: [] }))
      const consultasAll = ag.consultas || []
      const consultas = consultasAll.filter(c => {
        const ymd = toYMDLocal(c?.data_hora || c?.data)
        if (!ymd) return false
        return ymd >= start && ymd <= end
      })

      // Mapa de produtos do estoque para resolver nomes quando vierem apenas IDs/tokens
      const produtos = await estoqueService.listar().catch(() => [])
      const produtoIdToNome = new Map(
        (Array.isArray(produtos) ? produtos : []).map(p => [String(p?.id ?? ''), String(p?.nome ?? '')])
      )

      // Horas (para gráfico diário): soma de receita por hora (apenas pago)
      const receitaHoras = new Array(24).fill(0)
      consultas.forEach(c => {
        if (c && c.pago) {
          const hour = new Date(c.data_hora || c.data).getHours()
          receitaHoras[hour] = (receitaHoras[hour] || 0) + Number(c.valor || 0)
        }
      })

      const consultasRealizadas = consultas.filter(c => (c && (c.status === 'realizada'))).length
      const receitaTotal = consultas.reduce((sum, c) => sum + (c && c.pago ? Number(c.valor || 0) : 0), 0)

      const safeText = (t) => String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      const normalizeStatus = (s) => String(s || '').trim().toLowerCase()
      const statusBadgeHtml = (status) => {
        const st = normalizeStatus(status)
        if (!st || st === '-') return '-'
        const map = {
          pago: { cls: 'r-status--pago', label: 'pago' },
          falta: { cls: 'r-status--falta', label: 'falta' },
          cancelada: { cls: 'r-status--cancelada', label: 'cancelada' },
          agendada: { cls: 'r-status--agendada', label: 'agendada' },
          realizada: { cls: 'r-status--realizada', label: 'realizada' }
        }
        const meta = map[st] || { cls: 'r-status--outro', label: st }
        return `<span class="r-status ${meta.cls}">${safeText(meta.label)}</span>`
      }
      const isContabilizadaParaTabelas = (c) => {
        // Para tabelas subsequentes (procedimentos/materiais), contabilizar apenas
        // consultas realizadas (e/ou pagas) e excluir faltas/cancelamentos.
        const st = normalizeStatus(c?.status)
        if (st === 'falta' || st === 'cancelada') return false
        return st === 'realizada' || Boolean(c?.pago)
      }

      // procedures and materials aggregation
      // Procedimentos: { nome -> { quantidade, total } }
      const procAgg = {}
      // Materiais: { nome -> quantidade }
      const matAgg = {}
      let totalMateriais = 0

      consultas.forEach(c => {
        if (!c) return
        if (!isContabilizadaParaTabelas(c)) return

        // procedimentos
        let procedimentos = c.procedimentos
        if (procedimentos && typeof procedimentos === 'string') {
          try { procedimentos = JSON.parse(procedimentos) } catch { procedimentos = [procedimentos] }
        }
        const procList = Array.isArray(procedimentos)
          ? procedimentos
          : (procedimentos ? [procedimentos] : [])

        if (procList.length) {
          procList.forEach(p => {
            const nome = (p && (p.descricao || p.nome)) ? (p.descricao || p.nome) : String(p || 'Procedimento')
            const valorProc = (p && (p.valor !== undefined) && p.valor !== null) ? Number(p.valor) : 0
            procAgg[nome] = procAgg[nome] || { quantidade: 0, total: 0 }
            procAgg[nome].quantidade += 1
            procAgg[nome].total += Number.isFinite(valorProc) ? valorProc : 0
          })
        } else {
          const nome = c.tipo_consulta || 'Procedimento'
          const valorC = Number(c.valor || 0)
          procAgg[nome] = procAgg[nome] || { quantidade: 0, total: 0 }
          procAgg[nome].quantidade += 1
          // se não há lista de procedimentos, usar valor da consulta como total do procedimento
          procAgg[nome].total += Number.isFinite(valorC) ? valorC : 0
        }

        // materiais
        let materiais = c.materiais
        if (materiais && typeof materiais === 'string') {
          try { materiais = JSON.parse(materiais) } catch { materiais = [materiais] }
        }
        const matList = Array.isArray(materiais)
          ? materiais
          : (materiais ? [materiais] : [])

        matList.forEach(m => {
          const isObj = m && typeof m === 'object'
          const explicitName = isObj ? (m.nome || m.produto_nome) : ''
          const rawId = isObj ? (m.produto_id || m.id) : m
          const idKey = rawId !== undefined && rawId !== null ? String(rawId) : ''
          const resolvedName = idKey ? (produtoIdToNome.get(idKey) || '') : ''
          const nome = explicitName || resolvedName || (idKey || 'Material')

          const qtdRaw = isObj ? m.quantidade : 1
          const qtd = Number(qtdRaw || 0)
          const add = Number.isFinite(qtd) ? qtd : 0
          if (add <= 0) return

          matAgg[nome] = (matAgg[nome] || 0) + add
          totalMateriais += add
        })
      })

      const procRows = Object.entries(procAgg)
        .map(([nome, v]) => ({ nome, quantidade: v.quantidade, total: v.total }))
        .sort((a, b) => b.quantidade - a.quantidade)
      const matRows = Object.entries(matAgg)
        .map(([nome, quantidade]) => ({ nome, quantidade }))
        .sort((a, b) => b.quantidade - a.quantidade)

      const toPieSegments = (rows, valueKey, maxSlices = 5) => {
        const list = (rows || [])
          .map(r => ({ nome: String(r?.nome ?? ''), value: Number(r?.[valueKey] ?? 0) }))
          .filter(r => r.nome && Number.isFinite(r.value) && r.value > 0)
          .sort((a, b) => b.value - a.value)

        const top = list.slice(0, maxSlices)
        const rest = list.slice(maxSlices)
        const restSum = rest.reduce((s, r) => s + r.value, 0)
        if (restSum > 0) top.push({ nome: 'Outros', value: restSum })
        return top
      }

      const buildPieChartSvg = (segments, opts = {}) => {
        const size = opts.size || 240
        const cx = size / 2
        const cy = size / 2
        const r = (size / 2) - 8

        // Give the SVG a little breathing room so text labels never get clipped
        // by the viewBox when rendered via html2canvas + jsPDF.
        const pad = 10

        const total = (segments || []).reduce((s, it) => s + Number(it.value || 0), 0) || 1
        const colors = opts.colors || ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd', '#17becf', '#8c564b']

        const polar = (angle) => ({ x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) })
        const arcPath = (startAngle, endAngle) => {
          const start = polar(startAngle)
          const end = polar(endAngle)
          const largeArc = (endAngle - startAngle) > Math.PI ? 1 : 0
          return `M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y} Z`
        }

        let angle = -Math.PI / 2
        const paths = []
        const labels = []

        segments.forEach((seg, i) => {
          const frac = Number(seg.value || 0) / total
          const next = angle + frac * Math.PI * 2
          const d = arcPath(angle, next)
          const fill = colors[i % colors.length]
          paths.push(`<path d="${d}" fill="${fill}" />`)

          // label (percent) on slice
          const mid = (angle + next) / 2
          const lr = r * 0.62
          const lx = cx + lr * Math.cos(mid)
          const ly = cy + lr * Math.sin(mid)
          const pct = Math.round(frac * 100)
          if (pct >= 6) {
            labels.push(`<text x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" font-size="12" fill="#111827" text-anchor="middle" dominant-baseline="middle">${pct}%</text>`)
          }

          angle = next
        })

        return `
          <svg viewBox="${-pad} ${-pad} ${size + pad * 2} ${size + pad * 2}" width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
            ${paths.join('')}
            ${labels.join('')}
          </svg>
        `
      }

      const buildLegendHtml = (segments, opts = {}) => {
        const colors = opts.colors || ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd', '#17becf', '#8c564b']
        const total = (segments || []).reduce((s, it) => s + Number(it.value || 0), 0) || 1
        return `
          <div class="r-legend">
            ${(segments || []).map((seg, i) => {
              const frac = Number(seg.value || 0) / total
              const pct = Math.round(frac * 100)
              return `
                <div class="r-legendRow">
                  <span class="r-dot" style="background:${colors[i % colors.length]}"></span>
                  <span class="r-legendName">${safeText(seg.nome)}</span>
                  <span class="r-legendPct">${pct}%</span>
                </div>
              `
            }).join('')}
          </div>
        `
      }

      const buildWeeklyRevenueSvg = (startYmd, endYmd) => {
        const startD = new Date(`${startYmd}T00:00:00`)
        const endD = new Date(`${endYmd}T00:00:00`)
        const days = []
        for (let d = new Date(startD); d <= endD; d.setDate(d.getDate() + 1)) {
          days.push(new Date(d))
        }
        const rows = days.map(d => {
          const ymd = d.toISOString().split('T')[0]
          const total = consultas
            .filter(c => {
              const cYmd = toYMDLocal(c?.data_hora || c?.data)
              return cYmd === ymd && c?.pago
            })
            .reduce((s, c) => s + Number(c?.valor || 0), 0)
          return { ymd, total }
        })

        const values = rows.map(r => Number(r.total || 0))
        const max = Math.max(...values, 1)

        const w = 620
        const h = 220
        const padX = 34
        const padTop = 18
        const padBottom = 32
        const innerW = w - padX * 2
        const innerH = h - padTop - padBottom

        const barW = innerW / Math.max(1, rows.length)
        const grid = []
        const yAxisLabels = []
        const yTicks = 4
        for (let i = 0; i <= yTicks; i++) {
          const y = padTop + innerH * (i / yTicks)
          grid.push(`<line x1="${padX}" y1="${y}" x2="${padX + innerW}" y2="${y}" stroke="#e5e7eb" stroke-width="1" />`)

          const tickValue = (max * (yTicks - i)) / yTicks
          const label = `R$ ${Number(tickValue || 0).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`
          yAxisLabels.push(`<text x="${(padX - 8).toFixed(2)}" y="${(y + 4).toFixed(2)}" font-size="10" fill="#6b7280" text-anchor="end">${label}</text>`)
        }

        const bars = rows.map((r, i) => {
          const v = Number(r.total || 0)
          const hh = (v / max) * innerH
          const x = padX + i * barW + (barW * 0.18)
          const bw = Math.max(6, barW * 0.64)
          const y = padTop + (innerH - hh)
          return `<rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${bw.toFixed(2)}" height="${hh.toFixed(2)}" fill="#365c52" rx="4" />`
        }).join('')

        const moneyCompact = (v) => {
          const n = Number(v || 0)
          return `R$ ${n.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`
        }

        const valuesText = rows.map((r, i) => {
          const v = Number(r.total || 0)
          if (!Number.isFinite(v) || v <= 0) return ''
          const hh = (v / max) * innerH
          const xCenter = padX + i * barW + (barW / 2)
          const yTop = padTop + (innerH - hh)
          const y = Math.max(padTop + 10, yTop - 6)
          return `<text x="${xCenter.toFixed(2)}" y="${y.toFixed(2)}" font-size="10" fill="#111827" text-anchor="middle">${moneyCompact(v)}</text>`
        }).join('')

        const labels = rows.map((r, i) => {
          const x = padX + i * barW + (barW / 2)
          const wd = formatWeekdayShort(r.ymd)
          return `<text x="${x.toFixed(2)}" y="${h - 10}" font-size="11" fill="#374151" text-anchor="middle">${safeText(wd)}</text>`
        }).join('')

        return `
          <svg viewBox="0 0 ${w} ${h}" width="100%" height="220" xmlns="http://www.w3.org/2000/svg">
            <rect x="0" y="0" width="${w}" height="${h}" fill="#ffffff" />
            ${grid.join('')}
            ${yAxisLabels.join('')}
            ${bars}
            ${valuesText}
            ${labels}
          </svg>
        `
      }

      // Receita por semana (1-7, 8-14, 15-21, 22-fim) para relatório mensal
      const buildMonthlyWeeksSvg = (weekTotals) => {
        const values = (weekTotals || []).map(w => Number(w.total || 0))
        const max = Math.max(...values, 1)

        const w = 620
        const h = 220
        const padX = 38
        const padTop = 18
        const padBottom = 36
        const innerW = w - padX * 2
        const innerH = h - padTop - padBottom

        const barW = innerW / Math.max(1, values.length)
        const grid = []
        const yAxisLabels = []
        const yTicks = 4

        for (let i = 0; i <= yTicks; i++) {
          const y = padTop + innerH * (i / yTicks)
          grid.push(`<line x1="${padX}" y1="${y}" x2="${padX + innerW}" y2="${y}" stroke="#e5e7eb" stroke-width="1" />`)
          const tickValue = (max * (yTicks - i)) / yTicks
          const label = `R$ ${Number(tickValue || 0).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`
          yAxisLabels.push(`<text x="${(padX - 8).toFixed(2)}" y="${(y + 4).toFixed(2)}" font-size="10" fill="#6b7280" text-anchor="end">${label}</text>`)
        }

        const bars = (weekTotals || []).map((row, i) => {
          const v = Number(row.total || 0)
          const hh = (v / max) * innerH
          const x = padX + i * barW + (barW * 0.18)
          const bw = Math.max(16, barW * 0.64)
          const y = padTop + (innerH - hh)
          return `<rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${bw.toFixed(2)}" height="${hh.toFixed(2)}" fill="#365c52" rx="6" />`
        }).join('')

        const moneyCompact = (v) => {
          const n = Number(v || 0)
          return `R$ ${n.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`
        }

        const valuesText = (weekTotals || []).map((row, i) => {
          const v = Number(row.total || 0)
          if (!Number.isFinite(v) || v <= 0) return ''
          const hh = (v / max) * innerH
          const xCenter = padX + i * barW + (barW / 2)
          const yTop = padTop + (innerH - hh)
          const y = Math.max(padTop + 10, yTop - 6)
          return `<text x="${xCenter.toFixed(2)}" y="${y.toFixed(2)}" font-size="10" fill="#111827" text-anchor="middle">${moneyCompact(v)}</text>`
        }).join('')

        const labels = (weekTotals || []).map((row, i) => {
          const x = padX + i * barW + (barW / 2)
          return `<text x="${x.toFixed(2)}" y="${h - 10}" font-size="11" fill="#374151" text-anchor="middle">${safeText(row.label || `Semana ${i + 1}`)}</text>`
        }).join('')

        return `
          <svg viewBox="0 0 ${w} ${h}" width="100%" height="220" xmlns="http://www.w3.org/2000/svg">
            <rect x="0" y="0" width="${w}" height="${h}" fill="#ffffff" />
            ${grid.join('')}
            ${yAxisLabels.join('')}
            ${bars}
            ${valuesText}
            ${labels}
          </svg>
        `
      }

      // SVG do gráfico: receita por hora (08h às 17h)
      const buildReceitaChartSvg = () => {
        const startHour = 8
        const endHour = 17
        const hours = []
        for (let h = startHour; h <= endHour; h++) hours.push(h)
        const values = hours.map(hh => Number(receitaHoras[hh] || 0))
        const max = Math.max(...values, 1)

        const w = 520
        const h = 220
        const padLeft = 44
        const padRight = 18
        const padTop = 18
        const padBottom = 34
        const innerW = w - padLeft - padRight
        const innerH = h - padTop - padBottom

        const barW = innerW / Math.max(1, values.length)
        const yTicks = 4

        const moneyCompact = (v) => {
          const n = Number(v || 0)
          return `R$ ${n.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`
        }

        const gridLines = []
        const yAxisLabels = []
        for (let i = 0; i <= yTicks; i++) {
          const y = padTop + innerH * (i / yTicks)
          gridLines.push(`<line x1="${padLeft}" y1="${y}" x2="${padLeft + innerW}" y2="${y}" stroke="#e5e7eb" stroke-width="1" />`)
          const tickValue = (max * (yTicks - i)) / yTicks
          yAxisLabels.push(`<text x="${(padLeft - 10)}" y="${(y + 4)}" font-size="10" fill="#6b7280" text-anchor="end">${moneyCompact(tickValue)}</text>`)
        }

        const bars = values.map((v, i) => {
          const hh = (Number(v || 0) / max) * innerH
          const x = padLeft + i * barW + (barW * 0.18)
          const bw = Math.max(10, barW * 0.64)
          const y = padTop + (innerH - hh)
          return `<rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${bw.toFixed(2)}" height="${hh.toFixed(2)}" fill="#2b6cb0" rx="6" />`
        }).join('')

        const valueLabels = values.map((v, i) => {
          const vv = Number(v || 0)
          if (!Number.isFinite(vv) || vv <= 0) return ''
          const hh = (vv / max) * innerH
          const xCenter = padLeft + i * barW + (barW / 2)
          const yTop = padTop + (innerH - hh)
          const y = Math.max(padTop + 10, yTop - 6)
          return `<text x="${xCenter.toFixed(2)}" y="${y.toFixed(2)}" font-size="10" fill="#111827" text-anchor="middle">${moneyCompact(vv)}</text>`
        }).join('')

        const xLabels = hours.map((hh, i) => {
          const x = padLeft + i * barW + (barW / 2)
          return `<text x="${x.toFixed(2)}" y="${h - 10}" font-size="10" fill="#6b7280" text-anchor="middle">${String(hh)}</text>`
        }).join('')

        return `
          <svg viewBox="0 0 ${w} ${h}" width="100%" height="220" xmlns="http://www.w3.org/2000/svg">
            <rect x="0" y="0" width="${w}" height="${h}" fill="#ffffff" />
            ${gridLines.join('')}
            ${yAxisLabels.join('')}
            ${bars}
            ${valueLabels}
            ${xLabels}
          </svg>
        `
      }

      // Build HTML report to render into PDF (layout conforme modelo)
      const emittedAt = formatBRDate(new Date().toISOString())
      const brandIcon = logoPdf

      const currentUserName = (() => {
        try {
          const raw = localStorage.getItem('user')
          if (!raw) return 'Usuário'
          const parsed = JSON.parse(raw)
          return parsed?.nome ? String(parsed.nome) : 'Usuário'
        } catch {
          return 'Usuário'
        }
      })()

      const reportTitle = reportPeriodType === 'diario'
        ? 'Visualização de Consultas Diárias'
        : (reportPeriodType === 'semanal' ? 'Relatório Semanal de Consultas' : 'RELATÓRIO MENSAL DE PERFORMANCE')

      const periodInfoHtml = reportPeriodType === 'semanal'
        ? `Emitido em: ${emittedAt}<br/>Semana de: ${formatBRDate(start)} a ${formatBRDate(end)}`
        : `Emitido em: ${emittedAt}`

      const pieColors = ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd', '#17becf', '#8c564b']
      const procPieSegments = toPieSegments(procRows, 'quantidade', 5)
      const matPieSegments = toPieSegments(matRows, 'quantidade', 5)

      const baseCss = `
        .r-page { position: relative; }

        .r-top { display:flex; justify-content:space-between; align-items:center; }
        .r-brand { display:flex; align-items:center; gap:12px; }
        .r-logo { width:200px; height:auto; object-fit:contain; }
        .r-brandName { display:none; }
        .r-emitted { font-size:12px; color:#374151; text-align:right; line-height: 1.25; }
        .r-hr { margin:14px 0 18px; border:0; border-top:1px solid #d1d5db; }
        .r-title { text-align:center; margin: 8px 0 18px; font-size:26px; font-weight:800; color:#1f2937; }
        .r-summary { background:#eef6ef; border:1px solid #dbe7dc; border-radius:8px; padding:18px 20px; width: 520px; margin: 0 auto 18px; }
        .r-summaryGrid { display:grid; grid-template-columns: 1fr 1px 1fr; align-items:center; gap:16px; }
        .r-div { width:1px; height:56px; background:#d1d5db; justify-self:center; }
        .r-big { font-size:28px; font-weight:800; color:#1f2937; text-align:center; }
        .r-sub { font-size:13px; color:#374151; text-align:center; margin-top:4px; }

        .r-section { border:1px solid #dbe7dc; border-radius:10px; overflow:hidden; margin-top: 16px; }
        .r-sectionTitle { background:#e7efe8; padding:10px 14px; font-weight:800; color:#1f2937; }
        .r-sectionBody { padding: 12px 14px 14px; background:#ffffff; }

        .r-table { width:100%; border-collapse:collapse; font-size:13px; }
        .r-table th, .r-table td { border:1px solid #e5e7eb; padding:8px 10px; }
        .r-table th { background:#f3f4f6; text-align:left; font-weight:800; }
        .r-table td { background:#ffffff; }

        .r-status { display:inline-block; padding:3px 10px; border-radius:6px; font-weight:800; font-size:12px; text-transform:lowercase; border:1px solid rgba(17,24,39,0.08); }
        .r-status--pago { background:#dbeee0; color:#1f6f3a; }
        .r-status--falta { background:#fef3c7; color:#92400e; }
        .r-status--cancelada { background:#fee2e2; color:#991b1b; }
        .r-status--agendada { background:#e5e7eb; color:#374151; }
        .r-status--realizada { background:#dbeafe; color:#1d4ed8; }
        .r-status--outro { background:#ede9fe; color:#5b21b6; }
        .r-footerRight { text-align:right; margin-top:10px; color:#374151; font-size:13px; }

        .r-grid2 { display:grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 16px; }
        .r-chartWrap { border:1px solid #e5e7eb; border-radius:8px; padding:10px; background:#ffffff; }
        .r-chartTitle { font-weight:800; color:#1f2937; margin:0 0 8px; font-size:14px; }
        .r-chartSub { margin:0 0 10px; font-size:12px; color:#6b7280; }

        .r-pieRow { display:grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 16px; margin-top: 16px; align-items:start; }
        .r-pieCard { border:1px solid #e5e7eb; border-radius:10px; padding:0; background:#ffffff; min-width:0; }
        /* Match the section header bar style shown in the reference print */
        .r-pieHeader { font-weight:800; color:#1f2937; margin:0; font-size:14px; background:#e7efe8; padding:10px 14px; border-bottom:1px solid #dbe7dc; line-height:1.25; text-align:left; }
        .r-pieGrid { display:grid; grid-template-columns: 230px minmax(0, 1fr); gap: 12px; align-items:center; padding:12px 16px 12px 12px; min-width:0; }
        .r-pieGrid > div { min-width:0; }
        .r-pieGrid svg { display:block; }
        .r-legend { font-size:12px; color:#374151; }
        .r-legendRow { display:flex; align-items:center; gap:8px; margin:4px 0; }
        .r-dot { width:10px; height:10px; border-radius:999px; display:inline-block; flex:0 0 auto; }
        .r-legendName { flex: 1 1 auto; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .r-legendPct { flex: 0 0 auto; font-weight:800; color:#111827; }

        /* Monthly performance layout (inspired by reference) */
        .m-monthLabel { text-align:center; margin-top:-10px; color:#6b7280; font-size:13px; }
        .m-titleSub { text-align:center; margin-top:6px; color:#374151; font-size:14px; }
        .m-grid2 { display:grid; grid-template-columns: 1.2fr 0.9fr; gap: 14px; }
        .m-card { border:1px solid #e5e7eb; border-radius:10px; background:#fff; overflow:hidden; }
        .m-cardHd { background:#f3f4f6; padding:10px 12px; font-weight:800; color:#111827; }
        .m-cardBd { padding:10px 12px; }
        .m-muted { color:#6b7280; font-size:12px; }
        .m-kpiTable { width:100%; border-collapse:collapse; font-size:12.5px; }
        .m-kpiTable th, .m-kpiTable td { border:1px solid #e5e7eb; padding:8px 10px; }
        .m-kpiTable th { background:#f9fafb; text-align:left; font-weight:800; }
        .m-kpiUp { color:#166534; font-weight:800; }
        .m-kpiDown { color:#991b1b; font-weight:800; }
        .m-kpiFlat { color:#374151; font-weight:800; }

        .m-metricsRow { display:grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; margin-top: 10px; }
        .m-metric { border:1px solid #e5e7eb; border-radius:10px; padding:10px 12px; background:#ffffff; }
        .m-metricVal { font-size:18px; font-weight:900; color:#111827; }
        .m-metricLbl { font-size:12px; color:#6b7280; margin-top:3px; }

        .m-gridBottom { display:grid; grid-template-columns: 1fr 1fr; gap: 14px; }
        .m-noteBox { border:1px solid #e5e7eb; border-radius:10px; padding:10px 12px; background:#ffffff; }
        .m-footerText { margin-top: 10px; color:#6b7280; font-size:11px; text-align:center; }
      `

      const styleEl = document.createElement('style')
      styleEl.setAttribute('data-report-style', '1')
      styleEl.textContent = baseCss
      document.head.appendChild(styleEl)

      const root = document.createElement('div')
      root.style.width = '860px'
      root.style.padding = '24px 28px'
      root.style.background = '#ffffff'
      root.style.color = '#111827'
      root.style.position = 'fixed'
      root.style.left = '-9999px'
      root.style.top = '0'
      document.body.appendChild(root)

      const makeSection = (html) => {
        const el = document.createElement('div')
        el.className = 'r-page'
        el.style.background = '#ffffff'
        el.style.padding = '0'
        el.innerHTML = html
        return el
      }

      const sections = []

      if (reportPeriodType === 'mensal') {
        const nowYMD = toYMDLocal(new Date())
        const [yy, mm] = start.split('-').map(Number)
        const monthLabel = new Date(yy, (mm - 1), 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })

        // Previous month window
        const prevStart = new Date(yy, (mm - 2), 1).toISOString().split('T')[0]
        const prevEnd = new Date(yy, (mm - 1), 0).toISOString().split('T')[0]
        const prevConsultas = consultasAll.filter(c => {
          const ymd = toYMDLocal(c?.data_hora || c?.data)
          return ymd && ymd >= prevStart && ymd <= prevEnd
        })

        const computeMetrics = (rows) => {
          const realizadas = (rows || []).filter(c => c?.status === 'realizada').length
          const receita = (rows || []).reduce((s, c) => s + (c?.pago ? Number(c?.valor || 0) : 0), 0)
          const ticket = realizadas > 0 ? (receita / realizadas) : 0
          const cancelamentos = (rows || []).filter(c => c?.status === 'cancelada').length
          const faltas = (rows || []).filter(c => {
            const st = normalizeStatus(c?.status)
            if (st === 'falta') return true
            const ymd = toYMDLocal(c?.data_hora || c?.data)
            return st === 'agendada' && ymd && ymd < nowYMD
          }).length
          return { realizadas, receita, ticket, cancelamentos, faltas }
        }

        const cur = computeMetrics(consultas)
        const prev = computeMetrics(prevConsultas)

        const pct = (curVal, prevVal) => {
          const a = Number(curVal || 0)
          const b = Number(prevVal || 0)
          if (!Number.isFinite(a) || !Number.isFinite(b)) return { cls: 'm-kpiFlat', text: '0%' }
          if (b === 0) {
            if (a === 0) return { cls: 'm-kpiFlat', text: '0%' }
            return { cls: 'm-kpiUp', text: '+100%' }
          }
          const delta = ((a - b) / b) * 100
          const rounded = Math.round(delta)
          if (rounded > 0) return { cls: 'm-kpiUp', text: `+${rounded}%` }
          if (rounded < 0) return { cls: 'm-kpiDown', text: `${rounded}%` }
          return { cls: 'm-kpiFlat', text: '0%' }
        }

        // Day most profitable (paid)
        const receitaPorDia = {}
        consultas.forEach(c => {
          if (!c?.pago) return
          const ymd = toYMDLocal(c?.data_hora || c?.data)
          if (!ymd) return
          receitaPorDia[ymd] = (receitaPorDia[ymd] || 0) + Number(c?.valor || 0)
        })
        const diaMaisLucrativoEntry = Object.entries(receitaPorDia).sort((a, b) => (b[1] || 0) - (a[1] || 0))[0]
        const diaMaisLucrativo = diaMaisLucrativoEntry ? `${formatBRDate(diaMaisLucrativoEntry[0])} (${formatMoney(diaMaisLucrativoEntry[1])})` : '-'

        const procMaisFeito = procRows?.[0]?.nome ? String(procRows[0].nome) : '-'

        const resumoExecutivo = `No mês de ${monthLabel} foram realizadas ${cur.realizadas} consultas, gerando uma receita total de ${formatMoney(cur.receita)}, com ticket médio de ${formatMoney(cur.ticket)}. Cancelamentos: ${cur.cancelamentos}. Dia mais lucrativo: ${diaMaisLucrativo}. Procedimento mais realizado: ${procMaisFeito}.`

        // Occupation by weekday (Seg..Sex)
        const weekdays = [
          { key: 1, label: 'Segunda' },
          { key: 2, label: 'Terça' },
          { key: 3, label: 'Quarta' },
          { key: 4, label: 'Quinta' },
          { key: 5, label: 'Sexta' }
        ]
        const occ = weekdays.map(w => {
          const rows = consultas.filter(c => {
            const d = new Date(c?.data_hora || c?.data)
            return !Number.isNaN(d.getTime()) && d.getDay() === w.key
          })
          const realizadas = rows.filter(c => c?.status === 'realizada').length
          const receita = rows.reduce((s, c) => s + (c?.pago ? Number(c?.valor || 0) : 0), 0)
          const ticket = realizadas > 0 ? (receita / realizadas) : 0
          return { weekday: w.label, realizadas, receita, ticket }
        })

        // Days úteis (Seg..Sex) in month
        let diasUteis = 0
        {
          const sD = new Date(`${start}T00:00:00`)
          const eD = new Date(`${end}T00:00:00`)
          for (let d = new Date(sD); d <= eD; d.setDate(d.getDate() + 1)) {
            const day = d.getDay()
            if (day >= 1 && day <= 5) diasUteis++
          }
        }

        // Top 3 procedures + outros
        const topProc = procRows.slice(0, 3)
        const otherProcCount = procRows.slice(3).reduce((s, r) => s + Number(r.quantidade || 0), 0)

        // Top 3 materials + outros
        const topMat = matRows.slice(0, 3)
        const otherMatCount = matRows.slice(3).reduce((s, r) => s + Number(r.quantidade || 0), 0)

        // Week totals for month (calendar weeks, Monday-based, labels show only days inside the month)
        const weekRanges = (() => {
          const monthStart = new Date(`${start}T00:00:00`)
          const monthEnd = new Date(`${end}T00:00:00`)

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
                label: `Semana ${ranges.length + 1} (${from.getDate()}–${to.getDate()})`,
                startYmd: toYMDLocal(from),
                endYmd: toYMDLocal(to)
              })
            }
            wkStart = new Date(wkStart)
            wkStart.setDate(wkStart.getDate() + 7)
          }
          return ranges
        })()

        const weekTotals = weekRanges.map(wr => {
          const total = consultas.reduce((s, c) => {
            if (!c?.pago) return s
            const ymd = toYMDLocal(c?.data_hora || c?.data)
            if (!ymd) return s
            if (ymd < wr.startYmd || ymd > wr.endYmd) return s
            return s + Number(c?.valor || 0)
          }, 0)
          return { label: wr.label, total }
        })
        const bestWeek = weekTotals.slice().sort((a, b) => (b.total || 0) - (a.total || 0))[0]
        const bestWeekText = bestWeek ? `A ${bestWeek.label} foi a mais lucrativa, com ${formatMoney(bestWeek.total)}.` : ''

        // KPI deltas
        const dConsultas = pct(cur.realizadas, prev.realizadas)
        const dReceita = pct(cur.receita, prev.receita)
        const dTicket = pct(cur.ticket, prev.ticket)
        const dCanc = pct(cur.cancelamentos, prev.cancelamentos)

        // Trends & alerts
        const tendencia = (cur.receita >= prev.receita)
          ? `Tendência positiva: aumento de receita em relação ao mês anterior (${dReceita.text}).`
          : `Tendência: queda de receita em relação ao mês anterior (${dReceita.text}).`
        const alerta = (cur.cancelamentos > prev.cancelamentos)
          ? `Alerta: aumento de cancelamentos (${dCanc.text}). Recomenda-se reforçar confirmação no dia anterior.`
          : `Cancelamentos sob controle (${dCanc.text}).`

        sections.push(makeSection(`
          <div class="r-top">
              <div class="r-brand">
              <img class="r-logo" src="${brandIcon}" alt="" onerror="this.onerror=null;this.src='${logoFallback}'" />
            </div>
            <div class="r-emitted">${periodInfoHtml}<br/>Mês: ${safeText(monthLabel)}</div>
          </div>
          <hr class="r-hr" />
          <div class="r-title">${safeText(reportTitle)}</div>
          <div class="m-monthLabel">${safeText(monthLabel)}</div>
        `))

        sections.push(makeSection(`
          <div class="r-section" style="margin-top:0">
            <div class="r-sectionTitle">Visão Geral do Mês</div>
            <div class="r-sectionBody">
              <div class="m-grid2">
                <div class="m-card">
                  <div class="m-cardHd">Resumo Executivo</div>
                  <div class="m-cardBd">
                    <div style="font-size:13px; color:#374151; line-height:1.45">${safeText(resumoExecutivo)}</div>
                    <div class="m-metricsRow">
                      <div class="m-metric"><div class="m-metricVal">${cur.realizadas}</div><div class="m-metricLbl">Consultas realizadas</div></div>
                      <div class="m-metric"><div class="m-metricVal">${formatMoney(cur.receita)}</div><div class="m-metricLbl">Receita total</div></div>
                      <div class="m-metric"><div class="m-metricVal">${formatMoney(cur.ticket)}</div><div class="m-metricLbl">Ticket médio</div></div>
                    </div>
                    <div style="display:flex; gap:12px; margin-top:10px;">
                      <div class="m-noteBox" style="flex:1;"><div class="m-muted">Dia mais lucrativo</div><div style="font-weight:900; margin-top:4px;">${safeText(diaMaisLucrativo)}</div></div>
                      <div class="m-noteBox" style="flex:1;"><div class="m-muted">Procedimento mais realizado</div><div style="font-weight:900; margin-top:4px;">${safeText(procMaisFeito)}</div></div>
                    </div>
                  </div>
                </div>

                <div class="m-card">
                  <div class="m-cardHd">KPIs Mensais</div>
                  <div class="m-cardBd">
                    <table class="m-kpiTable">
                      <thead>
                        <tr>
                          <th>Indicador</th>
                          <th style="width:120px">${safeText(monthLabel)}</th>
                          <th style="width:120px">Mês anterior</th>
                          <th style="width:70px">%</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td>Consultas</td>
                          <td style="text-align:right">${cur.realizadas}</td>
                          <td style="text-align:right">${prev.realizadas}</td>
                          <td class="${dConsultas.cls}" style="text-align:right">${dConsultas.text}</td>
                        </tr>
                        <tr>
                          <td>Receita</td>
                          <td style="text-align:right">${formatMoney(cur.receita)}</td>
                          <td style="text-align:right">${formatMoney(prev.receita)}</td>
                          <td class="${dReceita.cls}" style="text-align:right">${dReceita.text}</td>
                        </tr>
                        <tr>
                          <td>Ticket médio</td>
                          <td style="text-align:right">${formatMoney(cur.ticket)}</td>
                          <td style="text-align:right">${formatMoney(prev.ticket)}</td>
                          <td class="${dTicket.cls}" style="text-align:right">${dTicket.text}</td>
                        </tr>
                        <tr>
                          <td>Cancelamentos</td>
                          <td style="text-align:right">${cur.cancelamentos}</td>
                          <td style="text-align:right">${prev.cancelamentos}</td>
                          <td class="${dCanc.cls}" style="text-align:right">${dCanc.text}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </div>
        `))

        sections.push(makeSection(`
          <div class="m-gridBottom" style="margin-top:0">
            <div class="r-section" style="margin-top:0">
              <div class="r-sectionTitle">Ocupação da Agenda</div>
              <div class="r-sectionBody">
                <div class="m-muted" style="margin-bottom:8px;">Dias úteis no mês: <strong>${diasUteis}</strong></div>
                <table class="r-table">
                  <thead>
                    <tr>
                      <th>Dia</th>
                      <th style="width:110px; text-align:center">Consultas</th>
                      <th style="width:140px; text-align:right">Receita</th>
                      <th style="width:140px; text-align:right">Ticket médio</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${occ.map(r => `
                      <tr>
                        <td>${safeText(r.weekday)}</td>
                        <td style="text-align:center">${r.realizadas}</td>
                        <td style="text-align:right">${formatMoney(r.receita)}</td>
                        <td style="text-align:right">${formatMoney(r.ticket)}</td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
            </div>

            <div class="r-section" style="margin-top:0">
              <div class="r-sectionTitle">Cancelamentos e Faltas</div>
              <div class="r-sectionBody">
                <table class="r-table">
                  <thead>
                    <tr>
                      <th>Motivo</th>
                      <th style="width:120px; text-align:center">Quantidade</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr><td>${statusBadgeHtml('cancelada')}</td><td style="text-align:center">${cur.cancelamentos}</td></tr>
                    <tr><td>${statusBadgeHtml('falta')} <span class="m-muted">(não contabiliza procedimentos/materiais/receita)</span></td><td style="text-align:center">${cur.faltas}</td></tr>
                    <tr><td>Outros</td><td style="text-align:center">0</td></tr>
                  </tbody>
                </table>
                <div class="m-muted" style="margin-top:8px;">Dica: confirmação no dia anterior reduz faltas.</div>
              </div>
            </div>
          </div>
        `))

        sections.push(makeSection(`
          <div class="m-gridBottom" style="margin-top:0">
            <div class="r-section" style="margin-top:0">
              <div class="r-sectionTitle">Atendimentos por Procedimento</div>
              <div class="r-sectionBody">
                <table class="r-table">
                  <thead>
                    <tr>
                      <th>Procedimento</th>
                      <th style="width:130px; text-align:center">Quantidade</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${topProc.map(r => `
                      <tr>
                        <td>${safeText(r.nome)}</td>
                        <td style="text-align:center">${Number(r.quantidade || 0)}</td>
                      </tr>
                    `).join('')}
                    <tr>
                      <td><strong>Outros</strong></td>
                      <td style="text-align:center"><strong>${Number(otherProcCount || 0)}</strong></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div class="r-section" style="margin-top:0">
              <div class="r-sectionTitle">Materiais Utilizados</div>
              <div class="r-sectionBody">
                <table class="r-table">
                  <thead>
                    <tr>
                      <th>Material</th>
                      <th style="width:130px; text-align:center">Quantidade</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${topMat.map(r => `
                      <tr>
                        <td>${safeText(r.nome)}</td>
                        <td style="text-align:center">${Number(r.quantidade || 0)}</td>
                      </tr>
                    `).join('')}
                    <tr>
                      <td><strong>Outros</strong></td>
                      <td style="text-align:center"><strong>${Number(otherMatCount || 0)}</strong></td>
                    </tr>
                  </tbody>
                </table>
                <div class="r-footerRight">Total: ${Number(totalMateriais || 0)}</div>
              </div>
            </div>
          </div>
        `))

        sections.push(makeSection(`
          <div class="r-section" style="margin-top:0">
            <div class="r-sectionTitle">Receita por Semana</div>
            <div class="r-sectionBody">
              ${buildMonthlyWeeksSvg(weekTotals)}
              <div class="m-muted" style="margin-top:8px;">${safeText(bestWeekText)}</div>
            </div>
          </div>
        `))

        sections.push(makeSection(`
          <div class="m-gridBottom" style="margin-top:0">
            <div class="r-section" style="margin-top:0">
              <div class="r-sectionTitle">Tendências e Alertas</div>
              <div class="r-sectionBody">
                <div style="font-size:13px; color:#374151; line-height:1.45">
                  <p style="margin:0 0 8px"><strong>Tendência:</strong> ${safeText(tendencia)}</p>
                  <p style="margin:0"><strong>Alerta:</strong> ${safeText(alerta)}</p>
                </div>
              </div>
            </div>

            <div class="r-section" style="margin-top:0">
              <div class="r-sectionTitle">Observações</div>
              <div class="r-sectionBody">
                <div style="font-size:13px; color:#374151; line-height:1.45">
                  Relatório elaborado por ${safeText(currentUserName)} em ${safeText(emittedAt)}.
                </div>
                ${pdfFooterText ? `<div class="m-footerText">${safeText(pdfFooterText)}</div>` : ''}
              </div>
            </div>
          </div>
        `))
      } else {
        sections.push(makeSection(`
          <div class="r-top">
              <div class="r-brand">
              <img class="r-logo" src="${brandIcon}" alt="" onerror="this.onerror=null;this.src='${logoFallback}'" />
            </div>
            <div class="r-emitted">${periodInfoHtml}</div>
          </div>
          <hr class="r-hr" />
          <div class="r-title">${safeText(reportTitle)}</div>
          <div class="r-summary">
            <div class="r-summaryGrid">
              <div>
                <div class="r-big">${consultasRealizadas}</div>
                <div class="r-sub">Consultas Realizadas</div>
              </div>
              <div class="r-div"></div>
              <div>
                <div class="r-big">${formatMoney(receitaTotal)}</div>
                <div class="r-sub">Receita Total</div>
              </div>
            </div>
          </div>
        `))

        sections.push(makeSection(`
          <div class="r-section" style="margin-top:0">
            <div class="r-sectionTitle">Consultas</div>
            <div class="r-sectionBody">
              <table class="r-table">
                <thead>
                  <tr>
                    <th style="width:120px">Data</th>
                    <th>Paciente</th>
                    <th>Procedimento</th>
                    <th style="width:110px">Valor</th>
                    <th style="width:110px">Status</th>
                  </tr>
                </thead>
                <tbody>
                  ${consultas.map(c => {
                    const data = formatBRDate(c.data_hora || c.data || start)
                    const paciente = safeText(c.paciente_nome || c.paciente || '-')
                    const proc = safeText(c.tipo_consulta || '-')
                    const val = formatMoney(Number(c.valor || 0))
                    const status = c.pago ? 'pago' : (c.status || '-')
                    const statusHtml = statusBadgeHtml(status)
                    return `
                      <tr>
                        <td>${data}</td>
                        <td>${paciente}</td>
                        <td>${proc}</td>
                        <td>${val}</td>
                        <td>${statusHtml}</td>
                      </tr>
                    `
                  }).join('')}
                </tbody>
              </table>
              <div class="r-footerRight">Total: ${consultas.length} consultas</div>
            </div>
          </div>
        `))

        sections.push(makeSection(`
          <div class="r-section" style="margin-top:0">
            <div class="r-sectionTitle">Procedimentos Realizados</div>
            <div class="r-sectionBody">
              <table class="r-table">
                <thead>
                  <tr>
                    <th>Procedimento</th>
                    <th style="width:130px">Quantidade</th>
                    <th style="width:140px">Total</th>
                  </tr>
                </thead>
                <tbody>
                  ${procRows.map(r => `
                    <tr>
                      <td>${safeText(r.nome)}</td>
                      <td style="text-align:center">${r.quantidade}</td>
                      <td style="text-align:right">${formatMoney(r.total)}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
              <div class="r-footerRight">Total: ${procRows.reduce((s, r) => s + r.quantidade, 0)}</div>
            </div>
          </div>
        `))
      }

      if (reportPeriodType === 'semanal') {
        sections.push(makeSection(`
          <div class="r-pieRow" style="margin-top:0">
            <div class="r-pieCard">
              <p class="r-pieHeader">Visualização de procedimentos mais utilizados:</p>
              <div class="r-pieGrid">
                <div>${buildPieChartSvg(procPieSegments, { size: 210, colors: pieColors })}</div>
                <div>${buildLegendHtml(procPieSegments, { colors: pieColors })}</div>
              </div>
            </div>
            <div class="r-pieCard">
              <p class="r-pieHeader">Visualização de materiais mais utilizados:</p>
              <div class="r-pieGrid">
                <div>${buildPieChartSvg(matPieSegments, { size: 210, colors: pieColors })}</div>
                <div>${buildLegendHtml(matPieSegments, { colors: pieColors })}</div>
              </div>
            </div>
          </div>
        `))

        sections.push(makeSection(`
          <div class="r-section" style="margin-top:0">
            <div class="r-sectionTitle">Receita Semanal</div>
            <div class="r-sectionBody">
              ${buildWeeklyRevenueSvg(start, end)}
              <div class="r-footerRight">Receita total: ${formatMoney(receitaTotal)}</div>
            </div>
          </div>
        `))
      }

      if (reportPeriodType === 'diario') {
        sections.push(makeSection(`
          <div class="r-grid2" style="margin-top:0">
            <div class="r-section" style="margin-top:0">
              <div class="r-sectionTitle">Materiais Utilizados</div>
              <div class="r-sectionBody">
                <table class="r-table">
                  <thead>
                    <tr>
                      <th>Material</th>
                      <th style="width:140px">Quantidade</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${matRows.map(r => `
                      <tr>
                        <td>${safeText(r.nome)}</td>
                        <td style="text-align:center">${Number(r.quantidade || 0)}</td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
                <div class="r-footerRight">Total: ${Number(totalMateriais || 0)}</div>
              </div>
            </div>

            <div class="r-section" style="margin-top:0">
              <div class="r-sectionTitle">Grafico Diário - Receita por Hora</div>
              <div class="r-sectionBody">
                <div class="r-chartWrap">
                  <p class="r-chartTitle">Receita por Horário (08h às 17h)</p>
                  ${buildReceitaChartSvg()}
                </div>
                <div class="r-footerRight">Total arrecadado: ${formatMoney(receitaTotal)}</div>
              </div>
            </div>
          </div>
        `))
      }

      // render sections and create PDF with pagination by block
      const pdf = new jsPDF('p', 'mm', 'a4')
      const pageWidth = pdf.internal.pageSize.getWidth()
      const pageHeight = pdf.internal.pageSize.getHeight()
      const marginX = 10
      const marginTop = 10
      const marginBottom = 14 // reserve for footer
      const gap = 4

      let cursorY = marginTop
      const targetWidth = pageWidth - marginX * 2

      for (let i = 0; i < sections.length; i++) {
        const sectionEl = sections[i]
        root.appendChild(sectionEl)

        const canvas = await html2canvas(sectionEl, { scale: 2, useCORS: true, backgroundColor: '#ffffff' })
        const imgData = canvas.toDataURL('image/png')
        const imgHeight = (canvas.height * targetWidth) / canvas.width

        const usableHeight = pageHeight - marginBottom - cursorY
        if (imgHeight > usableHeight) {
          pdf.addPage()
          cursorY = marginTop
        }

        pdf.addImage(imgData, 'PNG', marginX, cursorY, targetWidth, imgHeight)
        cursorY += imgHeight + gap

        root.removeChild(sectionEl)
      }

      // footer: Página i de X
      const totalPages = pdf.getNumberOfPages()
      for (let p = 1; p <= totalPages; p++) {
        pdf.setPage(p)
        pdf.setFontSize(10)
        pdf.setTextColor(107, 114, 128)
        if (pdfFooterText) {
          pdf.text(String(pdfFooterText), marginX, pageHeight - 8, { align: 'left', maxWidth: pageWidth - marginX * 2 })
        }
        pdf.text(`Página ${p} de ${totalPages}`, pageWidth - marginX, pageHeight - 8, { align: 'right' })
      }

      pdf.save(`relatorio_${label}.pdf`)

      root.remove()
      styleEl.remove()

    } catch (err) {
      console.error('Erro ao gerar relatório CSV', err)
      alert('Erro ao gerar relatório: ' + (err.message || err))
    }
  }

  

  return (
    <div className={styles.container}>
      {/* Mobile header + filtros (igual ao padrão da Agenda mobile) */}
      <div className={styles.mobileToolbar}>
        <div className={styles.mobileHeaderRow}>
          <h1 className={styles.mobileTitle}>Relatórios</h1>
          <button className={styles.mobilePrimaryBtn} onClick={gerarPDF}>
            Gerar Relatório <span className={styles.btnChevron} aria-hidden="true">›</span>
          </button>
        </div>

        <div className={styles.mobileFiltersRow}>
          <select
            className={styles.mobileSelect}
            value={reportPeriodType}
            onChange={e => {
              const next = e.target.value
              setReportPeriodType(next)
              if (next === 'semanal') {
                const d = new Date(reportDate)
                if (!Number.isNaN(d.getTime())) {
                  const day = d.getDay()
                  const diffToMonday = (day + 6) % 7
                  const monday = new Date(d)
                  monday.setDate(d.getDate() - diffToMonday)
                  const sunday = new Date(monday)
                  sunday.setDate(monday.getDate() + 6)
                  setReportWeekStart(monday.toISOString().split('T')[0])
                  setReportWeekEnd(sunday.toISOString().split('T')[0])
                }
              }
            }}
            aria-label="Período"
          >
            <option value="diario">Diário</option>
            <option value="semanal">Semanal</option>
            <option value="mensal">Mensal</option>
          </select>

          {reportPeriodType === 'diario' && (
            <input
              className={styles.mobileDate}
              type="date"
              value={reportDate}
              onChange={e => setReportDate(e.target.value)}
              aria-label="Data"
            />
          )}

          {reportPeriodType === 'semanal' && (
            <>
              <input
                className={styles.mobileDate}
                type="date"
                value={reportWeekStart}
                onChange={e => setReportWeekStart(e.target.value)}
                aria-label="Início"
              />
              <input
                className={styles.mobileDate}
                type="date"
                value={reportWeekEnd}
                onChange={e => setReportWeekEnd(e.target.value)}
                aria-label="Fim"
              />
            </>
          )}

          {reportPeriodType === 'mensal' && (
            <input
              className={styles.mobileDate}
              type="month"
              value={reportMonth}
              onChange={e => setReportMonth(e.target.value)}
              aria-label="Mês"
            />
          )}
        </div>
      </div>

      <div className={styles.pageHeading}>
        <BreadcrumbTitle current="Relatórios" />
      </div>

      <div className={styles.reportFiltersBar}>
        <div className={styles.reportFiltersRow}>
          <select
            className={styles.filterSelect}
            value={reportPeriodType}
            onChange={e => {
              const next = e.target.value
              setReportPeriodType(next)
              if (next === 'semanal') {
                const d = new Date(reportDate)
                if (!Number.isNaN(d.getTime())) {
                  const day = d.getDay()
                  const diffToMonday = (day + 6) % 7
                  const monday = new Date(d)
                  monday.setDate(d.getDate() - diffToMonday)
                  const sunday = new Date(monday)
                  sunday.setDate(monday.getDate() + 6)
                  setReportWeekStart(monday.toISOString().split('T')[0])
                  setReportWeekEnd(sunday.toISOString().split('T')[0])
                }
              }
            }}
          >
            <option value="diario">Diário</option>
            <option value="semanal">Semanal</option>
            <option value="mensal">Mensal</option>
          </select>

          {reportPeriodType === 'diario' && (
            <div className={styles.filterPill}>
              <span className={styles.filterLabel}>Data:</span>
              <input className={styles.filterInput} type="date" value={reportDate} onChange={e => setReportDate(e.target.value)} />
            </div>
          )}

          {reportPeriodType === 'semanal' && (
            <>
              <div className={styles.filterPill}>
                <span className={styles.filterLabel}>Início:</span>
                <input className={styles.filterInput} type="date" value={reportWeekStart} onChange={e => setReportWeekStart(e.target.value)} />
              </div>
              <div className={styles.filterPill}>
                <span className={styles.filterLabel}>Fim:</span>
                <input className={styles.filterInput} type="date" value={reportWeekEnd} onChange={e => setReportWeekEnd(e.target.value)} />
              </div>
            </>
          )}

          {reportPeriodType === 'mensal' && (
            <div className={styles.filterPill}>
              <span className={styles.filterLabel}>Mês:</span>
              <input className={styles.filterInput} type="month" value={reportMonth} onChange={e => setReportMonth(e.target.value)} />
            </div>
          )}

          <button className={styles.reportBtnPrimary} onClick={gerarPDF}>Gerar Relatório (PDF)</button>
        </div>
      </div>

      <div className={styles.chartsGrid}>
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <div className={styles.cardTitleWrap}>
              <h2 className={styles.cardTitle}>Receita diária</h2>
              <div className={styles.cardSubtitle}>Hora × Receita (08h–17h)</div>
            </div>

            <div className={styles.cardControls}>
              <button
                className={styles.iconBtn}
                type="button"
                onClick={() => {
                  const d = new Date(`${dailyChartDateInput}T00:00:00`)
                  if (Number.isNaN(d.getTime())) return
                  d.setDate(d.getDate() - 1)
                  setDailyChartDateInput(ymdFromLocalDate(d))
                }}
                title="Dia anterior"
              >
                ◀
              </button>

              <input type="date" value={dailyChartDateInput} onChange={e => setDailyChartDateInput(e.target.value)} />

              <button
                className={styles.iconBtn}
                type="button"
                onClick={() => {
                  const d = new Date(`${dailyChartDateInput}T00:00:00`)
                  if (Number.isNaN(d.getTime())) return
                  d.setDate(d.getDate() + 1)
                  setDailyChartDateInput(ymdFromLocalDate(d))
                }}
                title="Próximo dia"
              >
                ▶
              </button>

              <button
                className={styles.btnPrimary}
                type="button"
                onClick={() => setDailyChartDate(dailyChartDateInput)}
                disabled={dailyChartLoading}
              >
                Buscar
              </button>
            </div>
          </div>

          <div className={styles.metricsRow}>
            <div className={styles.metricItem}>
              <div className={styles.metricLabel}>Total do dia</div>
              <div className={styles.metricValue}>
                {formatMoney((receitaHojeHoras || []).reduce((s, v) => s + Number(v || 0), 0))}
              </div>
            </div>
            <div className={styles.metricItem}>
              <div className={styles.metricLabel}>Dia</div>
              <div className={styles.metricValueMuted}>{new Date(`${dailyChartDate}T00:00:00`).toLocaleDateString('pt-BR')}</div>
            </div>
          </div>

          <div className={styles.chartPlaceholder}>
            {dailyChartLoading ? (
              <div className={styles.chartMessage}>Carregando gráfico…</div>
            ) : dailyChartError ? (
              <div className={styles.chartMessageError}>{dailyChartError}</div>
            ) : (
              <DailyHourChart data={receitaHojeHoras} startHour={HOUR_START} />
            )}
          </div>
        </div>

        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <div className={styles.cardTitleWrap}>
              <h2 className={styles.cardTitle}>Receita por Semana</h2>
              <div className={styles.cardSubtitle}>Relatório mensal • receita agrupada por semana</div>
            </div>

            <div className={styles.cardControls}>
              <input type="month" value={monthlyChartMonthInput} onChange={e => setMonthlyChartMonthInput(e.target.value)} />
              <button
                className={styles.btnPrimary}
                type="button"
                onClick={() => setMonthlyChartMonth(monthlyChartMonthInput)}
                disabled={monthlyChartLoading}
              >
                Buscar
              </button>
            </div>
          </div>

          <div className={styles.metricsRow}>
            <div className={styles.metricItem}>
              <div className={styles.metricLabel}>Total do mês</div>
              <div className={styles.metricValue}>
                {formatMoney((monthlyChartWeeks || []).reduce((s, w) => s + Number(w?.total || 0), 0))}
              </div>
            </div>
            <div className={styles.metricItem}>
              <div className={styles.metricLabel}>Mês</div>
              <div className={styles.metricValueMuted}>{monthlyChartMonth}</div>
            </div>
          </div>

          <div className={styles.chartPlaceholder}>
            {monthlyChartLoading ? (
              <div className={styles.chartMessage}>Carregando gráfico…</div>
            ) : monthlyChartError ? (
              <div className={styles.chartMessageError}>{monthlyChartError}</div>
            ) : (
              <div className={styles.chartStack}>
                <MonthlyWeeksChartRecharts weeks={monthlyChartWeeks} />
                <div className={styles.chartFootnote}>
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

      <div className={styles.dataGrid}>
        <div className={styles.card}>
          <h2>Consultas Recentes</h2>
          <div className={styles.simpleList}>
            {(showAllConsultas ? recentConsultas : (recentConsultas || []).slice(0, 3)).map(c => (
              <div key={c.id} className={styles.simpleRow}>
                <div className={styles.simpleLeft}>{c.paciente_nome || c.paciente || '-'}</div>
                <div className={styles.simpleRight}>
                  <span className={styles.simpleMeta}>{new Date(c.data_hora || c.data).toLocaleDateString('pt-BR')}</span>
                  <img src="/assets/agenda.svg" alt="" className={styles.simpleIcon} />
                </div>
              </div>
            ))}
          </div>
          <button className={styles.btnSecondary} type="button" onClick={() => setShowAllConsultas(v => !v)}>
            {showAllConsultas ? 'Ver Menos' : 'Ver Todas'}
          </button>
        </div>

        <div className={styles.card}>
          <h2>Procedimentos Mais Realizados</h2>
          <div className={styles.simpleList}>
            {(showAllProcedimentos ? procedimentos : (procedimentos || []).slice(0, 3)).map(p => (
              <div key={p.id} className={styles.simpleRow}>
                <div className={styles.simpleLeft}>{p.nome}</div>
                <div className={styles.simpleRight}>
                  <span className={styles.simpleMeta}>{p.total}</span>
                  <img src="/assets/agenda.svg" alt="" className={styles.simpleIcon} />
                </div>
              </div>
            ))}
          </div>
          <button className={styles.btnSecondary} type="button" onClick={() => setShowAllProcedimentos(v => !v)}>
            {showAllProcedimentos ? 'Ver Menos' : 'Ver Todas'}
          </button>
        </div>
      </div>
    </div>
  )
}

function DailyHourChart({ data, startHour = 8 }) {
  const values = Array.isArray(data) ? data : []
  const maxRaw = Math.max(...values.map(v => Number(v || 0)), 0)

  if (maxRaw <= 0) {
    return <div className={styles.chartMessage}>Sem receita para o período</div>
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
    return <div className={styles.chartMessage}>Sem receita para o período</div>
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
