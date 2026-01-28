import { useEffect, useState } from 'react'
import { auditoriaService } from '@services/api'
import BreadcrumbTitle from '@components/common/BreadcrumbTitle'
import styles from './Auditoria.module.css'

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

  if (loading) return <div className={styles.state}>Carregando auditoria...</div>
  if (erro) return <div className={styles.error}>{erro}</div>

  return (
    <div className={styles.container}>
      <div className={styles.pageHeading}>
        <BreadcrumbTitle current="Auditoria" />
      </div>
      <div className={styles.subtitle}>Últimos 100 eventos (somente admin)</div>

      <div style={{ overflowX: 'auto', background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--table-head-bg)', textAlign: 'left' }}>
              <th style={{ padding: 10, borderBottom: '1px solid var(--border)', color: 'var(--muted)' }}>Data</th>
              <th style={{ padding: 10, borderBottom: '1px solid var(--border)', color: 'var(--muted)' }}>Usuário</th>
              <th style={{ padding: 10, borderBottom: '1px solid var(--border)', color: 'var(--muted)' }}>Ação</th>
              <th style={{ padding: 10, borderBottom: '1px solid var(--border)', color: 'var(--muted)' }}>Entidade</th>
              <th style={{ padding: 10, borderBottom: '1px solid var(--border)', color: 'var(--muted)' }}>Origem</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it) => (
              <tr key={it.id}>
                <td style={{ padding: 10, borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap', color: 'var(--text)' }}>{it.created_at}</td>
                <td style={{ padding: 10, borderBottom: '1px solid var(--border)', color: 'var(--text)' }}>{it.user_id ? `${it.user_id} (${it.user_role || ''})` : '-'}</td>
                <td style={{ padding: 10, borderBottom: '1px solid var(--border)', color: 'var(--text)' }}>{it.action}</td>
                <td style={{ padding: 10, borderBottom: '1px solid var(--border)', color: 'var(--text)' }}>{it.entity_type ? `${it.entity_type}:${it.entity_id || ''}` : '-'}</td>
                <td style={{ padding: 10, borderBottom: '1px solid var(--border)', color: 'var(--text)' }}>{it.ip || '-'}</td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr><td colSpan={5} style={{ padding: 14, color: 'var(--muted)' }}>Nenhum evento encontrado.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
