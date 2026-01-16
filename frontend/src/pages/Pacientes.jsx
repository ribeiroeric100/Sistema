import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { pacientesService, consultasService } from '@services/api'
import styles from './Pacientes.module.css'

export default function Pacientes() {
  const navigate = useNavigate()
  const [pacientes, setPacientes] = useState([])
  const [loading, setLoading] = useState(true)
  const [savingPaciente, setSavingPaciente] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({ nome: '', email: '', telefone: '', cpf: '', data_nascimento: '' })
  const [busca, setBusca] = useState('')
  const [topActionsOpen, setTopActionsOpen] = useState(false)
  const [primaryActionId, setPrimaryActionId] = useState('add')
  const topActionsRef = useRef(null)
  const [showHistoryFor, setShowHistoryFor] = useState(null)
  const [historyItems, setHistoryItems] = useState([])
  const [showNewConsultaForm, setShowNewConsultaForm] = useState(false)
  const [newConsulta, setNewConsulta] = useState({ data: '', hora: '', tipo_consulta: 'geral', valor: '', procedimentos: [] })
  const [showNewConsultaGlobal, setShowNewConsultaGlobal] = useState(false)
  const [newConsultaGlobal, setNewConsultaGlobal] = useState({ paciente_id: '', data: new Date().toISOString().split('T')[0], hora: '09:00', tipo_consulta: 'geral', valor: '', procedimentos: [] })
  const [selectedHistoryItem, setSelectedHistoryItem] = useState(null)
  // temporary inputs for adding procedures/materials (local and global forms)
  const [procDesc, setProcDesc] = useState('')
  const [procValor, setProcValor] = useState('')

  const [procDescG, setProcDescG] = useState('')
  const [procValorG, setProcValorG] = useState('')

  // lista de operações comuns que o dentista pode realizar
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
    'Ortodontia (Aparelho)',
    'Ajuste de Oclusão',
    'Aplicação de Flúor',
    'Selante',
    'Sedação Consciente',
    'Reabilitação Oral',
    'Prótese Parcial',
    'Coroa Provisória',
    'Cimento de Coroa',
    'Retratamento de Canal'
  ]


  const handleSubmit = async (e) => {
    e.preventDefault()
    const telefone = String(formData.telefone || '').trim()
    if (!telefone) {
      alert('Telefone é obrigatório')
      return
    }

    try {
      setSavingPaciente(true)
      if (formData.id) {
        await pacientesService.atualizar(formData.id, formData)
      } else {
        const created = await pacientesService.criar({ ...formData, telefone })
        setFormData({ nome: '', email: '', telefone: '', cpf: '', data_nascimento: '' })
        setShowForm(false)
        // Após criar, avançar para o perfil para completar o cadastro
        if (created?.id) navigate(`/paciente/${created.id}`)
        return
      }
      setFormData({ nome: '', email: '', telefone: '', cpf: '', data_nascimento: '' })
      setShowForm(false)
      carregarPacientes()
    } catch (err) {
      console.error('Erro ao salvar:', err)
      try { alert('Erro ao salvar paciente: ' + (err?.message || String(err))) } catch { /* ignore */ }
    } finally {
      setSavingPaciente(false)
    }
  }

  const abrirEdicao = (p) => {
    setFormData({ id: p.id, nome: p.nome, email: p.email, telefone: p.telefone, cpf: p.cpf, data_nascimento: p.data_nascimento })
    setShowForm(true)
  }

  // Minimal data loaders and handlers to avoid runtime errors
  const carregarPacientes = async () => {
    try {
      setLoading(true)
      const res = await pacientesService.listar()
      setPacientes(res || [])
    } catch (err) {
      console.error('Erro ao carregar pacientes', err)
    } finally {
      setLoading(false)
    }
  }

  const abrirNovaConsultaGlobal = () => {
    setNewConsultaGlobal({ ...newConsultaGlobal, paciente_id: '' })
    setShowNewConsultaGlobal(true)
  }

  const abrirNovoPaciente = () => {
    setFormData({ nome: '', email: '', telefone: '', cpf: '', data_nascimento: '' })
    setShowForm(true)
    setTopActionsOpen(false)
  }

  const abrirMarcarConsulta = () => {
    setTopActionsOpen(false)
    abrirNovaConsultaGlobal()
  }

  const ACTIONS = {
    add: {
      id: 'add',
      label: 'Adicionar Paciente',
      onClick: abrirNovoPaciente
    },
    consulta: {
      id: 'consulta',
      label: 'Marcar Consulta',
      onClick: abrirMarcarConsulta
    }
  }

  const primaryAction = ACTIONS[primaryActionId] || ACTIONS.add
  const secondaryAction = primaryAction.id === 'add' ? ACTIONS.consulta : ACTIONS.add

  const abrirNovaConsulta = (paciente) => {
    setShowHistoryFor(paciente)
    setNewConsulta({ ...newConsulta, data: new Date().toISOString().split('T')[0], hora: '09:00', procedimentos: [] })
    setShowNewConsultaForm(true)
  }

  const handleCreateConsulta = async (e) => {
    e.preventDefault()
    try {
      // Derivar tipo_consulta a partir dos procedimentos quando existirem
      let tipo = newConsulta.tipo_consulta
      const procs = newConsulta.procedimentos || []
      if (procs.length > 0) {
        tipo = procs.length === 1 ? (procs[0].descricao || String(procs[0])) : procs.map(p => p.descricao || p).join(', ')
      }

      // Se valor não informado, tentar somar valores dos procedimentos
      let valor = newConsulta.valor
      if ((!valor || String(valor).trim() === '') && procs.length > 0) {
        const soma = procs.reduce((s, p) => s + (Number(p.valor) || 0), 0)
        valor = soma || ''
      }

      const payload = {
        paciente_id: showHistoryFor?.id,
        data_hora: `${newConsulta.data} ${newConsulta.hora}`,
        tipo_consulta: tipo || 'geral',
        valor: valor,
        procedimentos: newConsulta.procedimentos,
        observacoes: newConsulta.observacoes || ''
      }
      console.debug('Criando consulta (local) payload:', payload)
      await consultasService.criar(payload)
      setShowNewConsultaForm(false)
      setShowHistoryFor(null)
      carregarPacientes()
    } catch (err) {
      console.error('Erro ao criar consulta', err)
      try { alert('Erro ao criar consulta: ' + (err.message || JSON.stringify(err))) } catch(e) { console.error(e) }
    }
  }

  const handleCreateConsultaGlobal = async (e) => {
    e.preventDefault()
    try {
      // Derivar tipo_consulta a partir dos procedimentos quando existirem
      let tipoG = newConsultaGlobal.tipo_consulta
      const procsG = newConsultaGlobal.procedimentos || []
      if (procsG.length > 0) {
        tipoG = procsG.length === 1 ? (procsG[0].descricao || String(procsG[0])) : procsG.map(p => p.descricao || p).join(', ')
      }

      // Se valor não informado, somar valores dos procedimentos
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
      console.debug('Criando consulta (global) payload:', payload)
      await consultasService.criar(payload)
      setShowNewConsultaGlobal(false)
      carregarPacientes()
    } catch (err) {
      console.error('Erro ao criar consulta global', err)
      try { alert('Erro ao criar consulta (global): ' + (err.message || JSON.stringify(err))) } catch(e) { console.error(e) }
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Deseja realmente excluir este paciente?')) return
    try {
      await pacientesService.deletar(id)
      carregarPacientes()
    } catch (err) {
      console.error('Erro ao deletar paciente', err)
    }
  }

  useEffect(() => {
    carregarPacientes()
  }, [])

  useEffect(() => {
    const onMouseDown = (e) => {
      const el = topActionsRef.current
      if (!el) return
      if (!el.contains(e.target)) setTopActionsOpen(false)
    }

    const onKeyDown = (e) => {
      if (e.key === 'Escape') setTopActionsOpen(false)
    }

    document.addEventListener('mousedown', onMouseDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onMouseDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [])

  // quando o modal de histórico é aberto, carregar histórico do paciente
  useEffect(() => {
    if (!showHistoryFor) {
      setHistoryItems([])
      return
    }

    const load = async () => {
      try {
        const res = await consultasService.porPaciente(showHistoryFor.id)
        setHistoryItems(res || [])
      } catch (err) {
        console.error('Erro ao carregar histórico do paciente:', err)
      }
    }

    load()
  }, [showHistoryFor])

  // escutar exclusões disparadas em outras views (Agenda) e atualizar histórico se for o mesmo paciente
  useEffect(() => {
    const onDeleted = (e) => {
      try {
        const pid = e?.detail?.paciente_id
        if (pid && showHistoryFor && pid === showHistoryFor.id) {
          consultasService.porPaciente(pid).then(d => setHistoryItems(d || [])).catch(() => {})
        }
      } catch { /* ignore */ }
    }

    window.addEventListener('consultaDeleted', onDeleted)
    return () => window.removeEventListener('consultaDeleted', onDeleted)
  }, [showHistoryFor])

  const filtered = pacientes.filter(p => {
    const q = busca.toLowerCase()
    return (p.nome || '').toLowerCase().includes(q) || (p.telefone || '').includes(q)
  })

  if (loading) return <div className={styles.loading}>Carregando...</div>

  return (
    <div className={styles.container}>
      <div className={styles.pageHeader}>
        <h1>Pacientes</h1>
        <div className={styles.topActions}>
          <div className={styles.dropdownWrap} ref={topActionsRef}>
            <button
              type="button"
              className={`${styles.primary} ${styles.dropdownMain}`}
              onClick={primaryAction.onClick}
            >
              + {primaryAction.label}
            </button>
            <button
              type="button"
              className={`${styles.primary} ${styles.dropdownToggle}`}
              aria-haspopup="menu"
              aria-expanded={topActionsOpen}
              onClick={() => setTopActionsOpen(v => !v)}
              title="Mais ações"
            >
              ▼
            </button>

            {topActionsOpen && (
              <div className={styles.dropdownMenu} role="menu">
                <button
                  type="button"
                  role="menuitem"
                  className={styles.dropdownItem}
                  onClick={() => {
                    // trocar a ação principal pelo item selecionado
                    setPrimaryActionId(secondaryAction.id)
                    secondaryAction.onClick()
                  }}
                >
                  + {secondaryAction.label}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className={styles.searchRow}>
        <div className={styles.searchInputWrap}>
          <span className={styles.searchIcon} aria-hidden="true">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Z" stroke="currentColor" strokeWidth="1.8" />
              <path d="M16.5 16.5 21 21" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </span>
          <input
            className={styles.searchInput}
            type="search"
            placeholder="Buscar paciente..."
            value={busca}
            onChange={e => setBusca(e.target.value)}
          />
        </div>
        <button className={styles.searchBtn}>Buscar</button>
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Nome</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(p => (
              <tr key={p.id}>
                <td onClick={() => navigate(`/paciente/${p.id}`)} className={styles.nomeClickable}>{p.nome}</td>
                <td className={styles.actionsCell}>
                  <button onClick={() => navigate(`/paciente/${p.id}`)} className={styles.iconBtn} title="Ver">
                    <img src="/assets/view.svg" alt="Ver" className={styles.actionIcon} />
                  </button>
                  <button onClick={() => abrirEdicao(p)} className={styles.iconBtn} title="Editar">
                    <img src="/assets/edit.svg" alt="Editar" className={styles.actionIcon} />
                  </button>
                  <button onClick={() => handleDelete(p.id)} className={`${styles.iconBtn} ${styles.iconBtnDanger}`} title="Deletar">
                    <img src="/assets/delete.svg" alt="Deletar" className={styles.actionIcon} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className={styles.modal}>
          <div className={styles.patientDialog}>
            <div className={styles.patientDialogHeader}>
              <h2>{formData.id ? 'Editar Paciente' : 'Novo Paciente'}</h2>
              <button className={styles.patientClose} onClick={() => setShowForm(false)} aria-label="Fechar">✕</button>
            </div>

            <form onSubmit={handleSubmit} className={styles.patientDialogForm}>
              <div className={styles.patientDialogBody}>
              <div>
                <label className={styles.formLabel}>Nome</label>
                <input className={styles.formInput} type="text" placeholder="Digite o nome completo" value={formData.nome} onChange={e => setFormData({ ...formData, nome: e.target.value })} required />
              </div>

              <div>
                <label className={styles.formLabel}>Telefone</label>
                <div className={styles.patientPhoneGroup}>
                  <span className={styles.phoneIcon} aria-hidden="true">
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M7.5 3.5c.6-1 2-1.3 3-.7l1.9 1.1c.9.5 1.3 1.6 1 2.6l-.6 1.8c-.2.7 0 1.4.5 1.9l2.6 2.6c.5.5 1.2.7 1.9.5l1.8-.6c1-.3 2.1.1 2.6 1l1.1 1.9c.6 1 .3 2.4-.7 3-.9.6-2 .9-3.1.9-8.1 0-14.6-6.5-14.6-14.6 0-1.1.3-2.2.9-3.1Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/>
                    </svg>
                  </span>
                  <span className={styles.phoneCountry}>+55</span>
                  <span className={styles.phoneDivider} aria-hidden="true" />
                  <input className={styles.phoneField} type="tel" placeholder="—" value={formData.telefone} onChange={e => setFormData({ ...formData, telefone: e.target.value })} required />
                </div>
              </div>

              <div>
                <label className={styles.formLabel}>E-mail</label>
                <input className={styles.formInput} type="email" placeholder="Digite o e-mail" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} />
              </div>

              <div>
                <label className={styles.formLabel}>CPF</label>
                <input className={styles.formInput} type="text" placeholder="Digite o CPF" value={formData.cpf} onChange={e => setFormData({ ...formData, cpf: e.target.value })} />
              </div>

              <div>
                <label className={styles.formLabel}>Data de Nascimento</label>
                <input className={styles.formInput} type="date" value={formData.data_nascimento} onChange={e => setFormData({ ...formData, data_nascimento: e.target.value })} />
              </div>

              </div>

              <div className={styles.patientDialogFooter}>
                <button type="button" className={styles.patientCancelBtn} onClick={() => setShowForm(false)}>Cancelar</button>
                <button type="submit" className={styles.patientSaveBtn} disabled={savingPaciente}>{savingPaciente ? 'Salvando...' : 'Salvar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showHistoryFor && (
        <div className={styles.modal}>
          <div className={styles.modalContent}>
            <h2>Histórico — {showHistoryFor.nome}</h2>
            <div className={styles.historyList}>
              <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8}}>
                <h4>Histórico</h4>
                <button className={styles.save} onClick={() => abrirNovaConsulta(showHistoryFor)}>+ Nova Consulta</button>
              </div>
              {historyItems.length === 0 ? <p>Sem consultas</p> : historyItems.map(h => (
                <div key={h.id} className={styles.historyItem} onClick={() => setSelectedHistoryItem(h)} style={{cursor:'pointer'}}>
                  <div>{new Date(h.data_hora).toLocaleDateString('pt-BR')}</div>
                  <div>{h.tipo_consulta}</div>
                </div>
              ))}
            </div>

            {showNewConsultaForm && (
              <div style={{marginTop:12}}>
                <h4>Agendar nova consulta — {showHistoryFor?.nome}</h4>
                <form onSubmit={handleCreateConsulta}>
                  <label className={styles.formLabel}>Data</label>
                  <input className={styles.formInput} type="date" value={newConsulta.data} onChange={e => setNewConsulta({...newConsulta, data: e.target.value})} required />

                  <label className={styles.formLabel}>Hora</label>
                  <input className={styles.formInput} type="time" value={newConsulta.hora} onChange={e => setNewConsulta({...newConsulta, hora: e.target.value})} required />

                  <label className={styles.formLabel}>Tipo</label>
                  <input className={styles.formInput} type="text" placeholder="Tipo" value={newConsulta.tipo_consulta} onChange={e => setNewConsulta({...newConsulta, tipo_consulta: e.target.value})} />

                  <label className={styles.formLabel}>Valor</label>
                  <input className={styles.formInput} type="number" placeholder="Valor" value={newConsulta.valor} onChange={e => setNewConsulta({...newConsulta, valor: e.target.value})} />

                  

                  <label className={styles.formLabel}>Procedimentos</label>
                  {newConsulta.procedimentos.length === 0 ? <p style={{color:'#666'}}>Nenhum procedimento adicionado.</p> : (
                    <ul>
                      {newConsulta.procedimentos.map((proc, idx) => (
                        <li key={idx} style={{display:'flex', gap:12, alignItems:'center', marginBottom:6}}>
                          <div style={{flex:1}}>{proc.descricao} — R$ {Number(proc.valor || 0).toLocaleString('pt-BR', {minimumFractionDigits:2})}</div>
                          <button type="button" className={styles.btnSecondary} onClick={() => { const arr = [...newConsulta.procedimentos]; arr.splice(idx,1); setNewConsulta({...newConsulta, procedimentos: arr}) }}>Remover</button>
                        </li>
                      ))}
                    </ul>
                  )}
                  <div style={{display:'flex', gap:8, marginTop:8, alignItems:'center'}}>
                    <input className={styles.formInput} placeholder="Descrição do procedimento" value={procDesc} onChange={e => setProcDesc(e.target.value)} />
                    <input className={styles.formInput} placeholder="Valor" type="number" style={{width:140}} value={procValor} onChange={e => setProcValor(e.target.value)} />
                    <button type="button" className={styles.save} onClick={() => {
                      if (!procDesc) return
                      const arr = [...newConsulta.procedimentos, { descricao: procDesc, valor: procValor || 0 }]
                      // atualizar tipo_consulta para refletir o(s) procedimento(s)
                      let tipo = newConsulta.tipo_consulta
                      if ((!tipo || tipo === 'geral') && arr.length > 0) {
                        if (arr.length === 1) tipo = arr[0].descricao
                        else tipo = arr.map(p => p.descricao).join(', ')
                      }
                      setNewConsulta({...newConsulta, procedimentos: arr, tipo_consulta: tipo})
                      setProcDesc('')
                      setProcValor('')
                    }}>+ Adicionar Procedimento</button>
                  </div>

                  <div className={styles.modalFooter} style={{marginTop:8}}>
                    <button type="button" className={styles.btnSecondary} onClick={() => setShowNewConsultaForm(false)}>Cancelar</button>
                    <button type="submit" className={styles.btnPrimary}>Salvar</button>
                  </div>
                </form>
              </div>
            )}

            <button onClick={() => setShowHistoryFor(null)} className={styles.cancel}>Fechar</button>
          </div>
        </div>
      )}

      {selectedHistoryItem && (
        <div className={styles.modal}>
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <h2>Consulta — {new Date(selectedHistoryItem.data_hora).toLocaleString('pt-BR')}</h2>
              <button className={styles.modalClose} onClick={() => setSelectedHistoryItem(null)}>✕</button>
            </div>
            <div className={styles.modalBody}>
              <p><strong>Tipo:</strong> {selectedHistoryItem.tipo_consulta}</p>
              <p><strong>Valor:</strong> {selectedHistoryItem.valor || '-'}</p>
              <p><strong>Observações:</strong> {selectedHistoryItem.observacoes && String(selectedHistoryItem.observacoes).trim() ? selectedHistoryItem.observacoes : 'Observação não registrada'}</p>
              {selectedHistoryItem.procedimentos && selectedHistoryItem.procedimentos.length > 0 && (
                <div>
                  <h4>Procedimentos</h4>
                  <ul>
                    {selectedHistoryItem.procedimentos.map((p, i) => <li key={i}>{p.descricao || p}</li>)}
                  </ul>
                </div>
              )}
              {selectedHistoryItem.materiais && selectedHistoryItem.materiais.length > 0 && (
                <div>
                  <h4>Materiais</h4>
                  <ul>
                    {selectedHistoryItem.materiais.map((m, i) => <li key={i}>{(m.nome || m.produto_nome || m.produto_id)} — {m.quantidade}</li>)}
                  </ul>
                </div>
              )}
            </div>
            <div className={styles.modalFooter}><button className={styles.btnPrimary} onClick={() => setSelectedHistoryItem(null)}>Fechar</button></div>
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
              <select
                className={styles.formInput}
                value={newConsultaGlobal.paciente_id}
                onChange={e =>
                  setNewConsultaGlobal({
                    ...newConsultaGlobal,
                    paciente_id: e.target.value
                  })
                }
                required
              >
                <option value="">Selecionar paciente</option>
                {pacientes.map(p => (
                  <option key={p.id} value={p.id}>{p.nome}</option>
                ))}
              </select>
            </div>

            <div className={styles.mcRow}>
              <div>
                <label className={styles.formLabel}>Data</label>
                <input
                  type="date"
                  className={styles.formInput}
                  value={newConsultaGlobal.data}
                  onChange={e =>
                    setNewConsultaGlobal({
                      ...newConsultaGlobal,
                      data: e.target.value
                    })
                  }
                  required
                />
              </div>

              <div className={styles.mcTime}>
                <label className={styles.formLabel}>Horário</label>
                <input
                  type="time"
                  className={styles.formInput}
                  value={newConsultaGlobal.hora}
                  onChange={e =>
                    setNewConsultaGlobal({
                      ...newConsultaGlobal,
                      hora: e.target.value
                    })
                  }
                  required
                />
              </div>
            </div>

            <div>
              <label className={styles.formLabel}>Tipo de Procedimento — Valor</label>
              <div className={styles.inlineRow}>
          <select
            className={styles.formInput}
            value={procDescG}
            onChange={e => setProcDescG(e.target.value)}
          >
            <option value="">Selecionar</option>
            {OPERACOES.map((op, i) => (
              <option key={i} value={op}>{op}</option>
            ))}
          </select>

          <input
            type="number"
            className={styles.smallInput}
            placeholder="R$ 0,00"
            value={procValorG}
            onChange={e => setProcValorG(e.target.value)}
          />

          <button
            type="button"
            className={styles.addBlue}
            onClick={() => {
              if (!procDescG) return
              const arr = [...newConsultaGlobal.procedimentos, { descricao: procDescG, valor: procValorG || 0 }]
              // atualizar tipo_consulta global
              let tipoG = newConsultaGlobal.tipo_consulta
              if ((!tipoG || tipoG === 'geral') && arr.length > 0) {
                if (arr.length === 1) tipoG = arr[0].descricao
                else tipoG = arr.map(p => p.descricao).join(', ')
              }
              setNewConsultaGlobal({
                ...newConsultaGlobal,
                procedimentos: arr,
                tipo_consulta: tipoG
              })
              setProcDescG('')
              setProcValorG('')
            }}
          >
            +
          </button>
              </div>
            </div>

            <div>
              <label className={styles.formLabel}>Observações</label>
              <textarea
                className={styles.formInput}
                rows={3}
                value={newConsultaGlobal.observacoes || ''}
                onChange={e =>
                  setNewConsultaGlobal({
                    ...newConsultaGlobal,
                    observacoes: e.target.value
                  })
                }
              />
            </div>

          </div>
        </div>

        <div className={styles.mcBlock}>
          <div className={styles.mcBlockHeader}>Procedimentos adicionados</div>
          <div className={styles.mcBlockBody}>
            <div className={styles.chipList}>
              {newConsultaGlobal.procedimentos.map((p, idx) => (
                <div key={idx} className={styles.chip}>
                  {p.descricao}
                  <button
                    type="button"
                    onClick={() => {
                      const arr = [...newConsultaGlobal.procedimentos]
                      arr.splice(idx, 1)
                      setNewConsultaGlobal({ ...newConsultaGlobal, procedimentos: arr })
                    }}
                  >
                    ✕
                  </button>
                </div>
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
