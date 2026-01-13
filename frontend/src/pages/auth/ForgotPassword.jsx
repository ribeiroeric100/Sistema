import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { authService } from '@services/api'
import styles from './Login.module.css'
import logo from '../../assets/dr-neto-logo.png'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [erro, setErro] = useState('')
  const [ok, setOk] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setErro('')
    setOk('')
    setLoading(true)

    try {
      const resp = await authService.forgotPassword(email)
      setOk(resp?.message || 'Se o e-mail existir, enviaremos instruções para redefinir a senha.')
    } catch {
      // Mesmo em caso de erro, manter resposta genérica
      setOk('Se o e-mail existir, enviaremos instruções para redefinir a senha.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.header}>
          <img src={logo} alt="DR. NETO ABREU" className={styles.logo} />
          <h1 className={styles.title}>Recuperar senha</h1>
        </div>

        <form onSubmit={handleSubmit}>
          <div className={styles.formGroup}>
            <label>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
            />
          </div>

          {erro && <div className={styles.error}>{erro}</div>}
          {ok && <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', color: '#065f46', padding: 10, borderRadius: 10, marginBottom: 12 }}>{ok}</div>}

          <button type="submit" disabled={loading} className={styles.submitBtn}>
            {loading ? 'Enviando...' : 'Enviar link'}
          </button>
        </form>

        <p className={styles.signup}>
          <button
            type="button"
            onClick={() => navigate('/login')}
            style={{ background: 'none', border: 'none', color: '#667eea', cursor: 'pointer', textDecoration: 'underline' }}
          >
            Voltar para o login
          </button>
        </p>
      </div>
    </div>
  )
}
