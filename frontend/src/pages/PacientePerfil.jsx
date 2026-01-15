import { consultasService, pacientesService, estoqueService, configuracoesService, odontogramaService } from '@services/api'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import Odontograma from '../components/common/Odontograma'
import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'
import denteIcon from '../assets/dente.png'
import styles from './PacientePerfil.module.css'

export default function PacientePerfil() {
  const { id } = useParams()
  const [paciente, setPaciente] = useState(null)
  const [loading, setLoading] = useState(true)
  const [abaSelecionada, setAbaSelecionada] = useState('prontuario')
  const [consultas, setConsultas] = useState([])
  const [selectedConsulta, setSelectedConsulta] = useState(null)
  const [produtoIdToNome, setProdutoIdToNome] = useState(() => new Map())
  const [showEditForm, setShowEditForm] = useState(false)
  const [formData, setFormData] = useState({})
  const [galeriaImagens, setGaleriaImagens] = useState([])
  const galeriaImagensRef = useRef([])
  const [imagemSelecionada, setImagemSelecionada] = useState(null)
  const [exportandoPdf, setExportandoPdf] = useState(false)

  const exportarProntuarioPdf = async () => {
    if (!id) return
    setExportandoPdf(true)
    try {
      const safeText = (t) => String(t ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')

      const pad2 = (n) => String(n).padStart(2, '0')
      const formatBRDate = (isoOrDate) => {
        try {
          const d = (isoOrDate instanceof Date) ? isoOrDate : new Date(isoOrDate)
          if (Number.isNaN(d.getTime())) return String(isoOrDate || '')
          return d.toLocaleDateString('pt-BR')
        } catch {
          return String(isoOrDate || '')
        }
      }
      const formatBRTime = (isoOrDate) => {
        try {
          const d = (isoOrDate instanceof Date) ? isoOrDate : new Date(isoOrDate)
          if (Number.isNaN(d.getTime())) return ''
          return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
        } catch {
          return ''
        }
      }
      const formatMoney = (v) => `R$ ${Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

      const parseJsonList = (raw) => {
        if (!raw) return []
        if (Array.isArray(raw)) return raw
        if (typeof raw === 'string') {
          try {
            const parsed = JSON.parse(raw)
            return Array.isArray(parsed) ? parsed : [parsed]
          } catch {
            return [raw]
          }
        }
        return [raw]
      }

      const resolveConsultaProcedimentos = (c) => {
        const list = parseJsonList(c?.procedimentos)
        if (list.length) {
          const names = list.map(p => {
            if (!p) return ''
            if (typeof p === 'string') return p
            if (typeof p === 'object') return String(p.descricao || p.nome || '')
            return String(p)
          }).filter(Boolean)
          if (names.length) return names
        }
        return c?.tipo_consulta ? [String(c.tipo_consulta)] : []
      }

      const resolveConsultaValor = (c) => {
        const list = parseJsonList(c?.procedimentos)
        let sum = 0
        list.forEach(p => {
          if (!p) return
          if (typeof p === 'object' && p.valor !== undefined && p.valor !== null) {
            const n = Number(p.valor)
            if (Number.isFinite(n)) sum += n
          }
        })
        if (sum > 0) return sum
        const v = Number(c?.valor || 0)
        return Number.isFinite(v) ? v : 0
      }

      const resolveConsultaMateriais = (c) => {
        const list = parseJsonList(c?.materiais)
        const lines = []
        list.forEach(m => {
          const isObj = m && typeof m === 'object'
          const explicitName = isObj ? (m.nome || m.produto_nome) : ''
          const rawId = isObj ? (m.produto_id ?? m.id) : m
          const idKey = (rawId !== undefined && rawId !== null) ? String(rawId) : ''
          const resolvedName = idKey ? (produtoIdToNome.get(idKey) || '') : ''
          const nome = String(explicitName || resolvedName || idKey || '').trim()
          if (!nome) return

          const qtdRaw = isObj ? m.quantidade : undefined
          const qtd = Number(qtdRaw)
          const qtdText = Number.isFinite(qtd) && qtd > 0 ? ` — Qtd: ${qtd}` : ''
          lines.push(`${nome}${qtdText}`)
        })
        return lines
      }

      // Configurações da clínica (nome/rodapé)
      let clinicName = 'CLÍNICA ODONTOLÓGICA'
      let pdfFooterText = ''
      try {
        const cfg = await configuracoesService.buscar().catch(() => null)
        if (cfg?.nome_clinica) clinicName = String(cfg.nome_clinica)
        if (cfg?.rodape_pdf) pdfFooterText = String(cfg.rodape_pdf)
      } catch {
        // ignore
      }

      // Odontograma (estado) para o resumo
      const normalizeOdontoState = (raw) => {
        if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
        return raw
      }
      let odontogramaEstado = {}
      try {
        const od = await odontogramaService.buscarPorPaciente(id).catch(() => null)
        odontogramaEstado = normalizeOdontoState(od?.estado)
      } catch {
        odontogramaEstado = {}
      }

      const currentUser = (() => {
        try {
          const raw = localStorage.getItem('user')
          if (!raw) return { nome: 'Usuário', role: '' }
          const parsed = JSON.parse(raw)
          return { nome: String(parsed?.nome || 'Usuário'), role: String(parsed?.role || parsed?.tipo || '') }
        } catch {
          return { nome: 'Usuário', role: '' }
        }
      })()

      const emittedAtDt = new Date()
      const emittedAt = `${formatBRDate(emittedAtDt)} ${formatBRTime(emittedAtDt)}`

      const pacienteNome = paciente?.nome ? String(paciente.nome) : ''
      const pacienteCpf = paciente?.cpf ? String(paciente.cpf) : '—'
      const pacienteTelefone = paciente?.telefone ? String(paciente.telefone) : '—'
      const pacienteEmail = paciente?.email ? String(paciente.email) : '—'
      const pacienteDataNasc = paciente?.data_nascimento ? formatBRDate(paciente.data_nascimento) : '—'
      const pacienteIdade = paciente?.data_nascimento ? `${calcularIdade(paciente.data_nascimento)} anos` : ''

      // Consultas do paciente (ordenadas por data desc)
      const consultasSorted = (Array.isArray(consultas) ? consultas : [])
        .slice()
        .sort((a, b) => {
          const da = new Date(a?.data_hora || a?.data || 0).getTime()
          const db = new Date(b?.data_hora || b?.data || 0).getTime()
          return (db || 0) - (da || 0)
        })

      const chunk = (arr, size) => {
        const res = []
        for (let i = 0; i < arr.length; i += size) res.push(arr.slice(i, i + size))
        return res
      }

      const baseCss = `
        .p-page { position: relative; font-family: Arial, Helvetica, sans-serif; }
        .p-top { display:flex; justify-content:space-between; align-items:center; }
        .p-brand { display:flex; align-items:center; gap:12px; }
        .p-logo { width:54px; height:54px; object-fit:contain; }
        .p-brandName { font-weight:900; letter-spacing:0.3px; font-size:20px; color:#1f2937; text-transform:uppercase; }
        .p-emitted { font-size:12px; color:#374151; text-align:right; line-height:1.25; }
        .p-title { margin:14px 0 10px; font-size:24px; font-weight:900; color:#111827; text-align:left; text-transform:uppercase; }
        .p-hr { margin:10px 0 14px; border:0; border-top:1px solid #d1d5db; }

        .p-section { border:1px solid #b7d7c1; border-radius:10px; overflow:hidden; margin-top:14px; }
        .p-sectionTitle { background:#e7f3ea; padding:10px 14px; font-weight:900; color:#14532d; text-transform:uppercase; }
        .p-sectionBody { padding: 12px 14px 14px; background:#ffffff; }

        .p-table { width:100%; border-collapse:collapse; font-size:12.5px; }
        .p-table th, .p-table td { border:1px solid #cbd5e1; padding:8px 10px; vertical-align:top; }
        .p-table th { background:#d1fae5; color:#14532d; text-align:left; font-weight:900; }
        .p-table td { background:#ffffff; color:#111827; }

        .p-kv { width:100%; border-collapse:collapse; font-size:12.5px; }
        .p-kv td { border:1px solid #cbd5e1; padding:8px 10px; }
        .p-kv td.k { width:36%; background:#d1fae5; color:#14532d; font-weight:900; }
        .p-kv td.v { background:#ffffff; color:#111827; }

        .p-badge { display:inline-block; padding:3px 10px; border-radius:999px; background:#e7f3ea; color:#14532d; font-weight:900; font-size:12px; text-transform:capitalize; border:1px solid #b7d7c1; }
        .p-badge.red { background:#fee2e2; color:#7f1d1d; border-color:#fecaca; }
        .p-badge.gray { background:#f3f4f6; color:#374151; border-color:#e5e7eb; }

        .p-list { margin:0; padding-left:16px; }
        .p-list li { margin:2px 0; }

        .p-note { border:1px dashed #cbd5e1; border-radius:10px; padding:12px 14px; min-height:90px; color:#6b7280; background:#ffffff; }
        .p-small { font-size:12px; color:#374151; }
      `

      const styleEl = document.createElement('style')
      styleEl.setAttribute('data-paciente-report-style', '1')
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
        el.className = 'p-page'
        el.style.background = '#ffffff'
        el.style.padding = '0'
        el.innerHTML = html
        return el
      }

      const headerHtml = `
        <div class="p-top">
          <div class="p-brand">
            <img class="p-logo" src="${denteIcon}" alt="Logo" />
            <div class="p-brandName">${safeText(clinicName)}</div>
          </div>
          <div class="p-emitted">
            <div><strong>Emitido em:</strong> ${safeText(emittedAt)}</div>
            <div><strong>Profissional responsável:</strong> ${safeText(currentUser.nome)}</div>
          </div>
        </div>
        <hr class="p-hr" />
        <div class="p-title">Relatório do Paciente</div>
      `

      const dadosPacienteSection = `
        ${headerHtml}
        <div class="p-section">
          <div class="p-sectionTitle">Dados do Paciente</div>
          <div class="p-sectionBody">
            <table class="p-kv">
              <tr><td class="k">Nome</td><td class="v">${safeText(pacienteNome || '—')}</td></tr>
              <tr><td class="k">CPF</td><td class="v">${safeText(pacienteCpf)}</td></tr>
              <tr><td class="k">Data de nascimento</td><td class="v">${safeText(pacienteDataNasc)}${pacienteIdade ? ` (${safeText(pacienteIdade)})` : ''}</td></tr>
              <tr><td class="k">Telefone</td><td class="v">${safeText(pacienteTelefone)}</td></tr>
              <tr><td class="k">Email</td><td class="v">${safeText(pacienteEmail)}</td></tr>
            </table>
          </div>
        </div>
      `

      const buildConsultasTableSection = (rows, idx, totalChunks) => {
        const title = totalChunks > 1
          ? `Histórico de Consultas ${idx > 0 ? '(continuação)' : ''}`
          : 'Histórico de Consultas'

        const trs = (rows || []).map(c => {
          const dt = c?.data_hora || c?.data
          const d = formatBRDate(dt)
          const t = formatBRTime(dt)
          const status = String(c?.status || '—')
          const pago = c?.pago ? 'Sim' : 'Não'
          const valor = resolveConsultaValor(c)
          const procs = resolveConsultaProcedimentos(c)
          const procHtml = procs.length
            ? procs.map(p => `• ${safeText(p)}`).join('<br/>')
            : '—'
          const badgeClass = status.toLowerCase() === 'cancelada' ? 'red' : (status ? '' : 'gray')
          return `
            <tr>
              <td style="width:120px">${safeText(d)}<br/><span class="p-small">${safeText(t)}</span></td>
              <td style="width:110px"><span class="p-badge ${badgeClass}">${safeText(status)}</span></td>
              <td>${procHtml}</td>
              <td style="width:70px; text-align:center">${safeText(pago)}</td>
              <td style="width:90px; text-align:right">${safeText(formatMoney(valor))}</td>
            </tr>
          `
        }).join('')

        return `
          <div class="p-section">
            <div class="p-sectionTitle">${safeText(title)}</div>
            <div class="p-sectionBody">
              <table class="p-table">
                <thead>
                  <tr>
                    <th>Data/Hora</th>
                    <th>Status</th>
                    <th>Procedimentos</th>
                    <th style="text-align:center">Pago</th>
                    <th style="text-align:right">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  ${trs || '<tr><td colSpan="5">Nenhuma consulta registrada</td></tr>'}
                </tbody>
              </table>
            </div>
          </div>
        `
      }

      const buildAtendimentoSection = (c) => {
        const dt = c?.data_hora || c?.data
        const dataHora = `${formatBRDate(dt)} ${formatBRTime(dt)}`.trim()
        const procedimentos = resolveConsultaProcedimentos(c)
        const materiais = resolveConsultaMateriais(c)
        const obs = (() => {
          const o = c?.observacoes
          const d = c?.descricao
          const t = (o && String(o).trim()) ? String(o) : ((d && String(d).trim()) ? String(d) : '')
          return t || '—'
        })()

        return `
          <div class="p-section">
            <div class="p-sectionTitle">Atendimento — ${safeText(dataHora || '—')}</div>
            <div class="p-sectionBody">
              <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                <div>
                  <div style="font-weight:900; color:#14532d; margin-bottom:6px;">Procedimentos</div>
                  ${procedimentos.length ? `<ul class="p-list">${procedimentos.map(p => `<li>${safeText(p)}</li>`).join('')}</ul>` : '<div>—</div>'}
                </div>
                <div>
                  <div style="font-weight:900; color:#14532d; margin-bottom:6px;">Materiais Utilizados</div>
                  ${materiais.length ? `<ul class="p-list">${materiais.map(m => `<li>${safeText(m)}</li>`).join('')}</ul>` : '<div>Não informado</div>'}
                </div>
              </div>
              <div style="margin-top:12px;">
                <div style="font-weight:900; color:#14532d; margin-bottom:6px;">Observações Clínicas</div>
                <div>${safeText(obs)}</div>
              </div>
            </div>
          </div>
        `
      }

      const buildOdontoVisualSection = () => {
        const upper = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28]
        const lower = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38]

        const condColors = {
          saudavel: { bg: '#dcfce7', fg: '#14532d', br: '#86efac', label: 'Saudável' },
          carie: { bg: '#fee2e2', fg: '#7f1d1d', br: '#fecaca', label: 'Cárie' },
          restauracao: { bg: '#dbeafe', fg: '#1e3a8a', br: '#bfdbfe', label: 'Restauração' },
          tratamento: { bg: '#fef3c7', fg: '#78350f', br: '#fde68a', label: 'Em tratamento' },
          ausente: { bg: '#e5e7eb', fg: '#374151', br: '#d1d5db', label: 'Ausente' },
          default: { bg: '#ffffff', fg: '#111827', br: '#cbd5e1', label: 'Sem registro' }
        }

        const getEntry = (toothId) => {
          const key = String(toothId)
          const entry = odontogramaEstado?.[key]
          const condition = String(entry?.condition || '').toLowerCase()
          const pal = condColors[condition] || condColors.default
          const faces = Array.isArray(entry?.faces) ? entry.faces : []
          const note = entry?.note ? String(entry.note) : ''
          const updatedAt = entry?.updatedAt ? `${formatBRDate(entry.updatedAt)} ${formatBRTime(entry.updatedAt)}`.trim() : ''
          return { key, condition, pal, faces, note, updatedAt }
        }

        const cell = (toothId) => {
          const e = getEntry(toothId)
          const facesText = e.faces && e.faces.length ? e.faces.join('') : ''
          const sub = facesText ? `<div style="font-size:11px; opacity:0.85; margin-top:4px;">Faces: ${safeText(facesText)}</div>` : ''
          return `
            <div style="border:1px solid ${e.pal.br}; border-radius:10px; padding:8px 7px; background:${e.pal.bg}; color:${e.pal.fg}; min-height:56px; display:flex; flex-direction:column; justify-content:center; box-sizing:border-box;">
              <div style="display:flex; justify-content:space-between; align-items:center;">
                <div style="font-weight:900; font-size:16px;">${safeText(toothId)}</div>
                <div style="font-size:11px; font-weight:900; text-transform:uppercase;">${safeText(e.pal.label)}</div>
              </div>
              ${sub}
            </div>
          `
        }

        const legend = [
          condColors.saudavel,
          condColors.carie,
          condColors.restauracao,
          condColors.tratamento,
          condColors.ausente,
          condColors.default
        ].map(p => `
          <div style="display:flex; align-items:center; gap:8px; border:1px solid #e5e7eb; border-radius:999px; padding:6px 10px; background:#fff;">
            <span style="width:12px; height:12px; border-radius:999px; background:${p.bg}; border:1px solid ${p.br}; display:inline-block;"></span>
            <span style="font-size:12px; color:#374151; font-weight:800;">${safeText(p.label)}</span>
          </div>
        `).join('')

        return `
          <div class="p-section">
            <div class="p-sectionTitle">Odontograma — Situação do Paciente</div>
            <div class="p-sectionBody">
              <div class="p-small" style="margin-bottom:10px;">Legenda e visão geral do odontograma (representação para impressão).</div>
              <div style="display:flex; flex-wrap:wrap; gap:8px; margin-bottom:12px;">${legend}</div>

              <div style="font-weight:900; color:#14532d; margin:10px 0 6px;">Arcada Superior</div>
              <div style="display:grid; grid-template-columns: repeat(8, minmax(0, 1fr)); gap:8px;">
                ${upper.map(id => cell(id)).join('')}
              </div>

              <div style="font-weight:900; color:#14532d; margin:12px 0 6px;">Arcada Inferior</div>
              <div style="display:grid; grid-template-columns: repeat(8, minmax(0, 1fr)); gap:8px;">
                ${lower.map(id => cell(id)).join('')}
              </div>
            </div>
          </div>
        `
      }

      const buildOdontoNotesSection = () => {
        const condColors = {
          saudavel: { label: 'Saudável' },
          carie: { label: 'Cárie' },
          restauracao: { label: 'Restauração' },
          tratamento: { label: 'Em tratamento' },
          ausente: { label: 'Ausente' },
          default: { label: 'Sem registro' }
        }

        const notes = []
        Object.entries(odontogramaEstado || {}).forEach(([tooth, entry]) => {
          const note = entry?.note ? String(entry.note).trim() : ''
          const faces = Array.isArray(entry?.faces) ? entry.faces : []
          const condition = String(entry?.condition || '').toLowerCase()
          if (!note && faces.length === 0 && !condition) return
          const pal = condColors[condition] || condColors.default
          const upd = entry?.updatedAt ? `${formatBRDate(entry.updatedAt)} ${formatBRTime(entry.updatedAt)}`.trim() : ''
          notes.push({ tooth, label: pal.label, faces: faces.join(', '), note, updatedAt: upd })
        })
        notes.sort((a, b) => Number(a.tooth) - Number(b.tooth))

        const notesHtml = notes.length
          ? `<table class="p-table">
              <thead>
                <tr>
                  <th style="width:70px;">Dente</th>
                  <th style="width:140px;">Condição</th>
                  <th style="width:120px;">Faces</th>
                  <th>Observação</th>
                  <th style="width:170px;">Atualização</th>
                </tr>
              </thead>
              <tbody>
                ${notes.map(r => `
                  <tr>
                    <td>${safeText(r.tooth)}</td>
                    <td>${safeText(r.label)}</td>
                    <td>${safeText(r.faces || '—')}</td>
                    <td>${safeText(r.note || '—')}</td>
                    <td>${safeText(r.updatedAt || '—')}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>`
          : `<div class="p-small">Nenhuma observação/face registrada no odontograma.</div>`

        return `
          <div class="p-section">
            <div class="p-sectionTitle">Odontograma — Detalhes</div>
            <div class="p-sectionBody">
              ${notesHtml}
            </div>
          </div>
        `
      }

      const buildObsGeraisSection = () => `
        <div class="p-section">
          <div class="p-sectionTitle">Observações Gerais</div>
          <div class="p-sectionBody">
            <div class="p-note">Espaço livre para anotações clínicas ou administrativas.</div>
          </div>
        </div>
      `

      const sections = []
      sections.push(makeSection(dadosPacienteSection))

      // Histórico de consultas em páginas (tamanho pensado para caber em A4)
      const consultaChunks = chunk(consultasSorted, 12)
      if (consultaChunks.length === 0) {
        sections.push(makeSection(buildConsultasTableSection([], 0, 1)))
      } else {
        consultaChunks.forEach((rows, i) => {
          sections.push(makeSection(buildConsultasTableSection(rows, i, consultaChunks.length)))
        })
      }

      // Atendimentos detalhados (somente realizadas por padrão; se não houver, pega as mais recentes)
      const realizadas = consultasSorted.filter(c => String(c?.status || '').toLowerCase() === 'realizada')
      const detalhesBase = realizadas.length ? realizadas : consultasSorted
      const detalhes = detalhesBase.slice(0, 6) // mantém o PDF curto e útil
      detalhes.forEach(c => sections.push(makeSection(buildAtendimentoSection(c))))

      // Odontograma (página visual)
      sections.push(makeSection(buildOdontoVisualSection()))
      sections.push(makeSection(buildOdontoNotesSection()))

      // Observações gerais
      sections.push(makeSection(buildObsGeraisSection()))

      // Renderiza e gera PDF
      const pdf = new jsPDF('p', 'mm', 'a4')
      const pageWidth = pdf.internal.pageSize.getWidth()
      const pageHeight = pdf.internal.pageSize.getHeight()
      const marginX = 10
      const marginTop = 10
      const marginBottom = 16
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

      const totalPages = pdf.getNumberOfPages()
      for (let p = 1; p <= totalPages; p++) {
        pdf.setPage(p)
        pdf.setFontSize(9)
        pdf.setTextColor(107, 114, 128)

        const leftLine1 = pdfFooterText ? String(pdfFooterText) : 'Documento gerado pelo Sistema Odontológico'
        const leftLine2 = `Responsável: ${currentUser.nome}${currentUser.role ? ` (${currentUser.role})` : ''}`
        pdf.text(leftLine1, marginX, pageHeight - 10, { align: 'left', maxWidth: pageWidth - marginX * 2 })
        pdf.text(leftLine2, marginX, pageHeight - 6, { align: 'left', maxWidth: pageWidth - marginX * 2 })

        pdf.text(`Página ${p} de ${totalPages}`, pageWidth - marginX, pageHeight - 8, { align: 'right' })
      }

      const fileSafeName = (pacienteNome || id).trim().replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_-]/g, '')
      const y = emittedAtDt.getFullYear()
      const m = pad2(emittedAtDt.getMonth() + 1)
      const d = pad2(emittedAtDt.getDate())
      pdf.save(`relatorio_paciente_${fileSafeName}_${y}-${m}-${d}.pdf`)

      root.remove()
      styleEl.remove()
    } catch (err) {
      alert('Não foi possível exportar o prontuário: ' + (err.message || err))
    } finally {
      setExportandoPdf(false)
    }
  }

  // Preload product names for rendering materials lists
  useEffect(() => {
    let mounted = true
    estoqueService.listar()
      .then((produtos) => {
        if (!mounted) return
        const list = Array.isArray(produtos) ? produtos : []
        setProdutoIdToNome(new Map(list.map(p => [String(p?.id ?? ''), String(p?.nome ?? '')])))
      })
      .catch(() => {})
    return () => { mounted = false }
  }, [])

  useEffect(() => {
    galeriaImagensRef.current = galeriaImagens
  }, [galeriaImagens])

  useEffect(() => {
    return () => {
      try {
        galeriaImagensRef.current.forEach(img => {
          if (img?.url) URL.revokeObjectURL(img.url)
        })
      } catch (e) {
        console.warn('Erro ao limpar URLs da galeria', e)
      }
    }
  }, [])

  // Listen for deletions elsewhere and refresh if it affects this patient
  useEffect(() => {
    const onDeleted = (e) => {
      try {
        const pid = e?.detail?.paciente_id
        if (pid && pid === id) {
          consultasService.porPaciente(id).then(d => setConsultas(d || [])).catch(() => {})
        }
      } catch (err) {
        console.warn('Erro ao processar evento consultaDeleted', err)
      }
    }
    window.addEventListener('consultaDeleted', onDeleted)
    return () => window.removeEventListener('consultaDeleted', onDeleted)
  }, [id])

  const carregarPaciente = useCallback(async () => {
    try {
      // Buscar paciente usando o serviço
      const dados = await pacientesService.buscar(id)
      setPaciente(dados)
      setFormData(dados)
      
      // Carregar consultas
      const consultsResponse = await consultasService.porPaciente(id)
      setConsultas(consultsResponse || [])
    } catch (err) {
      console.error('Erro ao carregar paciente:', err)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    carregarPaciente()
  }, [carregarPaciente])

  const calcularIdade = (dataNascimento) => {
    const hoje = new Date()
    const nascimento = new Date(dataNascimento)
    let idade = hoje.getFullYear() - nascimento.getFullYear()
    const mes = hoje.getMonth() - nascimento.getMonth()
    if (mes < 0 || (mes === 0 && hoje.getDate() < nascimento.getDate())) {
      idade--
    }
    return idade
  }

  const handleSalvarEdicao = async (e) => {
    e.preventDefault()
    try {
      await pacientesService.atualizar(id, formData)
      setPaciente(formData)
      setShowEditForm(false)
    } catch (err) {
      console.error('Erro ao salvar:', err)
    }
  }

  const handleGaleriaUpload = (e) => {
    const files = Array.from(e.target.files || []).filter(f => f && String(f.type || '').startsWith('image/'))
    if (!files.length) return

    const novos = files.map(file => ({
      id: `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(16).slice(2)}`,
      file,
      url: URL.createObjectURL(file)
    }))

    setGaleriaImagens(prev => [...prev, ...novos])
    e.target.value = ''
  }

  if (loading) return <div className={styles.loading}>Carregando...</div>
  if (!paciente) return <div className={styles.notFound}>Paciente não encontrado</div>

  const dataNascFormatada = new Date(paciente.data_nascimento).toLocaleDateString('pt-BR')
  const idade = calcularIdade(paciente.data_nascimento)

  return (
    <div className={styles.container}>
      {/* Card de informações principais */}
      <div className={styles.cardPrincipal}>
        <div className={styles.fotoNome}>
          <div className={styles.foto}>
            <span>👤</span>
          </div>
          <div className={styles.infoBasica}>
            <h1>{paciente.nome}</h1>
            <p>CPF: {paciente.cpf || '—'}</p>
            <p>📅 {dataNascFormatada} ({idade} anos)</p>
          </div>
        </div>
        <div className={styles.botoesAcao}>
          <button className={styles.btnEditar} onClick={() => setShowEditForm(true)}>
            Editar
          </button>
        </div>
      </div>

      {/* Abas */}
      <div className={styles.abas}>
        <button
          className={`${styles.aba} ${abaSelecionada === 'dados' ? styles.abaSelecionada : ''}`}
          onClick={() => setAbaSelecionada('dados')}
        >
          Dados
        </button>
        <button
          className={`${styles.aba} ${abaSelecionada === 'consultas' ? styles.abaSelecionada : ''}`}
          onClick={() => setAbaSelecionada('consultas')}
        >
          Consultas
        </button>
        <button
          className={`${styles.aba} ${abaSelecionada === 'prontuario' ? styles.abaSelecionada : ''}`}
          onClick={() => setAbaSelecionada('prontuario')}
        >
          Prontuário
        </button>
        <button
          className={`${styles.aba} ${abaSelecionada === 'odontograma' ? styles.abaSelecionada : ''}`}
          onClick={() => setAbaSelecionada('odontograma')}
        >
          Odontograma
        </button>
        <button
          className={`${styles.aba} ${abaSelecionada === 'galeria' ? styles.abaSelecionada : ''}`}
          onClick={() => setAbaSelecionada('galeria')}
        >
          Galeria
        </button>
        <button
          className={`${styles.aba} ${abaSelecionada === 'financeiro' ? styles.abaSelecionada : ''}`}
          onClick={() => setAbaSelecionada('financeiro')}
        >
          Financeiro
        </button>
      </div>

      {/* Conteúdo das abas */}
      <div className={styles.conteudoAba}>
        {abaSelecionada === 'dados' && (
          <div className={styles.abaDados}>
            <h2>Dados Pessoais</h2>
            <div className={styles.dadosGrid}>
              <div>
                <label>Nome</label>
                <p>{paciente.nome}</p>
              </div>
              <div>
                <label>CPF</label>
                <p>{paciente.cpf || '—'}</p>
              </div>
              <div>
                <label>Data de Nascimento</label>
                <p>{dataNascFormatada}</p>
              </div>
              <div>
                <label>Telefone</label>
                <p>{paciente.telefone || '—'}</p>
              </div>
              <div>
                <label>Email</label>
                <p>{paciente.email || '—'}</p>
              </div>
            </div>
          </div>
        )}

        {abaSelecionada === 'consultas' && (
          <div className={styles.abaConsultas}>
            <h2>Histórico de Consultas</h2>
            {consultas.length === 0 ? (
              <p>Nenhuma consulta registrada</p>
            ) : (
              <div className={styles.consultasList}>
                {consultas.map(c => (
                  <div key={c.id} className={styles.consultaItem} onClick={() => setSelectedConsulta(c)} style={{cursor:'pointer'}}>
                    <div className={styles.dataConsulta}>
                      {new Date(c.data_hora).toLocaleDateString('pt-BR')}
                    </div>
                    <div className={styles.tipoConsulta}>
                      {c.tipo_consulta}
                    </div>
                    <div className={styles.statusConsulta}>
                      <span className={`${styles.badge} ${styles[`status-${c.status}`]}`}>
                        {c.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {abaSelecionada === 'prontuario' && (
          <div className={styles.abaProntuario}>
            <div className={styles.headerProntuario}>
              <h2>Prontuário: Histórico de Atendimentos</h2>
              <button className={styles.btnExportarPdf} type="button" onClick={exportarProntuarioPdf} disabled={exportandoPdf}>
                {exportandoPdf ? 'Gerando PDF...' : 'Exportar PDF'}
              </button>
            </div>
            {consultas.length === 0 ? (
              <p>Nenhum atendimento registrado</p>
            ) : (
              <div className={styles.prontuarioList}>
                {consultas.map(c => (
                  <div key={c.id} className={styles.prontuarioItem} onClick={() => setSelectedConsulta(c)} style={{cursor:'pointer'}}>
                    <div className={styles.dataDentista}>
                      <strong>{new Date(c.data_hora).toLocaleDateString('pt-BR')}</strong>
                      {String(c.dentista || '').trim() ? <> Dr. {c.dentista}</> : null}
                    </div>
                    <div className={styles.procedimentos}>
                      <p><strong>Procedimentos:</strong> {c.tipo_consulta}</p>
                      {c.observacoes && <p>{c.observacoes}</p>}
                    </div>
                    <div className={styles.valorStatus}>
                      <span>R$ {c.valor ? parseFloat(c.valor).toFixed(2) : '0,00'}</span>
                      <span className={`${styles.badge} ${styles[`status-${c.status}`]}`}>
                        {c.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {abaSelecionada === 'odontograma' && (
          <div className={styles.abaOdontograma}>
            <Odontograma pacienteId={id} />
          </div>
        )}

        {abaSelecionada === 'galeria' && (
          <div className={styles.abaGaleria}>
            <h2>Galeria do Prontuário</h2>

            <div className={styles.galeriaUpload}>
              <label className={styles.galeriaUploadBtn}>
                Escolher arquivos
                <input className={styles.galeriaFileInput} type="file" accept="image/*" multiple onChange={handleGaleriaUpload} />
              </label>
            </div>

            <div className={styles.galeriaPanel}>
              {galeriaImagens.length === 0 ? (
                <p className={styles.galeriaEmpty}>Nenhuma imagem enviada</p>
              ) : (
                <div className={styles.galeriaGrid}>
                  {galeriaImagens.map(img => (
                    <button
                      key={img.id}
                      type="button"
                      className={styles.galeriaItem}
                      onClick={() => setImagemSelecionada(img)}
                      aria-label={`Visualizar ${img.file?.name || 'imagem'}`}
                    >
                      <div className={styles.galeriaThumb}>
                        <img className={styles.galeriaImg} src={img.url} alt={img.file?.name || 'Imagem'} />
                      </div>
                      <div className={styles.galeriaMeta}>{img.file?.name || ''}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {abaSelecionada === 'financeiro' && (
          <div className={styles.abaFinanceiro}>
            <h2>Situação Financeira</h2>

            {/* Finance table per consultation */}
            <div className={styles.financeTableWrap}>
              <table className={styles.financeTable}>
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Procedimentos</th>
                    <th style={{textAlign:'right'}}>Valor (R$)</th>
                  </tr>
                </thead>
                <tbody>
                  {consultas.map(c => {
                    let procedimentos = c.procedimentos
                    if (typeof procedimentos === 'string') {
                      try { procedimentos = JSON.parse(procedimentos) } catch { procedimentos = [procedimentos] }
                    }
                    const procList = Array.isArray(procedimentos) ? procedimentos : (procedimentos ? [procedimentos] : [])

                    // sum procedure values when available, fallback to consulta.valor
                    let procValueSum = 0
                    procList.forEach(p => {
                      if (!p) return
                      const val = (p && (p.valor !== undefined ? Number(p.valor) : (typeof p === 'number' ? p : NaN)))
                      if (!Number.isNaN(val)) procValueSum += val
                    })

                    const consultaValor = (procValueSum > 0) ? procValueSum : (c.valor ? Number(c.valor) : 0)

                    return (
                      <tr key={c.id}>
                        <td>{new Date(c.data_hora).toLocaleDateString('pt-BR')}</td>
                        <td>
                          {procList.length ? (
                            <ul className={styles.list}>
                              {procList.map((p, i) => (
                                <li key={i}>{(p && (p.descricao || p)) || p}</li>
                              ))}
                            </ul>
                          ) : (
                            <span>—</span>
                          )}
                        </td>
                        <td style={{textAlign:'right'}}>R$ {consultaValor.toFixed(2)}</td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={2} style={{textAlign:'right', fontWeight:700}}>Total</td>
                    <td style={{textAlign:'right', fontWeight:700}}>
                      R$ {consultas.reduce((sum, c) => {
                        let procedimentos = c.procedimentos
                        if (typeof procedimentos === 'string') {
                          try { procedimentos = JSON.parse(procedimentos) } catch { procedimentos = [procedimentos] }
                        }
                        const procList = Array.isArray(procedimentos) ? procedimentos : (procedimentos ? [procedimentos] : [])
                        let procValueSum = 0
                        procList.forEach(p => {
                          if (!p) return
                          const val = (p && (p.valor !== undefined ? Number(p.valor) : (typeof p === 'number' ? p : NaN)))
                          if (!Number.isNaN(val)) procValueSum += val
                        })
                        const consultaValor = (procValueSum > 0) ? procValueSum : (c.valor ? Number(c.valor) : 0)
                        return sum + consultaValor
                      }, 0).toFixed(2)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Modal de Edição */}
      {showEditForm && (
        <div className={styles.modal}>
          <div className={styles.modalContent}>
            <h2>Editar Paciente</h2>
            <form onSubmit={handleSalvarEdicao} className={styles.formEdicao}>
              <input
                type="text"
                placeholder="Nome"
                value={formData.nome || ''}
                onChange={e => setFormData({ ...formData, nome: e.target.value })}
                required
              />
              <input
                type="text"
                placeholder="CPF"
                value={formData.cpf || ''}
                onChange={e => setFormData({ ...formData, cpf: e.target.value })}
              />
              <input
                type="tel"
                placeholder="Telefone"
                value={formData.telefone || ''}
                onChange={e => setFormData({ ...formData, telefone: e.target.value })}
              />
              <input
                type="email"
                placeholder="Email"
                value={formData.email || ''}
                onChange={e => setFormData({ ...formData, email: e.target.value })}
              />
              <input
                type="date"
                value={formData.data_nascimento || ''}
                onChange={e => setFormData({ ...formData, data_nascimento: e.target.value })}
              />
              <div className={styles.modalActions}>
                <button type="submit" className={styles.save}>Salvar</button>
                <button type="button" onClick={() => setShowEditForm(false)} className={styles.cancel}>
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Modal de Detalhes da Consulta */}
      {selectedConsulta && (
        <div className={styles.viewModal}>
          <div className={styles.viewCard}>
            {(() => {
              const dt = new Date(selectedConsulta.data_hora)
              const dataHoraFmt = `${dt.toLocaleDateString('pt-BR')}, ${dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
              return (
                <>
                  <div className={styles.viewHeader}>
                    <h2 className={styles.viewTitle}>Consulta — {dataHoraFmt}</h2>
                  </div>

                  <div className={styles.viewBody}>
                    <div className={styles.section}>
                      <div className={styles.sectionLabel}>Dia e Hora:</div>
                      <div className={styles.sectionValue}>{dataHoraFmt}</div>
                    </div>

                    <div className={styles.section}>
                      <div className={styles.sectionLabel}>Procedimentos</div>
                      <ul className={styles.list}>
                        {(() => {
                          let procedimentos = selectedConsulta.procedimentos
                          if (!procedimentos) return <li>&nbsp;</li>
                          if (typeof procedimentos === 'string') {
                            try { procedimentos = JSON.parse(procedimentos) } catch { procedimentos = [procedimentos] }
                          }
                          const procList = Array.isArray(procedimentos)
                            ? procedimentos
                            : (procedimentos ? [procedimentos] : [])

                          if (procList.length === 0) return <li>&nbsp;</li>
                          return procList.map((p, i) => <li key={i}>{(p && (p.descricao || p)) || String(p)}</li>)
                        })()}
                      </ul>
                    </div>

                    <div className={styles.section}>
                      <div className={styles.sectionLabel}>Materiais usados</div>
                      <ul className={styles.list}>
                        {(() => {
                          let materiais = selectedConsulta.materiais
                          if (!materiais) return <li>Não informado</li>
                          if (typeof materiais === 'string') {
                            try { materiais = JSON.parse(materiais) } catch { materiais = [materiais] }
                          }
                          const matList = Array.isArray(materiais)
                            ? materiais
                            : (materiais ? [materiais] : [])

                          if (matList.length === 0) return <li>Não informado</li>
                          return matList.map((m, i) => {
                            const isObj = m && typeof m === 'object'
                            const explicitName = isObj ? (m.nome || m.produto_nome) : ''
                            const rawId = isObj ? (m.produto_id ?? m.id) : m
                            const idKey = (rawId !== undefined && rawId !== null) ? String(rawId) : ''
                            const resolvedName = idKey ? (produtoIdToNome.get(idKey) || '') : ''
                            const nome = explicitName || resolvedName || idKey

                            const qtdRaw = isObj ? m.quantidade : undefined
                            const qtd = Number(qtdRaw)
                            const qtdText = Number.isFinite(qtd) && qtd > 0 ? ` — Qtd: ${qtd}` : ''

                            return <li key={i}>{nome ? `${nome}${qtdText}` : 'Não informado'}</li>
                          })
                        })()}
                      </ul>
                    </div>

                    <div className={styles.section}>
                      <div className={styles.sectionLabel}>Observações</div>
                      <div className={styles.sectionValue}>
                        {(() => {
                          const obs = selectedConsulta.observacoes
                          const desc = selectedConsulta.descricao
                          const texto = (obs && String(obs).trim())
                            ? obs
                            : ((desc && String(desc).trim()) ? desc : '')

                          return texto ? String(texto) : 'Não informado'
                        })()}
                      </div>
                    </div>

                    <div className={styles.footer}>
                      <button className={styles.btnClose} onClick={() => setSelectedConsulta(null)}>Fechar</button>
                    </div>
                  </div>
                </>
              )
            })()}
          </div>
        </div>
      )}

      {imagemSelecionada && (
        <div className={styles.viewModal} onClick={() => setImagemSelecionada(null)}>
          <div className={styles.galeriaModalCard} onClick={(e) => e.stopPropagation()}>
            <div className={styles.viewHeader}>
              <h2 className={styles.viewTitle}>{imagemSelecionada.file?.name || 'Imagem'}</h2>
            </div>

            <div className={styles.galeriaModalBody}>
              <img
                className={styles.galeriaModalImg}
                src={imagemSelecionada.url}
                alt={imagemSelecionada.file?.name || 'Imagem'}
              />

              <div className={styles.footer}>
                <button className={styles.btnClose} onClick={() => setImagemSelecionada(null)}>Fechar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
