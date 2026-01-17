import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import styles from './Configuracoes.module.css'
import { configuracoesService } from '../services/api'
import { useAuth } from '../context/useAuth'
import { applyClinicTheme, normalizeHex, normalizeThemeUi } from '../services/theme'

export default function Configuracoes() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const isAdmin = useMemo(() => user?.role === 'admin', [user?.role])

  const TABS = useMemo(() => ([
    { id: 'identidade', label: 'Identidade da Clínica' },
    { id: 'contato', label: 'Contato & Localização' },
    { id: 'aparencia', label: 'Aparência' },
    { id: 'comunicacao', label: 'Comunicação' },
    { id: 'conta', label: 'Conta' }
  ]), [])

  const [activeTab, setActiveTab] = useState('identidade')

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [form, setForm] = useState({
    nome_clinica: '',
    cro_responsavel: '',
    telefone_clinica: '',
    email_clinica: '',
    endereco_clinica: '',
    logo_claro: '',
    logo_escuro: '',
    rodape_pdf: '',
    tema_ui: 'system',
    tema_ui_admin: 'system',
    tema_ui_dentista: 'system',
    tema_ui_recepcao: 'system',
    cor_primaria: '#2563eb',
    lembrete_whatsapp_ativo: true,
    lembrete_email_ativo: false,
    mensagem_lembrete: 'Olá {{paciente}}, sua consulta com o Dr. {{dentista}} é amanhã às {{hora}}.'
  })

  const [previewLogo, setPreviewLogo] = useState(null)

  const currentRole = useMemo(() => String(user?.role || '').toLowerCase(), [user?.role])
  const currentRoleThemeKey = useMemo(() => {
    if (currentRole === 'admin') return 'tema_ui_admin'
    if (currentRole === 'dentista') return 'tema_ui_dentista'
    if (currentRole === 'recepcao') return 'tema_ui_recepcao'
    return 'tema_ui'
  }, [currentRole])

  const effectiveThemeUi = useMemo(() => {
    // Preferência por perfil (se existir) > legado global > system
    return normalizeThemeUi(form?.[currentRoleThemeKey] || form?.tema_ui || 'system')
  }, [form, currentRoleThemeKey])

  // Mantém o tema (claro/escuro/sistema) e a cor primária aplicados globalmente.
  useEffect(() => {
    const cleanup = applyClinicTheme(form.cor_primaria, effectiveThemeUi)
    return () => cleanup?.()
  }, [form.cor_primaria, effectiveThemeUi])

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
          cro_responsavel: data?.cro_responsavel ?? '',
          telefone_clinica: data?.telefone_clinica ?? '',
          email_clinica: data?.email_clinica ?? '',
          endereco_clinica: data?.endereco_clinica ?? '',
          logo_claro: data?.logo_claro ?? '',
          logo_escuro: data?.logo_escuro ?? '',
          rodape_pdf: data?.rodape_pdf ?? '',
          tema_ui: normalizeThemeUi(data?.tema_ui || 'system'),
          tema_ui_admin: normalizeThemeUi(data?.tema_ui_admin || ''),
          tema_ui_dentista: normalizeThemeUi(data?.tema_ui_dentista || ''),
          tema_ui_recepcao: normalizeThemeUi(data?.tema_ui_recepcao || ''),
          cor_primaria: normalizeHex(data?.cor_primaria ?? '#2563eb'),
          lembrete_whatsapp_ativo: String(data?.lembrete_whatsapp_ativo ?? 'true') === 'true',
          lembrete_email_ativo: String(data?.lembrete_email_ativo ?? 'false') === 'true',
          mensagem_lembrete: data?.mensagem_lembrete
            ?? 'Olá {{paciente}}, sua consulta com o Dr. {{dentista}} é amanhã às {{hora}}.'
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

  const onToggle = (key) => (e) => {
    const checked = !!e.target.checked
    setForm((prev) => ({ ...prev, [key]: checked }))
  }

  const handleThemeChangeFor = (key, value) => {
    const v = normalizeThemeUi(value)
    setForm((prev) => ({ ...prev, [key]: v }))
  }

  const handlePrimaryColorChange = (value) => {
    setForm((prev) => {
      const nextColor = normalizeHex(value)
      return { ...prev, cor_primaria: nextColor }
    })
  }

  const pickFileAsDataUrl = async (file) => {
    if (!file) return ''
    const maxMb = 2.5
    if (file.size > maxMb * 1024 * 1024) {
      throw new Error(`Arquivo muito grande. Máx: ${maxMb}MB`)
    }
    return await new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onerror = () => reject(new Error('Falha ao ler arquivo'))
      reader.onload = () => resolve(String(reader.result || ''))
      reader.readAsDataURL(file)
    })
  }

  const handleLogoUpload = (key) => async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      setError('')
      const dataUrl = await pickFileAsDataUrl(file)
      setForm((prev) => ({ ...prev, [key]: dataUrl }))
    } catch (err) {
      setError(err?.message || 'Erro ao carregar imagem')
    } finally {
      e.target.value = ''
    }
  }

  const handleSave = async () => {
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      const payload = {
        ...form,
        cor_primaria: normalizeHex(form.cor_primaria),
        tema_ui: normalizeThemeUi(form.tema_ui),
        tema_ui_admin: normalizeThemeUi(form.tema_ui_admin),
        tema_ui_dentista: normalizeThemeUi(form.tema_ui_dentista),
        tema_ui_recepcao: normalizeThemeUi(form.tema_ui_recepcao),
        lembrete_whatsapp_ativo: String(!!form.lembrete_whatsapp_ativo),
        lembrete_email_ativo: String(!!form.lembrete_email_ativo)
      }

      const updated = await configuracoesService.atualizar(payload)
      setForm({
        nome_clinica: updated?.nome_clinica ?? '',
        cro_responsavel: updated?.cro_responsavel ?? '',
        telefone_clinica: updated?.telefone_clinica ?? '',
        email_clinica: updated?.email_clinica ?? '',
        endereco_clinica: updated?.endereco_clinica ?? '',
        logo_claro: updated?.logo_claro ?? '',
        logo_escuro: updated?.logo_escuro ?? '',
        rodape_pdf: updated?.rodape_pdf ?? '',
        tema_ui: normalizeThemeUi(updated?.tema_ui || 'system'),
        tema_ui_admin: normalizeThemeUi(updated?.tema_ui_admin || ''),
        tema_ui_dentista: normalizeThemeUi(updated?.tema_ui_dentista || ''),
        tema_ui_recepcao: normalizeThemeUi(updated?.tema_ui_recepcao || ''),
        cor_primaria: normalizeHex(updated?.cor_primaria ?? '#2563eb'),
        lembrete_whatsapp_ativo: String(updated?.lembrete_whatsapp_ativo ?? 'true') === 'true',
        lembrete_email_ativo: String(updated?.lembrete_email_ativo ?? 'false') === 'true',
        mensagem_lembrete: updated?.mensagem_lembrete
          ?? 'Olá {{paciente}}, sua consulta com o Dr. {{dentista}} é amanhã às {{hora}}.'
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

  const googleMapsUrl = useMemo(() => {
    const addr = String(form.endereco_clinica || '').trim()
    if (!addr) return ''
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addr)}`
  }, [form.endereco_clinica])

  const renderSaveBar = () => (
    <div className={styles.stickyActions}>
      <button
        className={styles.primaryBtn}
        onClick={handleSave}
        disabled={!isAdmin || saving || loading}
      >
        {saving ? 'Salvando...' : 'Salvar Alterações'}
      </button>
    </div>
  )

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Configurações</h1>
          <div className={styles.subtitle}>Dr. Neto Abreu – Clínica Odontológica</div>
        </div>
      </div>

      {error ? <div className={styles.alertError}>{error}</div> : null}
      {success ? <div className={styles.alertSuccess}>{success}</div> : null}
      {!isAdmin ? (
        <div className={styles.alertInfo}>Você está em modo somente leitura. Apenas administradores podem editar.</div>
      ) : null}

      <div className={styles.tabs} role="tablist" aria-label="Configurações">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={activeTab === t.id}
            className={activeTab === t.id ? `${styles.tab} ${styles.tabActive}` : styles.tab}
            onClick={() => setActiveTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'identidade' ? (
        <div className={styles.card}>
          <div className={styles.cardTop}>
            <div>
              <h2 className={styles.cardTitle}>Identidade da Clínica</h2>
              <div className={styles.cardDesc}>Como sua clínica aparece para os pacientes</div>
            </div>
          </div>

          <div className={styles.formGrid}>
            <div className={styles.field}>
              <label className={styles.label}>Nome da Clínica</label>
              <input
                className={styles.textInput}
                value={form.nome_clinica}
                disabled={!isAdmin || loading}
                onChange={onChange('nome_clinica')}
                placeholder="Dr. Neto Abreu – Clínica Odontológica"
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label}>CRO Responsável</label>
              <input
                className={styles.textInput}
                value={form.cro_responsavel}
                disabled={!isAdmin || loading}
                onChange={onChange('cro_responsavel')}
                placeholder="SP-123456"
              />
            </div>

            <div className={styles.logoRow}>
              <div className={styles.logoCard}>
                <div className={styles.logoTitle}>Logo claro</div>
                <div className={styles.logoDrop}>
                  {form.logo_claro ? (
                    <img className={styles.logoImg} src={form.logo_claro} alt="Logo claro" />
                  ) : (
                    <div className={styles.logoPlaceholder}>Área de upload</div>
                  )}
                </div>
                <div className={styles.logoActions}>
                  <label className={styles.secondaryBtn}>
                    Upload
                    <input type="file" accept="image/*" className={styles.fileInput} onChange={handleLogoUpload('logo_claro')} disabled={!isAdmin || loading} />
                  </label>
                  <button type="button" className={styles.ghostBtn} disabled={!form.logo_claro} onClick={() => setPreviewLogo({ title: 'Logo claro', src: form.logo_claro })}>
                    Pré-visualizar
                  </button>
                </div>
              </div>

              <div className={styles.logoCard}>
                <div className={styles.logoTitle}>Logo escuro</div>
                <div className={styles.logoDrop}>
                  {form.logo_escuro ? (
                    <img className={styles.logoImg} src={form.logo_escuro} alt="Logo escuro" />
                  ) : (
                    <div className={styles.logoPlaceholder}>Área de upload</div>
                  )}
                </div>
                <div className={styles.logoActions}>
                  <label className={styles.secondaryBtn}>
                    Upload
                    <input type="file" accept="image/*" className={styles.fileInput} onChange={handleLogoUpload('logo_escuro')} disabled={!isAdmin || loading} />
                  </label>
                  <button type="button" className={styles.ghostBtn} disabled={!form.logo_escuro} onClick={() => setPreviewLogo({ title: 'Logo escuro', src: form.logo_escuro })}>
                    Pré-visualizar
                  </button>
                </div>
              </div>
            </div>

            <div className={styles.field} style={{ gridColumn: '1 / -1' }}>
              <label className={styles.label}>Assinatura Profissional</label>
              <textarea
                className={styles.textArea}
                value={form.rodape_pdf}
                disabled={!isAdmin || loading}
                onChange={onChange('rodape_pdf')}
                placeholder="Dr. Neto Abreu – CRO/SP 00000"
                rows={3}
              />
              <div className={styles.helper}>Assinatura exibida em orçamentos, recibos e PDFs</div>
            </div>
          </div>

          {isAdmin ? renderSaveBar() : null}
        </div>
      ) : null}

      {activeTab === 'contato' ? (
        <div className={styles.card}>
          <div className={styles.cardTop}>
            <div>
              <h2 className={styles.cardTitle}>Contato & Localização</h2>
              <div className={styles.cardDesc}>Dados usados em lembretes e documentos</div>
            </div>
            <div className={styles.cardTopActions}>
              <a
                className={styles.secondaryLinkBtn}
                href={googleMapsUrl || undefined}
                target="_blank"
                rel="noreferrer"
                aria-disabled={!googleMapsUrl}
                onClick={(e) => { if (!googleMapsUrl) e.preventDefault() }}
              >
                📍 Ver no Google Maps
              </a>
            </div>
          </div>

          <div className={styles.formGrid}>
            <div className={styles.field}>
              <label className={styles.label}>WhatsApp da clínica</label>
              <input
                className={styles.textInput}
                value={form.telefone_clinica}
                disabled={!isAdmin || loading}
                onChange={onChange('telefone_clinica')}
                placeholder="(11) 99999-9999"
              />
              <div className={styles.helper}>Usado para lembretes automáticos</div>
            </div>
            <div className={styles.field}>
              <label className={styles.label}>E-mail administrativo</label>
              <input
                type="email"
                className={styles.textInput}
                value={form.email_clinica}
                disabled={!isAdmin || loading}
                onChange={onChange('email_clinica')}
                placeholder="admin@clinica.com"
              />
            </div>
            <div className={styles.field} style={{ gridColumn: '1 / -1' }}>
              <label className={styles.label}>Endereço completo</label>
              <input
                className={styles.textInput}
                value={form.endereco_clinica}
                disabled={!isAdmin || loading}
                onChange={onChange('endereco_clinica')}
                placeholder="Rua, nº, bairro, cidade"
              />
            </div>
          </div>

          {isAdmin ? renderSaveBar() : null}
        </div>
      ) : null}

      {activeTab === 'aparencia' ? (
        <div className={styles.card}>
          <div className={styles.cardTop}>
            <div>
              <h2 className={styles.cardTitle}>Aparência</h2>
              <div className={styles.cardDesc}>Personalize o visual da sua clínica</div>
            </div>
          </div>

          <div className={styles.appearanceGrid}>
            <div className={styles.appearanceLeft}>
              <div className={styles.themePanel}>
                <div className={styles.themePanelTop}>
                  <div className={styles.themePanelTitle}>TEMAS (POR PERFIL)</div>
                </div>

                <div className={styles.roleThemes}>
                  <div className={styles.roleRow}>
                    <div className={styles.roleMeta}>
                      <div className={styles.roleName}>Administrador</div>
                      <div className={styles.roleHint}>Tema usado por usuários admin</div>
                    </div>
                    <div className={styles.segmented} role="group" aria-label="Tema administrador">
                      <button type="button" className={normalizeThemeUi(form.tema_ui_admin) === 'light' ? `${styles.segment} ${styles.segmentActive}` : styles.segment} onClick={() => handleThemeChangeFor('tema_ui_admin', 'light')} disabled={!isAdmin || loading}>Claro</button>
                      <button type="button" className={normalizeThemeUi(form.tema_ui_admin) === 'system' ? `${styles.segment} ${styles.segmentActive}` : styles.segment} onClick={() => handleThemeChangeFor('tema_ui_admin', 'system')} disabled={!isAdmin || loading}>Sistema</button>
                      <button type="button" className={normalizeThemeUi(form.tema_ui_admin) === 'dark' ? `${styles.segment} ${styles.segmentActive}` : styles.segment} onClick={() => handleThemeChangeFor('tema_ui_admin', 'dark')} disabled={!isAdmin || loading}>Escuro</button>
                    </div>
                  </div>

                  <div className={styles.roleRow}>
                    <div className={styles.roleMeta}>
                      <div className={styles.roleName}>Dentista</div>
                      <div className={styles.roleHint}>Tema usado por usuários dentista</div>
                    </div>
                    <div className={styles.segmented} role="group" aria-label="Tema dentista">
                      <button type="button" className={normalizeThemeUi(form.tema_ui_dentista) === 'light' ? `${styles.segment} ${styles.segmentActive}` : styles.segment} onClick={() => handleThemeChangeFor('tema_ui_dentista', 'light')} disabled={!isAdmin || loading}>Claro</button>
                      <button type="button" className={normalizeThemeUi(form.tema_ui_dentista) === 'system' ? `${styles.segment} ${styles.segmentActive}` : styles.segment} onClick={() => handleThemeChangeFor('tema_ui_dentista', 'system')} disabled={!isAdmin || loading}>Sistema</button>
                      <button type="button" className={normalizeThemeUi(form.tema_ui_dentista) === 'dark' ? `${styles.segment} ${styles.segmentActive}` : styles.segment} onClick={() => handleThemeChangeFor('tema_ui_dentista', 'dark')} disabled={!isAdmin || loading}>Escuro</button>
                    </div>
                  </div>

                  <div className={styles.roleRow}>
                    <div className={styles.roleMeta}>
                      <div className={styles.roleName}>Recepção</div>
                      <div className={styles.roleHint}>Tema usado por usuários recepção</div>
                    </div>
                    <div className={styles.segmented} role="group" aria-label="Tema recepção">
                      <button type="button" className={normalizeThemeUi(form.tema_ui_recepcao) === 'light' ? `${styles.segment} ${styles.segmentActive}` : styles.segment} onClick={() => handleThemeChangeFor('tema_ui_recepcao', 'light')} disabled={!isAdmin || loading}>Claro</button>
                      <button type="button" className={normalizeThemeUi(form.tema_ui_recepcao) === 'system' ? `${styles.segment} ${styles.segmentActive}` : styles.segment} onClick={() => handleThemeChangeFor('tema_ui_recepcao', 'system')} disabled={!isAdmin || loading}>Sistema</button>
                      <button type="button" className={normalizeThemeUi(form.tema_ui_recepcao) === 'dark' ? `${styles.segment} ${styles.segmentActive}` : styles.segment} onClick={() => handleThemeChangeFor('tema_ui_recepcao', 'dark')} disabled={!isAdmin || loading}>Escuro</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {isAdmin ? renderSaveBar() : null}
        </div>
      ) : null}

      {activeTab === 'comunicacao' ? (
        <div className={styles.card}>
          <div className={styles.cardTop}>
            <div>
              <h2 className={styles.cardTitle}>Comunicação</h2>
              <div className={styles.cardDesc}>Mensagens automáticas e lembretes</div>
            </div>
          </div>

          <div className={styles.formGrid}>
            <div className={styles.toggleRow}>
              <div>
                <div className={styles.toggleTitle}>Enviar lembrete por WhatsApp</div>
                <div className={styles.helper}>Recomendado para reduzir faltas</div>
              </div>
              <label className={styles.switch}>
                <input type="checkbox" checked={!!form.lembrete_whatsapp_ativo} onChange={onToggle('lembrete_whatsapp_ativo')} disabled={!isAdmin || loading} />
                <span className={styles.slider} />
              </label>
            </div>

            <div className={styles.toggleRow}>
              <div>
                <div className={styles.toggleTitle}>Enviar lembrete por e-mail</div>
                <div className={styles.helper}>Útil como canal alternativo</div>
              </div>
              <label className={styles.switch}>
                <input type="checkbox" checked={!!form.lembrete_email_ativo} onChange={onToggle('lembrete_email_ativo')} disabled={!isAdmin || loading} />
                <span className={styles.slider} />
              </label>
            </div>

            <div className={styles.field} style={{ gridColumn: '1 / -1' }}>
              <label className={styles.label}>Mensagem padrão</label>
              <div className={styles.varsRow}>
                <span className={styles.varChip}>{'{{paciente}}'}</span>
                <span className={styles.varChip}>{'{{dentista}}'}</span>
                <span className={styles.varChip}>{'{{data}}'}</span>
                <span className={styles.varChip}>{'{{hora}}'}</span>
              </div>
              <textarea
                className={styles.textArea}
                value={form.mensagem_lembrete}
                disabled={!isAdmin || loading}
                onChange={onChange('mensagem_lembrete')}
                rows={4}
              />
              <div className={styles.example}>
                Exemplo: “Olá {'{{paciente}}'}, sua consulta com o Dr. {'{{dentista}}'} é amanhã às {'{{hora}}'}.”
              </div>
            </div>
          </div>

          {isAdmin ? renderSaveBar() : null}
        </div>
      ) : null}

      {activeTab === 'conta' ? (
        <div className={styles.cardNeutral}>
          <div className={styles.cardTop}>
            <div>
              <h2 className={styles.cardTitle}>Conta</h2>
              <div className={styles.cardDesc}>Sessão e segurança</div>
            </div>
          </div>

          <div className={styles.accountBox}>
            <button className={styles.dangerBtn} onClick={handleLogout}>Sair do sistema</button>
          </div>
        </div>
      ) : null}

      {previewLogo ? (
        <div className={styles.overlay} role="dialog" aria-modal="true" aria-label="Pré-visualizar logo" onMouseDown={() => setPreviewLogo(null)}>
          <div className={styles.modal} onMouseDown={(e) => e.stopPropagation()}>
            <div className={styles.modalTop}>
              <div className={styles.modalTitle}>{previewLogo.title}</div>
              <button type="button" className={styles.closeBtn} onClick={() => setPreviewLogo(null)} aria-label="Fechar">×</button>
            </div>
            <div className={styles.logoPreviewArea}>
              <img className={styles.logoPreviewImg} src={previewLogo.src} alt={previewLogo.title} />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
