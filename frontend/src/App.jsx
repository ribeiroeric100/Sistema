import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from '@context/AuthContext'
import { useAuth } from '@context/useAuth'
import Sidebar from '@components/layout/Sidebar'
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

function RequireRoles({ role, roles, children }) {
  if (!roles || roles.includes(role)) return children
  return <Navigate to="/dashboard" />
}

function AppContent() {
  const { user, loading } = useAuth()

  const role = String(user?.role || '').toLowerCase()

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
          <Sidebar />
          <div className="appContent">
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
