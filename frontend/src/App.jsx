import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from '@context/AuthContext'
import { useAuth } from '@context/useAuth'
import Sidebar from '@components/layout/Sidebar'
import MobileHeader from '@components/layout/MobileHeader'
import Login from '@pages/auth/Login'
import ForgotPassword from '@pages/auth/ForgotPassword'
import ResetPassword from '@pages/auth/ResetPassword'
import Dashboard from '@pages/Dashboard'
import Pacientes from '@pages/Pacientes'
import PacientePerfil from '@pages/PacientePerfil'
import Estoque from '@pages/Estoque'
import Agenda from '@pages/Agenda'
import Atendimentos from '@pages/Atendimentos'
import Configuracoes from '@pages/Configuracoes'
import Auditoria from '@pages/Auditoria'
import Usuarios from '@pages/Usuarios'
import './App.css'
import { configuracoesService } from '@services/api'
import { applyClinicTheme, normalizeThemeUi } from '@services/theme'
import { useEffect } from 'react'

function RequireRoles({ role, roles, children }) {
  if (!roles || roles.includes(role)) return children
  return <Navigate to="/dashboard" />
}

function AppContent() {
  const { user, loading } = useAuth()

  const role = String(user?.role || '').toLowerCase()

  useEffect(() => {
    let alive = true
    let cleanup = null

    const run = async () => {
      try {
        const data = await configuracoesService.buscar()
        if (!alive) return
        const roleKey = role === 'admin'
          ? 'tema_ui_admin'
          : role === 'dentista'
            ? 'tema_ui_dentista'
            : role === 'recepcao'
              ? 'tema_ui_recepcao'
              : 'tema_ui'

        const themeUi = normalizeThemeUi(data?.[roleKey] || data?.tema_ui || 'system')
        cleanup = applyClinicTheme(data?.cor_primaria ?? '#2563eb', themeUi)
      } catch {
        cleanup = applyClinicTheme('#2563eb', 'system')
      }
    }

    if (user) run()

    return () => {
      alive = false
      cleanup?.()
    }
  }, [user, role])

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>Carregando...</div>
  }

  if (!user) {
    return (
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Navigate to="/login" />} />
          <Route path="/forgot-password" element={<Navigate to="/login" />} />
          <Route path="/reset-password" element={<Navigate to="/login" />} />
          <Route path="*" element={<Navigate to="/login" />} />
        </Routes>
      </Router>
    )
  }

  return (
    <Router>
      <div className="appViewport">
        <div className="appShell">
          <div className="appSidebar">
            <Sidebar />
          </div>
          <div className="appContent">
            <MobileHeader />
            <main className="appMain">
              <Routes>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/pacientes" element={<Pacientes />} />
              <Route path="/paciente/:id" element={<PacientePerfil />} />
              <Route path="/estoque" element={<Estoque />} />
              <Route path="/agenda" element={<Agenda />} />
              <Route path="/atendimentos" element={
                <RequireRoles role={role} roles={['admin', 'dentista']}>
                  <Atendimentos />
                </RequireRoles>
              } />
              <Route path="/auditoria" element={
                <RequireRoles role={role} roles={['admin']}>
                  <Auditoria />
                </RequireRoles>
              } />
              <Route path="/usuarios" element={
                <RequireRoles role={role} roles={['admin']}>
                  <Usuarios />
                </RequireRoles>
              } />
              <Route path="/settings" element={
                <RequireRoles role={role} roles={['admin']}>
                  <Configuracoes />
                </RequireRoles>
              } />
              <Route path="*" element={<Navigate to="/dashboard" />} />
              </Routes>
            </main>
          </div>
        </div>
      </div>
    </Router>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}
