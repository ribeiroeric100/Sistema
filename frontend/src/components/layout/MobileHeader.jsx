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

function BackIcon(props) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
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

function ChevronRightIcon(props) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function NavIcon({ name }) {
  const common = {
    width: 20,
    height: 20,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true,
    focusable: false
  }

  switch (name) {
    case 'home':
      return (
        <svg {...common}>
          <path d="M3 10.5L12 3l9 7.5" />
          <path d="M5 10v10h14V10" />
        </svg>
      )
    case 'patients':
      return (
        <svg {...common}>
          <path d="M20 21a8 8 0 0 0-16 0" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      )
    case 'calendar':
      return (
        <svg {...common}>
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <path d="M16 3v4" />
          <path d="M8 3v4" />
          <path d="M3 11h18" />
        </svg>
      )
    case 'report':
      return (
        <svg {...common}>
          <path d="M4 19V5" />
          <path d="M4 19H20" />
          <path d="M8 17v-5" />
          <path d="M12 17V9" />
          <path d="M16 17V6" />
        </svg>
      )
    case 'box':
      return (
        <svg {...common}>
          <path d="M21 8l-9-5-9 5 9 5 9-5Z" />
          <path d="M3 8v8l9 5 9-5V8" />
          <path d="M12 13v8" />
        </svg>
      )
    case 'shield':
      return (
        <svg {...common}>
          <path d="M12 3l8 4v6c0 5-3.5 9-8 10-4.5-1-8-5-8-10V7l8-4Z" />
          <path d="M9 12l2 2 4-5" />
        </svg>
      )
    case 'users':
      return (
        <svg {...common}>
          <path d="M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" />
          <circle cx="10" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      )
    case 'settings':
      return (
        <svg {...common}>
          <path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" />
          <path d="M19.4 15a7.8 7.8 0 0 0 .1-1l2-1.5-2-3.5-2.4.6a7.5 7.5 0 0 0-1.7-1L15 5h-6l-.4 2.6a7.5 7.5 0 0 0-1.7 1L4.5 8l-2 3.5L4.5 13a7.8 7.8 0 0 0 .1 1L2.5 15.5l2 3.5 2.4-.6a7.5 7.5 0 0 0 1.7 1L9 22h6l.4-2.6a7.5 7.5 0 0 0 1.7-1l2.4.6 2-3.5-2.1-1.5Z" />
        </svg>
      )
    default:
      return null
  }
}

export default function MobileHeader() {
  const { user, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)

  const role = String(user?.role || '').toLowerCase()
  const isAdmin = role === 'admin'
  const canSeeRelatorios = role === 'admin' || role === 'dentista'

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
    const base = [
      { label: 'Dashboard', path: '/dashboard', icon: 'home' },
      { label: 'Pacientes', path: '/pacientes', icon: 'patients' },
      { label: 'Agenda', path: '/agenda', icon: 'calendar' },
      ...(canSeeRelatorios ? [{ label: 'Relatórios', path: '/atendimentos', icon: 'report' }] : []),
      { label: 'Estoque', path: '/estoque', icon: 'box' }
    ]

    const adminExtras = isAdmin
      ? [
          { label: 'Auditoria', path: '/auditoria', icon: 'shield' },
          { label: 'Usuários', path: '/usuarios', icon: 'users' },
          { label: 'Configuração', path: '/settings', icon: 'settings' }
        ]
      : []

    return [...base, ...adminExtras]
  }, [canSeeRelatorios, isAdmin])

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

  const showBack = useMemo(() => location.pathname.startsWith('/paciente/'), [location.pathname])

  const handleBack = () => {
    try {
      if (window.history.length > 1) {
        navigate(-1)
      } else {
        navigate('/pacientes')
      }
    } catch {
      navigate('/pacientes')
    }
  }

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

      {showBack ? (
        <div className={styles.backRow}>
          <button type="button" className={styles.backBtn} onClick={handleBack} aria-label="Voltar">
            <BackIcon aria-hidden="true" />
          </button>
        </div>
      ) : null}

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
              </div>

              <nav className={styles.drawerNav} aria-label="Navegação">
                {menuItems.map((item) => (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    className={({ isActive }) => isActive ? `${styles.drawerItem} ${styles.active}` : styles.drawerItem}
                    onClick={() => setMenuOpen(false)}
                  >
                    <span className={styles.drawerIcon} aria-hidden="true"><NavIcon name={item.icon} /></span>
                    <span className={styles.drawerLabel}>{item.label}</span>
                    <span className={styles.drawerChevron} aria-hidden="true"><ChevronRightIcon /></span>
                  </NavLink>
                ))}
              </nav>

              <button type="button" className={styles.drawerLogout} onClick={handleLogout}>
                <span className={styles.drawerLogoutIcon} aria-hidden="true"><LogoutIcon /></span>
                <span className={styles.drawerLogoutText}>Sair</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  )
}
