import { useMemo, useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@context/useAuth'
import styles from './MobileHeader.module.css'
import toothLogo from '../../assets/dente.png'

function MenuIcon(props) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path d="M4 7H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M4 12H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M4 17H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

function LogoutIcon(props) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path d="M10 7V6a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-6a2 2 0 0 1-2-2v-1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M4 12h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M7 9l-3 3 3 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export default function MobileHeader() {
  const { user, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)

  const role = String(user?.role || '').toLowerCase()
  const isAdmin = role === 'admin'

  const roleLabel = useMemo(() => {
    if (role === 'admin') return 'Administrador'
    if (role === 'dentista') return 'Dentista'
    if (role === 'recepcao') return 'Recepção'
    return 'Usuário'
  }, [role])

  const displayName = String(user?.nome || user?.name || roleLabel || '').trim()
  const displayEmail = String(user?.email || user?.username || '').trim()

  const initials = useMemo(() => {
    const base = (displayName || displayEmail || '').trim()
    if (!base) return 'US'
    const words = base
      .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
      .trim()
      .split(/\s+/)
      .filter(Boolean)

    const first = words[0] || ''
    const second = words[1] || ''
    const a = first.slice(0, 1)
    const b = (second ? second.slice(0, 1) : first.slice(1, 2))
    return (a + b).toUpperCase() || 'US'
  }, [displayEmail, displayName])

  const menuItems = useMemo(() => {
    if (!isAdmin) return []
    return [
      { label: 'Auditoria', path: '/auditoria' },
      { label: 'Usuários', path: '/usuarios' },
      { label: 'Configurações', path: '/settings' }
    ]
  }, [isAdmin])

  const handleLogout = async () => {
    try {
      setMenuOpen(false)
      await logout?.()
    } finally {
      navigate('/login', { replace: true })
    }
  }

  const pageTitle = useMemo(() => {
    const p = location.pathname
    if (p === '/dashboard') return 'Dashboard'
    if (p === '/agenda') return 'Agenda'
    if (p === '/estoque') return 'Estoque'
    if (p === '/pacientes' || p.startsWith('/paciente/')) return 'Pacientes'
    if (p === '/atendimentos') return 'Relatórios'
    if (p === '/auditoria') return 'Auditoria'
    if (p === '/usuarios') return 'Usuários'
    if (p === '/settings') return 'Configurações'
    return 'Sistema'
  }, [location.pathname])

  return (
    <header className={styles.root}>
      <div className={styles.topRow}>
        <div className={styles.left}>
          <button
            type="button"
            className={styles.iconBtn}
            onClick={() => setMenuOpen(true)}
            aria-label="Abrir menu"
          >
            <MenuIcon aria-hidden="true" />
          </button>
        </div>

        <div className={styles.brand}>
          <img className={styles.brandLogo} src={toothLogo} alt="" aria-hidden="true" />
          <span className={styles.brandText}>DR. NETO ABREU</span>
        </div>

        <div className={styles.right} aria-hidden="true" />
      </div>

      <div className={styles.titleRow}>
        <h1 className={styles.title}>{pageTitle}</h1>
      </div>

      {menuOpen && (
        <div className={styles.overlay} role="dialog" aria-modal="true" aria-label="Menu" onMouseDown={() => setMenuOpen(false)}>
          <div className={styles.sheet} onMouseDown={(e) => e.stopPropagation()}>
            <div className={styles.sheetBody}>
              <div className={styles.profileCard}>
                <div className={styles.profileTop}>
                  <div className={styles.avatar} aria-hidden="true">{initials}</div>
                  <div className={styles.profileMeta}>
                    <div className={styles.profileName}>{displayName}</div>
                    {displayEmail ? <div className={styles.profileEmail}>{displayEmail}</div> : null}
                  </div>
                </div>

                <button type="button" className={styles.profileLogout} onClick={handleLogout}>
                  <span className={styles.profileLogoutIcon} aria-hidden="true"><LogoutIcon /></span>
                  <span className={styles.profileLogoutText}>Sair</span>
                </button>
              </div>

              {menuItems.length > 0 && (
                <nav className={styles.sheetNav} aria-label="Navegação">
                  {menuItems.map((item) => (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      className={({ isActive }) => isActive ? `${styles.sheetLink} ${styles.active}` : styles.sheetLink}
                      onClick={() => setMenuOpen(false)}
                    >
                      {item.label}
                    </NavLink>
                  ))}
                </nav>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  )
}
