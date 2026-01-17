import { useEffect, useState } from 'react'
import { usuariosService } from '@services/api'
import styles from './Usuarios.module.css'

const ROLES = [
  { value: 'admin', label: 'Admin' },
  { value: 'dentista', label: 'Dentista' },
  { value: 'recepcao', label: 'Recepção' }
]

export default function Usuarios() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState('')

  const [novo, setNovo] = useState({ nome: '', email: '', senha: '', role: 'recepcao' })
  const [salvando, setSalvando] = useState(false)

  const [edit, setEdit] = useState(null) // user row
  const [editForm, setEditForm] = useState({ nome: '', email: '', role: 'recepcao', ativo: 1, senha: '' })

  const carregar = async () => {
    setLoading(true)
    setErro('')
    try {
      const data = await usuariosService.listar()
      setItems(Array.isArray(data) ? data : [])
    } catch (e) {
      setErro(e.message || 'Erro ao carregar usuários')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    carregar()
  }, [])

  const criar = async (e) => {
    e.preventDefault()
    setSalvando(true)
    try {
      await usuariosService.criar(novo)
      setNovo({ nome: '', email: '', senha: '', role: 'recepcao' })
      await carregar()
      alert('Usuário criado!')
    } catch (err) {
      alert(err.message || 'Erro ao criar usuário')
    } finally {
      setSalvando(false)
    }
  }

  const abrirEdicao = (u) => {
    setEdit(u)
    setEditForm({
      nome: u.nome || '',
      email: u.email || '',
      role: String(u.role || 'recepcao').toLowerCase(),
      ativo: u.ativo ? 1 : 0,
      senha: ''
    })
  }

  const salvarEdicao = async (e) => {
    e.preventDefault()
    if (!edit?.id) return
    setSalvando(true)
    try {
      const payload = {
        nome: editForm.nome,
        email: editForm.email,
        role: editForm.role,
        ativo: !!editForm.ativo
      }
      if (String(editForm.senha || '').trim()) payload.senha = editForm.senha

      await usuariosService.atualizar(edit.id, payload)
      setEdit(null)
      await carregar()
      alert('Usuário atualizado!')
    } catch (err) {
      alert(err.message || 'Erro ao atualizar usuário')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className={styles.container}>
      <div className={styles.pageHeading}>
        <h1 className={styles.pageTitle}>Usuários</h1>
        <div className={styles.subtitle}>Gerencie usuários e permissões do sistema</div>
      </div>

      <div className={styles.grid}>
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <div>
              <h2 className={styles.cardTitle}>Usuários</h2>
            </div>
          </div>

          <form onSubmit={criar} className={styles.form}>
            <div className={styles.field}>
              <label className={styles.label}>Nome</label>
              <input className={styles.input} value={novo.nome} onChange={(e) => setNovo((p) => ({ ...p, nome: e.target.value }))} required />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Email</label>
              <input className={styles.input} type="email" value={novo.email} onChange={(e) => setNovo((p) => ({ ...p, email: e.target.value }))} required />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Senha (mín. 6)</label>
              <input className={styles.input} type="password" value={novo.senha} onChange={(e) => setNovo((p) => ({ ...p, senha: e.target.value }))} required />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Perfil</label>
              <select className={styles.select} value={novo.role} onChange={(e) => setNovo((p) => ({ ...p, role: e.target.value }))}>
                {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
            <div className={styles.actionsRow}>
              <button type="submit" disabled={salvando} className={styles.primaryBtn}>
                {salvando ? 'Salvando...' : 'Criar usuário'}
              </button>
            </div>
          </form>
        </div>

        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>Lista</h2>
          </div>

          {loading ? (
            <div>Carregando...</div>
          ) : erro ? (
            <div className={styles.error}>{erro}</div>
          ) : (
            <>
              <div className={styles.mobileList}>
                {items.map((u) => (
                  <div key={u.id} className={styles.userCard}>
                    <div className={styles.userTop}>
                      <div>
                        <div className={styles.userName}>{u.nome || '—'}</div>
                        <div className={styles.userMeta}>
                          <div>{u.email || '—'}</div>
                        </div>
                      </div>
                      <button type="button" className={styles.smallBtn} onClick={() => abrirEdicao(u)}>Editar</button>
                    </div>
                    <div className={styles.badges}>
                      <span className={styles.badge}>{String(u.role || '').toLowerCase() || '—'}</span>
                      <span className={u.ativo ? styles.badge : `${styles.badge} ${styles.badgeOff}`}>{u.ativo ? 'Ativo' : 'Inativo'}</span>
                    </div>
                  </div>
                ))}
                {items.length === 0 && (
                  <div style={{ color: '#64748b', fontWeight: 700 }}>Nenhum usuário.</div>
                )}
              </div>

              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Nome</th>
                      <th>Email</th>
                      <th>Perfil</th>
                      <th>Ativo</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {items.map(u => (
                      <tr key={u.id}>
                        <td>{u.nome}</td>
                        <td>{u.email}</td>
                        <td>{String(u.role || '').toLowerCase()}</td>
                        <td>{u.ativo ? 'Sim' : 'Não'}</td>
                        <td className={styles.actionsCell}>
                          <button type="button" onClick={() => abrirEdicao(u)} className={styles.smallBtn}>
                            Editar
                          </button>
                        </td>
                      </tr>
                    ))}
                    {items.length === 0 && (
                      <tr><td colSpan={5} style={{ padding: 14, color: '#64748b', fontWeight: 700 }}>Nenhum usuário.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>

      {edit && (
        <div className={styles.overlay} role="dialog" aria-modal="true" aria-label="Editar usuário" onMouseDown={() => setEdit(null)}>
          <div className={styles.modal} onMouseDown={(e) => e.stopPropagation()}>
            <div className={styles.modalTop}>
              <h3 className={styles.modalTitle}>Editar usuário</h3>
              <button type="button" className={styles.closeBtn} onClick={() => setEdit(null)} aria-label="Fechar">×</button>
            </div>

            <form onSubmit={salvarEdicao} className={styles.form}>
              <div className={styles.field}>
                <label className={styles.label}>Nome</label>
                <input className={styles.input} value={editForm.nome} onChange={(e) => setEditForm((p) => ({ ...p, nome: e.target.value }))} required />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Email</label>
                <input className={styles.input} type="email" value={editForm.email} onChange={(e) => setEditForm((p) => ({ ...p, email: e.target.value }))} required />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Perfil</label>
                <select className={styles.select} value={editForm.role} onChange={(e) => setEditForm((p) => ({ ...p, role: e.target.value }))}>
                  {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Ativo</label>
                <select className={styles.select} value={editForm.ativo ? 1 : 0} onChange={(e) => setEditForm((p) => ({ ...p, ativo: Number(e.target.value) }))}>
                  <option value={1}>Sim</option>
                  <option value={0}>Não</option>
                </select>
              </div>
              <div className={styles.field} style={{ gridColumn: '1 / -1' }}>
                <label className={styles.label}>Nova senha (opcional)</label>
                <input className={styles.input} type="password" value={editForm.senha} onChange={(e) => setEditForm((p) => ({ ...p, senha: e.target.value }))} placeholder="Deixe vazio para manter" />
              </div>

              <div className={styles.actionsRow}>
                <button type="button" onClick={() => setEdit(null)} className={styles.secondaryBtn}>
                  Cancelar
                </button>
                <button type="submit" disabled={salvando} className={styles.primaryBtn}>
                  {salvando ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
