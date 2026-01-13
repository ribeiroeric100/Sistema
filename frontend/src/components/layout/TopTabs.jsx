import { NavLink } from 'react-router-dom'
import styles from './TopTabs.module.css'

export default function TopTabs() {
  const tabs = [
    { label: 'Dashboard', path: '/dashboard' },
    { label: 'Agenda', path: '/agenda' },
    { label: 'Atendimentos', path: '/atendimentos' },
    { label: 'Pacientes', path: '/pacientes' },
    { label: 'Estoque', path: '/estoque' },
    { label: 'Relatórios', path: '/relatorios' },
    { label: 'Configurações', path: '/settings' }
  ]

  return (
    <div className={styles.container}>
      <nav className={styles.tabs}>
        {tabs.map(t => (
          <NavLink
            key={t.path}
            to={t.path}
            className={({ isActive }) => isActive ? `${styles.tab} ${styles.active}` : styles.tab}
          >
            {/* optional icons next to tab labels */}
            {t.path === '/agenda' && <img src="/assets/agenda.svg" alt="agenda" className={styles.tabIcon} />}
            {t.path === '/relatorios' && <img src="/assets/relatorio.svg" alt="relatorios" className={styles.tabIcon} />}
            {t.path === '/estoque' && <img src="/assets/estoque.svg" alt="estoque" className={styles.tabIcon} />}
            {t.path === '/settings' && <img src="/assets/config.svg" alt="config" className={styles.tabIcon} />}
            {t.label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
