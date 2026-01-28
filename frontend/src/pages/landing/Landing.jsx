import { Link } from 'react-router-dom'

export default function Landing() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', gap: 16 }}>
      <h1>Odonto</h1>
      <p>Bem-vindo ao sistema OdontoApp</p>
      <div style={{ display: 'flex', gap: 12 }}>
        <Link to="/login">Entrar</Link>
        <Link to="/register">Registrar</Link>
      </div>
    </div>
  )
}
