import styles from './Navbar.module.css'
import { useEffect } from 'react'
import { useAuth } from '../../context/useAuth'
import { useNavigate, useLocation } from 'react-router-dom'

// Use logo from public (added as frontend/public/logo.svg)

export default function Navbar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const routeTitles = [
    ['/dashboard', 'Dashboard'],
    ['/agenda', 'Agenda'],
    ['/atendimentos', 'Atendimentos'],
    ['/pacientes', 'Pacientes'],
    ['/estoque', 'Estoque'],
    ['/relatorios', 'Relatórios'],
    ['/settings', 'Configurações']
  ]

  const getTitle = (pathname) => {
    for (const [path, title] of routeTitles) {
      if (pathname === path || pathname.startsWith(path + '/')) return title
    }
    return 'Sistema Odontológico'
  }

  const pageTitle = getTitle(location.pathname)
  useEffect(() => {
    if (typeof document !== 'undefined' && document.title !== pageTitle) {
      document.title = pageTitle
    }
  }, [pageTitle])

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const monthLabel = (() => {
    try {
      const now = new Date()
      const label = now.toLocaleString('pt-BR', { month: 'long' })
      return (label || '').replace(/^./, c => c.toUpperCase())
    } catch {
      return 'Mês'
    }
  })()

  return (
    <nav className={styles.navbar}>
      <div className={styles.left}>
        <h2 className={styles.title}>{pageTitle}</h2>
        <div className={styles.breadcrumb}>Menu Principal <span className={styles.sep}>/</span> {pageTitle}</div>
      </div>

      <div className={styles.right}>
        <button type="button" className={styles.monthPill} aria-label="Mês atual">
          <span className={styles.calendarIcon} aria-hidden="true">📅</span>
          {monthLabel}
        </button>

        <div className={styles.userPill}>
          <span className={styles.userName}>{user?.nome}</span>
          <button type="button" className={styles.logoutBtn} onClick={handleLogout}>Sair</button>
        </div>
      </div>
    </nav>
  )
}
