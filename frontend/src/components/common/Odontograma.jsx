import { useEffect, useMemo, useState } from 'react'
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

function normalizeState(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  return raw
}

export default function Odontograma({ pacienteId }) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [estado, setEstado] = useState({})
  const [selecionado, setSelecionado] = useState(null)

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

    return (
      <button
        type="button"
        className={styles.tooth}
        data-cond={entry.condition}
        data-selected={selected ? '1' : '0'}
        onClick={() => setSelecionado(toothId)}
      >
        <div className={styles.num}>{toothId}</div>
        <div className={styles.facesGrid} aria-hidden="true">
          <div className={styles.face} />
          <div className={styles.face} />
          <div className={styles.face} />
          <div className={styles.face} />
          <div className={styles.face} />
          <div className={styles.face} />
        </div>
      </button>
    )
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
          <div className={styles.archLabel}>Arcada Superior (FDI: 18 → 11 | 21 → 28)</div>
          <div className={styles.teethRow}>
            {TOOTH_IDS_UPPER.map(id => <ToothCard key={id} toothId={id} />)}
          </div>
        </div>

        <div className={styles.arch}>
          <div className={styles.archLabel}>Arcada Inferior (FDI: 48 → 41 | 31 → 38)</div>
          <div className={styles.teethRow}>
            {TOOTH_IDS_LOWER.map(id => <ToothCard key={id} toothId={id} />)}
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
