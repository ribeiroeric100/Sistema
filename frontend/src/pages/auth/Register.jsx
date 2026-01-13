import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { authService } from '@services/api'
import { useAuth } from '@context/useAuth'
import styles from './Login.module.css'

export default function Register() {
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [confirmarSenha, setConfirmarSenha] = useState('')
  const [erro, setErro] = useState('')
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setErro('')

    if (senha !== confirmarSenha) {
      setErro('As senhas não conferem')
      return
    }

    if (senha.length < 6) {
      setErro('A senha deve ter no mínimo 6 caracteres')
      return
    }

    setLoading(true)

    try {
      const { token, user } = await authService.register(nome, email, senha)
      login(user, token)
      navigate('/dashboard')
    } catch (err) {
      setErro(err.message || 'Erro ao registrar')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.header}>
          <img src="/logo.svg" alt="Logo" className={styles.logo} />
          <h1 className={styles.title}>Criar Conta</h1>
        </div>

        <form onSubmit={handleSubmit}>
          <div className={styles.formGroup}>
            <label>Nome Completo</label>
            <input
              type="text"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              required
              disabled={loading}
            />
          </div>

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

          <div className={styles.formGroup}>
            <label>Confirmar Senha</label>
            <input
              type="password"
              value={confirmarSenha}
              onChange={(e) => setConfirmarSenha(e.target.value)}
              required
              disabled={loading}
            />
          </div>

          {erro && <div className={styles.error}>{erro}</div>}

          <button type="submit" disabled={loading} className={styles.submitBtn}>
            {loading ? 'Registrando...' : 'Registrar'}
          </button>
        </form>

        <p className={styles.signup}>
          Já tem conta? <button type="button" onClick={() => navigate('/login')} style={{background: 'none', border: 'none', color: '#667eea', cursor: 'pointer', textDecoration: 'underline'}}>Entrar</button>
        </p>
      </div>
    </div>
  )
}
