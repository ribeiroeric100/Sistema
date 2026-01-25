import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { authService } from '@services/api'
import { useAuth } from '@context/useAuth'
import styles from './Login.module.css'
import logo from '../../assets/logo.png'

export default function Login() {
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setErro('')
    setLoading(true)

    try {
      const { token, user } = await authService.login(email, senha)
      login(user, token)
      navigate('/dashboard')
    } catch (err) {
      setErro(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.header}>
          <img src={logo} alt="Dentaly" className={styles.logo} />
        </div>

        <form onSubmit={handleSubmit}>
          <div className={styles.formGroup}>
            <label htmlFor="login-email">Email</label>
            <div className={styles.inputRow}>
              <div className={styles.inputIcon} aria-hidden="true">
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M4 6.5C4 5.67157 4.67157 5 5.5 5H18.5C19.3284 5 20 5.67157 20 6.5V17.5C20 18.3284 19.3284 19 18.5 19H5.5C4.67157 19 4 18.3284 4 17.5V6.5Z"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M5 7L12 12.2L19 7"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <input
                id="login-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
                autoComplete="email"
                inputMode="email"
              />
            </div>
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="login-password">Senha</label>
            <div className={styles.inputRow}>
              <div className={styles.inputIcon} aria-hidden="true">
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M7 11V8.7C7 6.10449 9.23858 4 12 4C14.7614 4 17 6.10449 17 8.7V11"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                  />
                  <path
                    d="M7.5 11H16.5C17.3284 11 18 11.6716 18 12.5V18.5C18 19.3284 17.3284 20 16.5 20H7.5C6.67157 20 6 19.3284 6 18.5V12.5C6 11.6716 6.67157 11 7.5 11Z"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M12 15V16.8"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                  />
                </svg>
              </div>
              <input
                id="login-password"
                type="password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                required
                disabled={loading}
                autoComplete="current-password"
                placeholder="••••••••"
              />
            </div>
          </div>

          {erro && (
            <div className={styles.error} role="alert">
              {erro}
            </div>
          )}

          <button type="submit" disabled={loading} className={styles.submitBtn}>
            <span className={styles.submitContent} aria-busy={loading}>
              {loading && <span className={styles.spinner} aria-hidden="true" />}
              {loading ? 'Carregando...' : 'Entrar'}
            </span>
          </button>
        </form>
      </div>
    </div>
  )
}
