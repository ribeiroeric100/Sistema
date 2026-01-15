import { useEffect, useState } from 'react'
import { authService } from '@services/api'
import { AuthContext } from './AuthContextBase'

const normalizeRole = (role) => {
  const r = String(role || '').trim().toLowerCase()
  if (!r) return ''
  if (r === 'assistente' || r === 'recepção') return 'recepcao'
  return r
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    try {
      if (typeof window === 'undefined') return null
      const token = localStorage.getItem('token')
      const userData = localStorage.getItem('user')
      if (!token || !userData) return null
      const parsed = JSON.parse(userData)
      return parsed ? { ...parsed, role: normalizeRole(parsed.role) } : null
    } catch {
      return null
    }
  })

  const [loading] = useState(false)

  useEffect(() => {
    const handler = () => {
      try {
        localStorage.removeItem('token')
        localStorage.removeItem('user')
      } catch {
        // ignore
      }
      setUser(null)
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('auth:logout', handler)
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('auth:logout', handler)
      }
    }
  }, [])

  const login = (userData, token) => {
    localStorage.setItem('token', token)
    const normalized = userData ? { ...userData, role: normalizeRole(userData.role) } : null
    localStorage.setItem('user', JSON.stringify(normalized))
    setUser(normalized)
  }

  const logout = async () => {
    try {
      await authService.logout()
    } catch {
      // ignore
    }
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  )
}
