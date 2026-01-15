import { useEffect, useMemo, useRef, useState } from 'react'
import { odontogramaService } from '@services/api'
import styles from './Odontograma.module.css'

const TOOTH_IDS_UPPER = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28]
const TOOTH_IDS_LOWER = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38]

const defaultEntry = () => ({
  condition: 'saudavel',
  faces: [],
  note: '',
  updatedAt: new Date().toISOString()
})

const toothTypeFromFDI = (toothId) => {
  const n = Number(toothId)
  const pos = n % 10
  if (pos === 1 || pos === 2) return 'incisor'
  if (pos === 3) return 'canine'
  if (pos === 4 || pos === 5) return 'premolar'
  return 'molar'
}

function ToothIcon({ type }) {
  // Simple premium outline icons by tooth group.
  // If you want the EXACT contour like the reference image, we can swap these paths
  // with your odontogram SVG paths (one per tooth or per tooth type).
  if (type === 'incisor') {
    return (
      <svg viewBox="0 0 64 64" className={styles.toothSvg} aria-hidden="true">
        <path d="M28 8c-4 1-7 5-7 10 0 6 2 12 2 18 0 10 2 24 9 24s9-14 9-24c0-6 2-12 2-18 0-5-3-9-7-10-2-.5-6-.5-8 0Z" fill="none" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" />
        <path d="M24 20c2 2 6 3 8 3s6-1 8-3" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      </svg>
    )
  }

  if (type === 'canine') {
    return (
      <svg viewBox="0 0 64 64" className={styles.toothSvg} aria-hidden="true">
        <path d="M32 8c-6 2-10 8-10 15 0 6 2 11 2 17 0 13 3 22 8 22s8-9 8-22c0-6 2-11 2-17 0-7-4-13-10-15Z" fill="none" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" />
        <path d="M32 14c-3 5-6 9-10 11" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        <path d="M32 14c3 5 6 9 10 11" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      </svg>
    )
  }

  if (type === 'premolar') {
    return (
      <svg viewBox="0 0 64 64" className={styles.toothSvg} aria-hidden="true">
        <path d="M22 10c-5 3-8 9-8 16 0 6 2 11 2 17 0 14 5 19 16 19s16-5 16-19c0-6 2-11 2-17 0-7-3-13-8-16-4-2-8-2-10-2s-6 0-10 2Z" fill="none" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" />
        <path d="M22 22c3 3 7 5 10 5s7-2 10-5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      </svg>
    )
  }

  // molar
  return (
    <svg viewBox="0 0 64 64" className={styles.toothSvg} aria-hidden="true">
      <path d="M16 14c-5 4-7 10-7 18 0 6 2 11 2 17 0 12 6 13 10 13 4 0 6-2 7-6 1 4 3 6 7 6 4 0 9-1 9-13 0-6 2-11 2-17 0-8-2-14-7-18-4-3-8-3-10-3s-6 0-10 3Z" fill="none" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" />
      <path d="M22 24c2 2 6 3 10 3s8-1 10-3" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <path d="M25 32c2 1 4 2 7 2s5-1 7-2" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}

function normalizeState(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  return raw
}

const ODONTOGRAM_SVG_URL = '/odontogram-fdi.svg'

const CONDITION_COLORS = {
  saudavel: '#10b981',
  carie: '#ef4444',
  restauracao: '#3b82f6',
  tratamento: '#f59e0b',
  ausente: '#9ca3af'
}

const SELECTED_COLOR = '#22c55e'

const applyToothPaint = (toothEl, color, { selected, ausente }) => {
  const outline = toothEl.querySelectorAll('.outline')
  outline.forEach((p) => {
    p.style.stroke = color
  })

  const highlight = toothEl.querySelectorAll('.highlight')
  highlight.forEach((p) => {
    p.style.stroke = color
    p.style.opacity = selected ? '0.35' : '0'
  })

  const shadow = toothEl.querySelectorAll('.shadow')
  shadow.forEach((p) => {
    p.style.fill = color
    p.style.opacity = selected ? '0.14' : '0'
  })

  toothEl.style.opacity = !selected && ausente ? '0.55' : '1'
  toothEl.style.cursor = 'pointer'
}

export default function Odontograma({ pacienteId }) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [estado, setEstado] = useState({})
  const [selecionado, setSelecionado] = useState(null)

  const [svgMarkup, setSvgMarkup] = useState('')
  const [svgLoadError, setSvgLoadError] = useState('')
  const svgHostRef = useRef(null)

  const selecionadoKey = selecionado ? String(selecionado) : ''

  const entrySelecionado = useMemo(() => {
    if (!selecionadoKey) return null
    return estado[selecionadoKey] || defaultEntry()
  }, [estado, selecionadoKey])

  const [condicao, setCondicao] = useState('saudavel')
  const [faces, setFaces] = useState(() => new Set())
  const [nota, setNota] = useState('')

  useEffect(() => {
    let mounted = true
    const load = async () => {
      try {
        setLoading(true)
        setError('')
        const res = await odontogramaService.buscarPorPaciente(pacienteId)
        if (mounted) {
          setEstado(normalizeState(res?.estado))
        }
      } catch (err) {
        if (mounted) {
          setError(err?.message || 'Erro ao carregar odontograma')
          setEstado({})
        }
      } finally {
        if (mounted) setLoading(false)
      }
    }

    if (pacienteId) load()
    return () => { mounted = false }
  }, [pacienteId])

  useEffect(() => {
    let cancelled = false

    const loadSvg = async () => {
      try {
        setSvgLoadError('')
        const res = await fetch(ODONTOGRAM_SVG_URL, { cache: 'no-cache' })
        if (!res.ok) throw new Error(`Falha ao carregar SVG (${res.status})`)
        const text = await res.text()
        if (!cancelled) setSvgMarkup(text)
      } catch (e) {
        if (!cancelled) {
          setSvgLoadError(e?.message || 'Erro ao carregar SVG do odontograma')
          setSvgMarkup('')
        }
      }
    }

    loadSvg()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    const host = svgHostRef.current
    if (!host) return
    host.innerHTML = svgMarkup || ''
  }, [svgMarkup])

  useEffect(() => {
    const host = svgHostRef.current
    if (!host) return

    const teeth = host.querySelectorAll('.tooth[data-fdi]')
    teeth.forEach((node) => {
      const fdi = node.getAttribute('data-fdi')
      if (!fdi) return

      const entry = estado[fdi]
      const condition = entry?.condition || ''
      const isSelected = selecionadoKey === String(fdi)

      const baseColor = CONDITION_COLORS[condition] || '#cbd5e1'
      const paint = isSelected ? SELECTED_COLOR : baseColor

      node.setAttribute('data-selected', isSelected ? '1' : '0')
      node.setAttribute('data-cond', condition)

      applyToothPaint(node, paint, { selected: isSelected, ausente: condition === 'ausente' })
    })
  }, [estado, selecionadoKey, svgMarkup])

  useEffect(() => {
    if (!entrySelecionado) {
      setCondicao('saudavel')
      setFaces(new Set())
      setNota('')
      return
    }

    setCondicao(entrySelecionado.condition || 'saudavel')
    setFaces(new Set(Array.isArray(entrySelecionado.faces) ? entrySelecionado.faces : []))
    setNota(entrySelecionado.note || '')
  }, [entrySelecionado])

  const toggleFace = (f) => {
    setFaces(prev => {
      const next = new Set(prev)
      if (next.has(f)) next.delete(f)
      else next.add(f)
      return next
    })
  }

  const persist = async (nextEstado) => {
    setSaving(true)
    setError('')
    try {
      await odontogramaService.salvarPorPaciente(pacienteId, nextEstado)
    } catch (e) {
      setError(e?.message || 'Erro ao salvar odontograma')
      throw e
    } finally {
      setSaving(false)
    }
  }

  const salvarDente = async () => {
    if (!selecionadoKey) return

    const nextEstado = {
      ...estado,
      [selecionadoKey]: {
        condition: condicao,
        faces: Array.from(faces),
        note: nota || '',
        updatedAt: new Date().toISOString()
      }
    }

    setEstado(nextEstado)
    try {
      await persist(nextEstado)
    } catch {
      // keep local changes; error displayed
    }
  }

  const limparDente = async () => {
    if (!selecionadoKey) return

    const nextEstado = { ...estado }
    delete nextEstado[selecionadoKey]

    setEstado(nextEstado)
    try {
      await persist(nextEstado)
    } catch {
      // keep local changes; error displayed
    }
  }

  const ToothCard = ({ toothId }) => {
    const key = String(toothId)
    const entry = estado[key] || defaultEntry()
    const selected = selecionadoKey === key
    const type = toothTypeFromFDI(toothId)

    return (
      <button
        type="button"
        className={styles.tooth}
        data-cond={entry.condition}
        data-selected={selected ? '1' : '0'}
        onClick={() => setSelecionado(toothId)}
      >
        <div className={styles.toothIconWrap} aria-hidden="true">
          <ToothIcon type={type} />
        </div>
        <div className={styles.num}>{toothId}</div>
      </button>
    )
  }

  const onSvgClick = (e) => {
    const host = svgHostRef.current
    if (!host) return

    let el = e.target
    while (el && el !== host) {
      if (el instanceof Element && el.matches('.tooth[data-fdi]')) break
      el = el.parentNode
    }

    if (!(el instanceof Element)) return
    const tooth = el
    if (!host.contains(tooth)) return

    const fdi = tooth.getAttribute('data-fdi')
    if (!fdi) return
    setSelecionado(Number(fdi))
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.left}>
        <div className={styles.headRow}>
          <h2 className={styles.title}>Odontograma</h2>
          <div className={styles.status}>
            {saving ? 'Salvando…' : loading ? 'Carregando…' : ''}
          </div>
        </div>

        {error ? <div className={styles.error}>{error}</div> : null}

        <div className={styles.arch}>
          <div className={styles.archLabel}>Clique em um dente para editar (FDI)</div>
          <div className={styles.svgCard}>
            {svgLoadError ? <div className={styles.svgError}>{svgLoadError}</div> : null}

            {svgMarkup ? (
              <div
                ref={svgHostRef}
                className={styles.svgWrap}
                onClick={onSvgClick}
              />
            ) : (
              <div className={styles.teethFallback}>
                <div className={styles.teethRow}>
                  {TOOTH_IDS_UPPER.map(id => <ToothCard key={id} toothId={id} />)}
                </div>
                <div className={styles.teethRow} style={{ marginTop: 10 }}>
                  {TOOTH_IDS_LOWER.map(id => <ToothCard key={id} toothId={id} />)}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className={styles.legend} aria-label="Legenda">
          <span className={styles.pill}><span className={styles.dot} style={{ background: 'var(--ok)' }} /> Saudável</span>
          <span className={styles.pill}><span className={styles.dot} style={{ background: 'var(--danger)' }} /> Cárie</span>
          <span className={styles.pill}><span className={styles.dot} style={{ background: 'var(--info)' }} /> Restauração</span>
          <span className={styles.pill}><span className={styles.dot} style={{ background: 'var(--warn)' }} /> Em tratamento</span>
          <span className={styles.pill}><span className={styles.dot} style={{ background: 'var(--neutral)' }} /> Ausente</span>
        </div>
      </div>

      <div className={styles.right}>
        <div className={styles.editorCard}>
          <div className={styles.editorHd}>Editor</div>
          <div className={styles.editorBd}>
            <div className={styles.row}>
              <label>Dente selecionado</label>
              <input value={selecionadoKey ? selecionadoKey : '(clique em um dente)'} disabled />
            </div>

            <div className={styles.row}>
              <label>Condição</label>
              <select
                value={condicao}
                onChange={(e) => setCondicao(e.target.value)}
                disabled={!selecionadoKey || saving || loading}
              >
                <option value="saudavel">Saudável</option>
                <option value="carie">Cárie</option>
                <option value="restauracao">Restauração</option>
                <option value="tratamento">Em tratamento</option>
                <option value="ausente">Ausente</option>
              </select>
            </div>

            <div className={styles.row}>
              <label>Faces (opcional)</label>
              <div className={styles.facesPick}>
                {['V', 'M', 'O', 'D', 'L'].map(f => (
                  <button
                    key={f}
                    type="button"
                    className={styles.chip}
                    data-on={faces.has(f) ? '1' : '0'}
                    onClick={() => toggleFace(f)}
                    disabled={!selecionadoKey || saving || loading}
                  >
                    {f}
                  </button>
                ))}
              </div>
              <div className={styles.hint}>V=Vestibular, L=Lingual, O=Oclusal, M=Mesial, D=Distal.</div>
            </div>

            <div className={styles.row}>
              <label>Observação (opcional)</label>
              <textarea
                value={nota}
                onChange={(e) => setNota(e.target.value)}
                placeholder="Ex.: Sensibilidade, fratura, etc."
                disabled={!selecionadoKey || saving || loading}
              />
            </div>

            <div className={styles.actions}>
              <button
                className={styles.primary}
                onClick={salvarDente}
                disabled={!selecionadoKey || saving || loading}
                type="button"
              >
                Salvar
              </button>
              <button
                onClick={limparDente}
                disabled={!selecionadoKey || saving || loading}
                type="button"
              >
                Limpar dente
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
