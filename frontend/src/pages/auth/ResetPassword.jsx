import { useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { authService } from '@services/api'
import styles from './Login.module.css'
import logo from '../../assets/dr-neto-logo.png'

function useQuery() {
  const { search } = useLocation()
  return useMemo(() => new URLSearchParams(search), [search])
}

export default function ResetPassword() {
  const query = useQuery()
  const navigate = useNavigate()
  const token = query.get('token') || ''

  const [novaSenha, setNovaSenha] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [erro, setErro] = useState('')
  const [ok, setOk] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setErro('')
    setOk('')

    if (!token) {
      setErro('Token ausente. Solicite novamente a recuperação de senha.')
      return
    }

    if (novaSenha.length < 6) {
      setErro('A senha deve ter no mínimo 6 caracteres')
      return
    }

    if (novaSenha !== confirmar) {
      setErro('As senhas não conferem')
      return
    }

    setLoading(true)
    try {
      await authService.resetPassword(token, novaSenha)
      setOk('Senha atualizada com sucesso. Você já pode entrar.')
      setTimeout(() => navigate('/login'), 800)
    } catch (err) {
      setErro(err.message || 'Não foi possível redefinir a senha')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.header}>
          <img src={logo} alt="DR. NETO ABREU" className={styles.logo} />
          <h1 className={styles.title}>Redefinir senha</h1>
        </div>

        <form onSubmit={handleSubmit}>
          <div className={styles.formGroup}>
            <label>Nova senha</label>
            <input
              type="password"
              value={novaSenha}
              onChange={(e) => setNovaSenha(e.target.value)}
              required
              disabled={loading}
            />
          </div>

          <div className={styles.formGroup}>
            <label>Confirmar senha</label>
            <input
              type="password"
              value={confirmar}
              onChange={(e) => setConfirmar(e.target.value)}
              required
              disabled={loading}
            />
          </div>

          {erro && <div className={styles.error}>{erro}</div>}
          {ok && <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', color: '#065f46', padding: 10, borderRadius: 10, marginBottom: 12 }}>{ok}</div>}

          <button type="submit" disabled={loading} className={styles.submitBtn}>
            {loading ? 'Salvando...' : 'Atualizar senha'}
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
