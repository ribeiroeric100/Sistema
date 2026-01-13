import { useEffect, useState } from 'react'
import { auditoriaService } from '@services/api'

export default function Auditoria() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState('')

  useEffect(() => {
    let mounted = true
    auditoriaService.listar({ limit: 100, offset: 0 })
      .then((d) => {
        if (!mounted) return
        setItems(d?.items || [])
      })
      .catch((e) => {
        if (!mounted) return
        setErro(e.message || 'Erro ao carregar auditoria')
      })
      .finally(() => {
        if (!mounted) return
        setLoading(false)
      })

    return () => { mounted = false }
  }, [])

  if (loading) return <div style={{ padding: 20 }}>Carregando auditoria...</div>
  if (erro) return <div style={{ padding: 20, color: '#b91c1c' }}>{erro}</div>

  return (
    <div style={{ padding: 20 }}>
      <h2 style={{ marginBottom: 12 }}>Auditoria</h2>
      <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 12 }}>
        Últimos 100 eventos (somente admin)
      </div>

      <div style={{ overflowX: 'auto', background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f9fafb', textAlign: 'left' }}>
              <th style={{ padding: 10, borderBottom: '1px solid #e5e7eb' }}>Data</th>
              <th style={{ padding: 10, borderBottom: '1px solid #e5e7eb' }}>Usuário</th>
              <th style={{ padding: 10, borderBottom: '1px solid #e5e7eb' }}>Ação</th>
              <th style={{ padding: 10, borderBottom: '1px solid #e5e7eb' }}>Entidade</th>
              <th style={{ padding: 10, borderBottom: '1px solid #e5e7eb' }}>Origem</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it) => (
              <tr key={it.id}>
                <td style={{ padding: 10, borderBottom: '1px solid #f3f4f6', whiteSpace: 'nowrap' }}>{it.created_at}</td>
                <td style={{ padding: 10, borderBottom: '1px solid #f3f4f6' }}>{it.user_id ? `${it.user_id} (${it.user_role || ''})` : '-'}</td>
                <td style={{ padding: 10, borderBottom: '1px solid #f3f4f6' }}>{it.action}</td>
                <td style={{ padding: 10, borderBottom: '1px solid #f3f4f6' }}>{it.entity_type ? `${it.entity_type}:${it.entity_id || ''}` : '-'}</td>
                <td style={{ padding: 10, borderBottom: '1px solid #f3f4f6' }}>{it.ip || '-'}</td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr><td colSpan={5} style={{ padding: 14, color: '#6b7280' }}>Nenhum evento encontrado.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
