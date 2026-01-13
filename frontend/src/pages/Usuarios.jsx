import { useEffect, useMemo, useState } from 'react'
import { usuariosService } from '@services/api'

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

  const byRole = useMemo(() => {
    const map = { admin: 0, dentista: 0, recepcao: 0 }
    for (const it of items) {
      const r = String(it.role || '').toLowerCase()
      if (r in map) map[r] += 1
    }
    return map
  }, [items])

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
    <div style={{ padding: 20 }}>
      <h2 style={{ marginBottom: 8 }}>Usuários</h2>
      <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 14 }}>
        Admin: {byRole.admin} • Dentistas: {byRole.dentista} • Recepção: {byRole.recepcao}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 16 }}>
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 14 }}>
          <h3 style={{ marginTop: 0 }}>Criar usuário</h3>
          <form onSubmit={criar} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label>Nome</label>
              <input value={novo.nome} onChange={(e) => setNovo((p) => ({ ...p, nome: e.target.value }))} required />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label>Email</label>
              <input type="email" value={novo.email} onChange={(e) => setNovo((p) => ({ ...p, email: e.target.value }))} required />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label>Senha (mín. 6)</label>
              <input type="password" value={novo.senha} onChange={(e) => setNovo((p) => ({ ...p, senha: e.target.value }))} required />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label>Perfil</label>
              <select value={novo.role} onChange={(e) => setNovo((p) => ({ ...p, role: e.target.value }))}>
                {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
            <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end' }}>
              <button type="submit" disabled={salvando} style={{ padding: '10px 14px', borderRadius: 10, border: 'none', background: '#111827', color: '#fff', cursor: 'pointer' }}>
                {salvando ? 'Salvando...' : 'Criar'}
              </button>
            </div>
          </form>
        </div>

        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 14 }}>
          <h3 style={{ marginTop: 0 }}>Lista</h3>
          {loading ? (
            <div>Carregando...</div>
          ) : erro ? (
            <div style={{ color: '#b91c1c' }}>{erro}</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f9fafb', textAlign: 'left' }}>
                    <th style={{ padding: 10, borderBottom: '1px solid #e5e7eb' }}>Nome</th>
                    <th style={{ padding: 10, borderBottom: '1px solid #e5e7eb' }}>Email</th>
                    <th style={{ padding: 10, borderBottom: '1px solid #e5e7eb' }}>Perfil</th>
                    <th style={{ padding: 10, borderBottom: '1px solid #e5e7eb' }}>Ativo</th>
                    <th style={{ padding: 10, borderBottom: '1px solid #e5e7eb' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map(u => (
                    <tr key={u.id}>
                      <td style={{ padding: 10, borderBottom: '1px solid #f3f4f6' }}>{u.nome}</td>
                      <td style={{ padding: 10, borderBottom: '1px solid #f3f4f6' }}>{u.email}</td>
                      <td style={{ padding: 10, borderBottom: '1px solid #f3f4f6' }}>{String(u.role || '').toLowerCase()}</td>
                      <td style={{ padding: 10, borderBottom: '1px solid #f3f4f6' }}>{u.ativo ? 'Sim' : 'Não'}</td>
                      <td style={{ padding: 10, borderBottom: '1px solid #f3f4f6', textAlign: 'right' }}>
                        <button type="button" onClick={() => abrirEdicao(u)} style={{ padding: '8px 10px', borderRadius: 10, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer' }}>
                          Editar
                        </button>
                      </td>
                    </tr>
                  ))}
                  {items.length === 0 && (
                    <tr><td colSpan={5} style={{ padding: 14, color: '#6b7280' }}>Nenhum usuário.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {edit && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ width: 'min(720px, 100%)', background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <h3 style={{ margin: 0 }}>Editar usuário</h3>
              <button type="button" onClick={() => setEdit(null)} style={{ border: 'none', background: 'transparent', fontSize: 18, cursor: 'pointer' }}>×</button>
            </div>

            <form onSubmit={salvarEdicao} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label>Nome</label>
                <input value={editForm.nome} onChange={(e) => setEditForm((p) => ({ ...p, nome: e.target.value }))} required />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label>Email</label>
                <input type="email" value={editForm.email} onChange={(e) => setEditForm((p) => ({ ...p, email: e.target.value }))} required />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label>Perfil</label>
                <select value={editForm.role} onChange={(e) => setEditForm((p) => ({ ...p, role: e.target.value }))}>
                  {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label>Ativo</label>
                <select value={editForm.ativo ? 1 : 0} onChange={(e) => setEditForm((p) => ({ ...p, ativo: Number(e.target.value) }))}>
                  <option value={1}>Sim</option>
                  <option value={0}>Não</option>
                </select>
              </div>
              <div style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label>Nova senha (opcional)</label>
                <input type="password" value={editForm.senha} onChange={(e) => setEditForm((p) => ({ ...p, senha: e.target.value }))} placeholder="Deixe vazio para manter" />
              </div>

              <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button type="button" onClick={() => setEdit(null)} style={{ padding: '10px 14px', borderRadius: 10, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer' }}>
                  Cancelar
                </button>
                <button type="submit" disabled={salvando} style={{ padding: '10px 14px', borderRadius: 10, border: 'none', background: '#111827', color: '#fff', cursor: 'pointer' }}>
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
