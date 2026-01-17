export const DEFAULT_PRIMARY = '#2563eb'

export const THEME_UI_VALUES = ['light', 'dark', 'system']

export function normalizeThemeUi(value) {
  const v = String(value || '').trim().toLowerCase()
  return THEME_UI_VALUES.includes(v) ? v : 'system'
}

const THEME_VARS = {
  light: {
    '--bg-app': '#eef2f7',
    '--bg-surface': '#f3f6fb',
    '--surface': '#ffffff',
    '--text': '#0f172a',
    '--muted': '#6b7280',
    '--border': 'rgba(15, 23, 42, 0.08)',

    '--row-hover': 'rgba(15, 23, 42, 0.04)',
    '--table-head-bg': 'rgba(243, 246, 251, 0.85)',

    '--sidebar-bg': 'linear-gradient(180deg, #f8fafc 0%, #eef2f7 100%)',
    '--sidebar-overlay': 'transparent',
    '--sidebar-overlay-opacity': '0',
    '--sidebar-blur': '0px',
    '--sidebar-border': 'rgba(15, 23, 42, 0.08)',
    '--sidebar-fg': '#0f172a',
    '--sidebar-fg-muted': 'rgba(51, 65, 85, 0.85)',
    '--sidebar-item-hover': 'rgba(15, 23, 42, 0.04)',
    '--sidebar-item-active': 'var(--primary-a12)',
    '--sidebar-card-bg': 'rgba(255, 255, 255, 0.70)',
    '--sidebar-card-border': 'rgba(15, 23, 42, 0.08)',

    '--sidebar-active-bar': 'rgba(15, 23, 42, 0.92)',

    '--sidebar-start': '#f8fafc',
    '--sidebar-end': '#eef2f7'
  },
  system: {
    // Base claro (como era o sistema), mas com sidebar lilás original
    '--bg-app': '#eef2f7',
    '--bg-surface': '#f3f6fb',
    '--surface': '#ffffff',
    '--text': '#0f172a',
    '--muted': '#6b7280',
    '--border': 'rgba(15, 23, 42, 0.08)',

    '--row-hover': 'rgba(15, 23, 42, 0.04)',
    '--table-head-bg': 'rgba(243, 246, 251, 0.85)',

    // Sidebar: gradiente lilás como estava antes
    '--sidebar-bg': 'radial-gradient(900px circle at 20% 12%, rgba(255, 255, 255, 0.32), transparent 56%), radial-gradient(760px circle at 85% 30%, rgba(255, 255, 255, 0.18), transparent 58%), linear-gradient(180deg, #7b7ff0 0%, #8f96ff 55%, #7f89ff 100%)',
    '--sidebar-overlay': 'linear-gradient(180deg, rgba(0,0,0,0.22) 0%, rgba(0,0,0,0.16) 55%, rgba(0,0,0,0.18) 100%)',
    '--sidebar-overlay-opacity': '0.52',
    '--sidebar-blur': '10px',
    '--sidebar-border': 'rgba(255, 255, 255, 0.10)',
    '--sidebar-fg': 'rgba(229, 238, 252, 0.96)',
    '--sidebar-fg-muted': 'rgba(229, 238, 252, 0.88)',
    '--sidebar-item-hover': 'rgba(255, 255, 255, 0.10)',
    '--sidebar-item-active': 'rgba(255, 255, 255, 0.14)',
    '--sidebar-card-bg': 'rgba(255, 255, 255, 0.12)',
    '--sidebar-card-border': 'rgba(255, 255, 255, 0.10)',

    '--sidebar-active-bar': 'rgba(255, 255, 255, 0.95)',

    '--sidebar-start': '#7b7ff0',
    '--sidebar-end': '#7f89ff'
  },
  dark: {
    '--bg-app': 'radial-gradient(1200px circle at 18% 12%, rgba(99, 102, 241, 0.16), transparent 55%), radial-gradient(900px circle at 82% 22%, rgba(59, 130, 246, 0.14), transparent 58%), linear-gradient(180deg, #0b1220 0%, #0a1020 100%)',
    '--bg-surface': 'radial-gradient(900px circle at 22% 18%, rgba(99, 102, 241, 0.10), transparent 55%), radial-gradient(760px circle at 88% 28%, rgba(59, 130, 246, 0.08), transparent 58%), linear-gradient(180deg, rgba(15, 23, 42, 0.92), rgba(11, 18, 32, 0.96))',
    '--surface': 'rgba(17, 24, 39, 0.90)',
    '--text': '#e5e7eb',
    '--muted': '#94a3b8',
    '--border': 'rgba(255, 255, 255, 0.08)',

    '--row-hover': 'rgba(255, 255, 255, 0.05)',
    '--table-head-bg': 'rgba(255, 255, 255, 0.06)',

    '--sidebar-bg': 'radial-gradient(900px circle at 20% 12%, rgba(255, 255, 255, 0.06), transparent 56%), linear-gradient(180deg, rgba(30, 41, 59, 0.92) 0%, rgba(15, 23, 42, 0.96) 100%)',
    '--sidebar-overlay': 'transparent',
    '--sidebar-overlay-opacity': '0',
    '--sidebar-blur': '0px',
    '--sidebar-border': 'rgba(255, 255, 255, 0.08)',
    '--sidebar-fg': 'rgba(226, 232, 240, 0.95)',
    '--sidebar-fg-muted': 'rgba(226, 232, 240, 0.78)',
    '--sidebar-item-hover': 'rgba(255, 255, 255, 0.06)',
    '--sidebar-item-active': 'rgba(255, 255, 255, 0.08)',
    '--sidebar-card-bg': 'rgba(255, 255, 255, 0.06)',
    '--sidebar-card-border': 'rgba(255, 255, 255, 0.10)',

    '--sidebar-active-bar': 'rgba(255, 255, 255, 0.95)',

    '--sidebar-start': '#1f2a44',
    '--sidebar-end': '#0f172a'
  }
}

export function normalizeHex(hex, fallback = DEFAULT_PRIMARY) {
  const raw = String(hex || '').trim()
  if (!raw) return fallback
  const v = raw.startsWith('#') ? raw : `#${raw}`
  const ok = /^#[0-9a-fA-F]{6}$/.test(v)
  return ok ? v.toLowerCase() : fallback
}

function darkenHex(hex, amount = 0.14) {
  const h = normalizeHex(hex).slice(1)
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  const mix = (c) => Math.max(0, Math.min(255, Math.round(c * (1 - amount))))
  const rr = mix(r).toString(16).padStart(2, '0')
  const gg = mix(g).toString(16).padStart(2, '0')
  const bb = mix(b).toString(16).padStart(2, '0')
  return `#${rr}${gg}${bb}`
}

function hexToRgb(hex) {
  const h = normalizeHex(hex).slice(1)
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16)
  }
}

function rgbaFromHex(hex, alpha) {
  const { r, g, b } = hexToRgb(hex)
  const a = Math.max(0, Math.min(1, Number(alpha)))
  return `rgba(${r}, ${g}, ${b}, ${a})`
}

function resolveTheme(themeUi) {
  if (themeUi === 'dark') return 'dark'
  if (themeUi === 'light') return 'light'

  // system
  // Decisão de produto: manter o app no visual claro mesmo se o SO estiver em dark mode.
  // O tema escuro fica disponível apenas quando selecionado explicitamente.
  return 'light'
}

function applyVars(vars) {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  Object.entries(vars).forEach(([k, v]) => {
    root.style.setProperty(k, v)
  })
}

export function applyClinicTheme(primaryHex, themeUi) {
  if (typeof document === 'undefined') return () => {}

  const primary = normalizeHex(primaryHex)
  const themeUiNorm = normalizeThemeUi(themeUi)
  const resolved = resolveTheme(themeUiNorm)
  const variant = themeUiNorm === 'system' ? 'system' : resolved

  const root = document.documentElement
  root.dataset.theme = resolved
  root.dataset.themeUi = themeUiNorm
  root.style.setProperty('--primary', primary)
  root.style.setProperty('--primary-2', darkenHex(primary))
  root.style.setProperty('--primary-a08', rgbaFromHex(primary, 0.08))
  root.style.setProperty('--primary-a12', rgbaFromHex(primary, 0.12))
  root.style.setProperty('--primary-a16', rgbaFromHex(primary, 0.16))

  const themeVars = THEME_VARS[variant] || THEME_VARS.light
  applyVars(themeVars)

  // Helps native form controls follow the theme.
  root.style.colorScheme = resolved

  // Não acompanha mudança do SO no modo system (mantém claro).
  return () => {}
}
