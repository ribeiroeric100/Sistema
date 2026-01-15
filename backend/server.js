require('dotenv').config()
const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const bodyParser = require('body-parser')
const db = require('./config/database')
const authRoutes = require('./routes/auth')
const estoqueRoutes = require('./routes/estoque')
const pacientesRoutes = require('./routes/pacientes')
const consultasRoutes = require('./routes/consultas')
const relatoriosRoutes = require('./routes/relatorios')
const usuariosRoutes = require('./routes/usuarios')
const configuracoesRoutes = require('./routes/configuracoes')
const auditoriaRoutes = require('./routes/auditoria')

const app = express()

const NODE_ENV = String(process.env.NODE_ENV || '').toLowerCase()
const isProduction = NODE_ENV === 'production'

// Importante para obter IP real e compatibilidade com rate-limit atrás de proxy/LB.
// Render/Fly/Heroku/Nginx geralmente exigem isso.
app.set('trust proxy', 1)

app.disable('x-powered-by')

// Headers de segurança (CSP geralmente é responsabilidade do frontend/CDN).
app.use(
  helmet({
    contentSecurityPolicy: false
  })
)

function parseCorsOrigins(value) {
  return String(value || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

const corsOrigins = parseCorsOrigins(process.env.CORS_ORIGIN)

if (isProduction && corsOrigins.length === 0) {
  console.error('[FATAL] Em produção, defina CORS_ORIGIN (lista separada por vírgula).')
  process.exit(1)
}

const corsOptions = {
  origin: (origin, callback) => {
    // Permite requests sem Origin (curl, Electron, server-to-server)
    if (!origin) return callback(null, true)

    // Se não configurado, libera em dev (comportamento atual)
    if (corsOrigins.length === 0) return callback(null, true)

    if (corsOrigins.includes(origin)) return callback(null, true)
    return callback(new Error('Not allowed by CORS'))
  }
}

// Middlewares
app.use(cors(corsOptions))
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }))

// Inicializar banco de dados
Promise.resolve()
  .then(() => db.initialize())
  .then(() => {
    // Rotas
    app.use('/api/auth', authRoutes)
    app.use('/api/estoque', estoqueRoutes)
    app.use('/api/pacientes', pacientesRoutes)
    app.use('/api/consultas', consultasRoutes)
    app.use('/api/relatorios', relatoriosRoutes)
    app.use('/api/usuarios', usuariosRoutes)
    app.use('/api/configuracoes', configuracoesRoutes)
    app.use('/api/auditoria', auditoriaRoutes)

    // Health check
    app.get('/api/health', (req, res) => {
      res.json({ status: 'OK', message: 'Servidor odontológico rodando' })
    })

    // Handler de erros (inclui CORS)
    app.use((err, req, res, next) => {
      if (err && err.message === 'Not allowed by CORS') {
        return res.status(403).json({ error: 'Origem não permitida (CORS)' })
      }
      if (err) {
        console.error(err)
        return res.status(500).json({ error: 'Erro interno' })
      }
      return next()
    })

    const PORT = process.env.PORT || 3001
    app.listen(PORT, () => {
      console.log(`🦷 Servidor odontológico rodando na porta ${PORT}`)
    })
  })
  .catch((err) => {
    console.error('[FATAL] Falha ao inicializar Postgres:', err?.message || err)
    process.exit(1)
  })

