import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import styles from './Configuracoes.module.css'
import { configuracoesService } from '../services/api'
import { useAuth } from '../context/useAuth'

export default function Configuracoes() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const isAdmin = useMemo(() => user?.role === 'admin', [user?.role])

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [form, setForm] = useState({
    nome_clinica: '',
    telefone_clinica: '',
    email_clinica: '',
    endereco_clinica: '',
    rodape_pdf: ''
  })

  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light')

  useEffect(() => {
    const applyTheme = (t) => {
      if (typeof document === 'undefined') return
      document.documentElement.dataset.theme = t
    }
    applyTheme(theme)
    localStorage.setItem('theme', theme)
  }, [theme])

  useEffect(() => {
    let alive = true
    const run = async () => {
      setLoading(true)
      setError('')
      setSuccess('')
      try {
        const data = await configuracoesService.buscar()
        if (!alive) return
        setForm({
          nome_clinica: data?.nome_clinica ?? '',
          telefone_clinica: data?.telefone_clinica ?? '',
          email_clinica: data?.email_clinica ?? '',
          endereco_clinica: data?.endereco_clinica ?? '',
          rodape_pdf: data?.rodape_pdf ?? ''
        })
      } catch (e) {
        if (!alive) return
        setError(e.message || 'Erro ao carregar configurações')
      } finally {
        if (alive) setLoading(false)
      }
    }
    run()
    return () => { alive = false }
  }, [])

  const onChange = (key) => (e) => {
    const value = e.target.value
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const handleSave = async () => {
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      const updated = await configuracoesService.atualizar(form)
      setForm({
        nome_clinica: updated?.nome_clinica ?? '',
        telefone_clinica: updated?.telefone_clinica ?? '',
        email_clinica: updated?.email_clinica ?? '',
        endereco_clinica: updated?.endereco_clinica ?? '',
        rodape_pdf: updated?.rodape_pdf ?? ''
      })
      setSuccess('Configurações salvas com sucesso.')
    } catch (e) {
      setError(e.message || 'Erro ao salvar configurações')
    } finally {
      setSaving(false)
    }
  }

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <h2>Configurações</h2>

        {error ? <div className={styles.alertError}>{error}</div> : null}
        {success ? <div className={styles.alertSuccess}>{success}</div> : null}
        {!isAdmin ? (
          <div className={styles.alertInfo}>Você está em modo somente leitura. Apenas administradores podem editar.</div>
        ) : null}

        <div className={styles.box}>
          <div className={styles.sectionTitle}>Clínica</div>

          <div className={styles.field}>
            <label>Nome da Clínica</label>
            <div className={styles.inputRow}>
              <input
                className={styles.textInput}
                value={form.nome_clinica}
                disabled={!isAdmin || loading}
                onChange={onChange('nome_clinica')}
                placeholder="Ex.: Clínica Sorriso"
              />
            </div>
          </div>

          <div className={styles.field}>
            <label>Telefone / WhatsApp</label>
            <div className={styles.inputRow}>
              <input
                className={styles.textInput}
                value={form.telefone_clinica}
                disabled={!isAdmin || loading}
                onChange={onChange('telefone_clinica')}
                placeholder="(11) 99999-9999"
              />
            </div>
          </div>

          <div className={styles.field}>
            <label>E-mail</label>
            <div className={styles.inputRow}>
              <input
                type="email"
                className={styles.textInput}
                value={form.email_clinica}
                disabled={!isAdmin || loading}
                onChange={onChange('email_clinica')}
                placeholder="contato@clinica.com"
              />
            </div>
          </div>

          <div className={styles.field}>
            <label>Endereço</label>
            <div className={styles.inputRow}>
              <input
                className={styles.textInput}
                value={form.endereco_clinica}
                disabled={!isAdmin || loading}
                onChange={onChange('endereco_clinica')}
                placeholder="Rua, nº, bairro, cidade"
              />
            </div>
          </div>

          <div className={styles.field}>
            <label>Rodapé do PDF</label>
            <div className={styles.inputRow}>
              <textarea
                className={styles.textArea}
                value={form.rodape_pdf}
                disabled={!isAdmin || loading}
                onChange={onChange('rodape_pdf')}
                placeholder="Ex.: Rua X, nº Y — WhatsApp (..) — www..."
                rows={3}
              />
            </div>
          </div>

          <div className={styles.divider} />

          <div className={styles.sectionTitle}>Preferências</div>

          <div className={styles.field}>
            <label>Tema</label>
            <div className={styles.sub}>
              <div className={styles.note}>Escolha entre claro e escuro (salvo neste navegador).</div>
              <select
                value={theme}
                onChange={(e) => setTheme(e.target.value)}
                className={styles.select}
              >
                <option value="light">Claro</option>
                <option value="dark">Escuro</option>
              </select>
            </div>
          </div>

          {isAdmin ? (
            <div className={styles.actionsRow}>
              <button
                className={styles.primaryBtn}
                onClick={handleSave}
                disabled={saving || loading}
              >
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          ) : null}
        </div>
      </div>

      <div className={styles.adminSection}>
        <h3>Conta</h3>
        <div className={styles.logoutRow}>
          <button className={styles.logout} onClick={handleLogout}>Sair do Sistema</button>
        </div>
      </div>
    </div>
  )
}
