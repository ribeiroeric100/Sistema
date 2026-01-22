import styles from './Sidebar.module.css'
import { NavLink } from 'react-router-dom'
import { useAuth } from '../../context/useAuth'
import { useMemo, useEffect, useState } from 'react'
import { loadUserThemeUiPreference, normalizeThemeUi } from '../../services/theme'
// ...existing code...

// Hook para detectar se o tema UI é 'system'
function useIsSystemTheme(user) {
  const [isSystem, setIsSystem] = useState(false)
  useEffect(() => {
    const userThemeKey = String(user?.email || user?.nome || '').trim().toLowerCase()
    const stored = loadUserThemeUiPreference(userThemeKey)
    const themeUi = normalizeThemeUi(stored || 'system')
    setIsSystem(themeUi === 'system')
  }, [user])
  return isSystem
}
// Hook para detectar se está em mobile
function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= breakpoint)
  useEffect(() => {
    function handleResize() {
      setIsMobile(window.innerWidth <= breakpoint)
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [breakpoint])
  return isMobile
}
import { useNavigate } from 'react-router-dom'
import logoWhite from '../../assets/dr-neto-logo.png'
import logoBlack from '../../assets/dr-neto-logo-black.png'

export default function Sidebar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const menuItems = [
    { label: 'Dashboard', path: '/dashboard', icon: 'dashboard', roles: ['admin', 'dentista', 'recepcao'] },
    { label: 'Pacientes', path: '/pacientes', icon: 'pacientes', roles: ['admin', 'dentista', 'recepcao'] },
    { label: 'Agenda', path: '/agenda', icon: 'agenda', roles: ['admin', 'dentista', 'recepcao'] },
    { label: 'Relatórios', path: '/atendimentos', icon: 'relatorios', roles: ['admin', 'dentista'] },
    { label: 'Estoque', path: '/estoque', icon: 'estoque', roles: ['admin', 'dentista', 'recepcao'] },
    { label: 'Usuários', path: '/usuarios', icon: 'usuarios', roles: ['admin'] },
    { label: 'Auditoria', path: '/auditoria', icon: 'relatorios', roles: ['admin'] },
    { label: 'Configurações', path: '/settings', icon: 'config', roles: ['admin', 'dentista', 'recepcao'] }
  ]

  function renderIcon(name) {
    const common = {
      width: 18,
      height: 18,
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
      case 'dashboard':
        return (
          <svg {...common}>
            <path d="M4 13V20" />
            <path d="M10 9V20" />
            <path d="M16 4V20" />
            <path d="M22 20H2" />
          </svg>
        )

      case 'pacientes':
        return (
          <svg {...common}>
            <path d="M20 21a8 8 0 0 0-16 0" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        )

      case 'agenda':
        return (
          <svg {...common}>
            <rect x="3" y="5" width="18" height="16" rx="2" />
            <path d="M16 3v4" />
            <path d="M8 3v4" />
            <path d="M3 11h18" />
          </svg>
        )

      case 'atendimentos':
      case 'relatorios':
        return (
          <svg {...common}>
            <path d="M4 19V5" />
            <path d="M4 19H20" />
            <path d="M8 17v-5" />
            <path d="M12 17V9" />
            <path d="M16 17V6" />
          </svg>
        )

      case 'estoque':
        return (
          <svg {...common}>
            <path d="M21 8l-9-5-9 5 9 5 9-5Z" />
            <path d="M3 8v8l9 5 9-5V8" />
            <path d="M12 13v8" />
          </svg>
        )

      case 'config':
        return (
          <svg {...common}>
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.09A1.65 1.65 0 0 0 11 3.09V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h.09a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.09a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
        )

      case 'usuarios':
        return (
          <svg {...common}>
            <path d="M17 21a5 5 0 0 0-10 0" />
            <circle cx="12" cy="7" r="3" />
            <path d="M21 21a4 4 0 0 0-6-3.5" />
            <path d="M3 21a4 4 0 0 1 6-3.5" />
          </svg>
        )

      default:
        return null
    }
  }



  const role = String(user?.role || '').toLowerCase()
  const itemsVisiveis = menuItems.filter(item => item.roles.includes(role))
  const isMobile = useIsMobile(768)
  const isSystemTheme = useIsSystemTheme(user)

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const userName = String(user?.nome || '').trim()
  const userEmail = String(user?.email || '').trim()
  const userInitials = useMemo(() => {
    const parts = userName.split(/\s+/).filter(Boolean)
    if (!parts.length) return 'U'
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  }, [userName])

  // Troca de logo por CSS classes para modo claro/escuro
  return (
    <aside className={styles.sidebar}>
      <div className={styles.brand}>
        <img src={logoBlack} alt="DR. NETO ABREU" className={styles.logoLight} />
        <img src={logoWhite} alt="DR. NETO ABREU" className={styles.logoDark} />
      </div>
      <div className={styles.brandDivider} aria-hidden="true" />
      <nav className={styles.nav}>
        {itemsVisiveis.map(item => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              (isMobile && isSystemTheme)
                ? `${styles.navItem} ${styles.active}`
                : (isActive ? `${styles.navItem} ${styles.active}` : styles.navItem)
            }
          >
            {renderIcon(item.icon)}
            <span className={styles.label}>{item.label}</span>
          </NavLink>
        ))}
      </nav>
      
      <div className={styles.footer}>
        <div className={styles.userCard}>
          <div className={styles.userTopRow}>
            <div className={styles.userAvatar} aria-hidden>
              {userInitials}
            </div>

            <div className={styles.userInfo}>
              <div className={styles.userName} title={userName || ''}>{userName || 'Clínica Care'}</div>
              <div className={styles.userEmail} title={userEmail || ''}>{userEmail || 'clinica@care.com'}</div>
            </div>
          </div>

          <button type="button" className={styles.logoutBtn} onClick={handleLogout}>
            <span className={styles.logoutIcon} aria-hidden>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10 17l5-5-5-5" />
                <path d="M15 12H3" />
                <path d="M21 12a9 9 0 0 0-9-9" />
                <path d="M12 21a9 9 0 0 0 9-9" />
              </svg>
            </span>
            Sair
          </button>
        </div>

        <p className={styles.footerCopy}>© {new Date().getFullYear()} DR. NETO ABREU</p>
      </div>
    </aside>
  )
}
