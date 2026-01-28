import styles from './BreadcrumbTitle.module.css'

export default function BreadcrumbTitle({
  current,
  items,
  className,
  homeLabel = 'Home',
  homeHref = '/dashboard'
}) {
  const safeCurrent = String(current || '').trim() || 'Página'
  const baseItems = Array.isArray(items) && items.length
    ? items
    : [{ label: homeLabel, href: homeHref }]

  return (
    <div className={className ? `${styles.wrap} ${className}` : styles.wrap}>
      <h1 className={styles.srOnly}>{safeCurrent}</h1>
      <nav className={styles.breadcrumb} aria-label="Breadcrumb">
        {baseItems.map((it, idx) => (
          <span key={`${it?.href || it?.label || idx}`} className={styles.crumb}>
            {it?.href ? (
              <a className={styles.link} href={it.href}>{it.label}</a>
            ) : (
              <span className={styles.label}>{it?.label}</span>
            )}
            <span className={styles.sep} aria-hidden>›</span>
          </span>
        ))}
        <span className={styles.current}>{safeCurrent}</span>
      </nav>
    </div>
  )
}
