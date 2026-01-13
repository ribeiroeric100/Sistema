import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { authService } from '@services/api'
import { useAuth } from '@context/useAuth'
import styles from './Login.module.css'
import logo from '../../assets/dente.png'

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
          <img src={logo} alt="DR. NETO ABREU" className={styles.logo} />
          <div className={styles.brandName}>DR. NETO ABREU</div>
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

          <div className={styles.formGroup}>
            <label>Senha</label>
            <input
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              required
              disabled={loading}
            />
          </div>

          {erro && <div className={styles.error}>{erro}</div>}

          <button type="submit" disabled={loading} className={styles.submitBtn}>
            {loading ? 'Carregando...' : 'Entrar'}
          </button>
        </form>

        <p className={styles.signup}>
          <button
            type="button"
            onClick={() => navigate('/forgot-password')}
            style={{ background: 'none', border: 'none', color: '#667eea', cursor: 'pointer', textDecoration: 'underline' }}
          >
            Esqueci minha senha
          </button>
        </p>

        <p className={styles.signup}>
          Não tem conta? <button type="button" onClick={() => navigate('/register')} style={{background: 'none', border: 'none', color: '#667eea', cursor: 'pointer', textDecoration: 'underline'}}>Registrar-se</button>
        </p>
      </div>
    </div>
  )
}
