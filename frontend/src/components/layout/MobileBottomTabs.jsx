import { useMemo } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@context/useAuth'
import styles from './MobileBottomTabs.module.css'

function TabIcon({ name }) {
  const common = {
    width: 22,
    height: 22,
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
    case 'users':
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
    default:
      return null
  }
}

export default function MobileBottomTabs() {
  const { user } = useAuth()
  const role = String(user?.role || '').toLowerCase()
  const canSeeRelatorios = role === 'admin' || role === 'dentista'

  const location = useLocation()
  const navigate = useNavigate()

  const tabs = useMemo(() => {
    const base = [
      { label: 'Dashboard', path: '/dashboard', icon: 'home' },
      { label: 'Pacientes', path: '/pacientes', icon: 'users' },
      { label: 'Agenda', path: '/agenda', icon: 'calendar' },
      ...(canSeeRelatorios ? [{ label: 'Relatórios', path: '/atendimentos', icon: 'report' }] : []),
      { label: 'Estoque', path: '/estoque', icon: 'box' }
    ]

    return base
  }, [canSeeRelatorios])

  const isActivePath = (tabPath) => {
    const p = location.pathname
    if (p === tabPath) return true
    if (p.startsWith(tabPath + '/')) return true
    if (tabPath === '/pacientes' && p.startsWith('/paciente/')) return true
    return false
  }

  return (
    <nav className={styles.root} aria-label="Abas principais">
      {tabs.map((t) => (
        <button
          key={t.path}
          type="button"
          className={isActivePath(t.path) ? `${styles.tab} ${styles.active}` : styles.tab}
          onClick={() => navigate(t.path)}
        >
          <span className={styles.icon} aria-hidden="true"><TabIcon name={t.icon} /></span>
          <span className={styles.label}>{t.label}</span>
        </button>
      ))}
    </nav>
  )
}
