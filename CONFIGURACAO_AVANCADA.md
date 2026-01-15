# ⚙️ Guia de Configuração Avançada

## 🔧 Variáveis de Ambiente

### Backend (.env)

```env
# Servidor
PORT=3001
NODE_ENV=development

# Banco de Dados
# Postgres (obrigatório)
DATABASE_URL=

# SSL do Postgres (opcional)
# Em produção (NODE_ENV=production) o backend já ativa SSL automaticamente.
PGSSL=true

# Autenticação
JWT_SECRET=sua_chave_jwt_super_secreta_aqui

# URL do frontend (usada para links de redefinição de senha)
APP_URL=http://localhost:5173

# Email SMTP (opcional - usado no "Esqueci minha senha")
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_FROM=

# SMS (Opcional - para lembretes)
TWILIO_ACCOUNT_SID=seu_sid
TWILIO_AUTH_TOKEN=seu_token
TWILIO_PHONE_NUMBER=+55XX999999999

# Pagamentos (Opcional)
STRIPE_SECRET_KEY=sk_test_xxxxx
STRIPE_PUBLIC_KEY=pk_test_xxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxx

# PayPal (Opcional)
PAYPAL_MODE=sandbox
PAYPAL_CLIENT_ID=xxxxx
PAYPAL_CLIENT_SECRET=xxxxx
```

### Frontend (.env.local)

```env
VITE_API_URL=http://localhost:3001/api
VITE_APP_NAME=Sistema Odontológico
```

---

## 🗄️ Migração de Banco de Dados

### De SQLite para PostgreSQL

#### 1. Instale driver PostgreSQL:
```bash
cd backend
npm install pg
```

#### 2. Rode as migrations (cria as tabelas no Postgres/Supabase)

Se o `DATABASE_URL` apontar para o Supabase, as tabelas serão criadas lá diretamente:

```bash
npm run migrate:up --workspace=backend
```

#### 3. (Legado) Atualize `config/database.js`:
```javascript
const { Pool } = require('pg')

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'odonto_db'
})

const db = {
  query: (sql, values) => pool.query(sql, values),
  run: (sql, values, callback) => {
    pool.query(sql, values)
      .then(result => callback(null, result))
      .catch(err => callback(err))
  },
  all: (sql, values, callback) => {
    pool.query(sql, values)
      .then(result => callback(null, result.rows))
      .catch(err => callback(err))
  },
  get: (sql, values, callback) => {
    pool.query(sql, values)
      .then(result => callback(null, result.rows[0]))
      .catch(err => callback(err))
  }
}

module.exports = db
```

#### 3. Adicione ao .env:
```env
DB_USER=postgres
DB_PASSWORD=sua_senha
DB_HOST=localhost
DB_PORT=5432
DB_NAME=odonto_db
```

---

## 🔐 Segurança em Produção

### 1. HTTPS/SSL
```bash
# Gere certificados
openssl req -x509 -newkey rsa:4096 -nodes -out cert.pem -keyout key.pem -days 365

# Use no servidor
const https = require('https')
const fs = require('fs')

const options = {
  key: fs.readFileSync('key.pem'),
  cert: fs.readFileSync('cert.pem')
}

https.createServer(options, app).listen(3001)
```

### 2. Rate Limiting
```bash
npm install express-rate-limit
```

```javascript
const rateLimit = require('express-rate-limit')

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100 // 100 requisições
})

app.use('/api/', limiter)
```

### 3. Helmet para Headers de Segurança
```bash
npm install helmet
```

```javascript
const helmet = require('helmet')
app.use(helmet())
```

### 4. Validação com Joi
```bash
npm install joi
```

```javascript
const schema = Joi.object({
  email: Joi.string().email().required(),
  senha: Joi.string().min(6).required()
})

const { error, value } = schema.validate(req.body)
if (error) return res.status(400).json({ error: error.details })
```

---

## 🚀 Deploy na Nuvem

### Heroku

#### 1. Instale Heroku CLI
```bash
npm install -g heroku
heroku login
```

#### 2. Crie app
```bash
heroku create seu-app-odonto
```

#### 3. Configure variáveis
```bash
heroku config:set JWT_SECRET="sua_chave_segura"
heroku config:set NODE_ENV="production"
```

#### 4. Deploy
```bash
git push heroku main
```

#### 5. Ver logs
```bash
heroku logs --tail
```

### AWS EC2

#### 1. SSH no servidor
```bash
ssh -i key.pem ec2-user@seu-ip
```

#### 2. Instale Node
```bash
curl -fsSL https://rpm.nodesource.com/setup_16.x | sudo bash -
sudo yum install -y nodejs
```

#### 3. Clone repositório
```bash
git clone seu-repo
cd odonto-app
```

#### 4. Instale dependências
```bash
npm install
cd frontend && npm run build && cd ..
```

#### 5. Use PM2 para manter rodando
```bash
npm install -g pm2
pm2 start backend/server.js --name "odonto-backend"
pm2 start "npm run dev --prefix frontend" --name "odonto-frontend"
pm2 save
```

---

## 📊 Monitoramento

### PM2 Monitoramento
```bash
npm install -g pm2-monitoring

pm2 web  # Inicia web dashboard na porta 9615
```

### Logs e Erros

```javascript
// backend/utils/logger.js
const fs = require('fs')
const path = require('path')

const logDir = path.join(__dirname, '../logs')
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir)
}

const logError = (error) => {
  const log = `${new Date().toISOString()} - ${error}\n`
  fs.appendFileSync(path.join(logDir, 'errors.log'), log)
}

const logInfo = (info) => {
  const log = `${new Date().toISOString()} - ${info}\n`
  fs.appendFileSync(path.join(logDir, 'info.log'), log)
}

module.exports = { logError, logInfo }
```

---

## 💾 Backup Automático

```javascript
// backend/utils/backup.js
const { exec } = require('child_process')
const schedule = require('node-schedule')
const fs = require('fs')

// Exemplo para Postgres: use pg_dump (requer pg_dump disponível no ambiente)
// Você pode usar DATABASE_URL diretamente.

// Backup diário às 2AM
schedule.scheduleJob('0 2 * * *', () => {
  const timestamp = new Date().getTime()
  const backupPath = `./backups/database-${timestamp}.sql`
  
  exec(`pg_dump "${process.env.DATABASE_URL}" > "${backupPath}"`, (err) => {
    if (err) console.error('Erro no backup:', err)
    else console.log('Backup realizado:', backupPath)
  })
})

// Limpar backups com mais de 30 dias
schedule.scheduleJob('0 3 * * *', () => {
  const backupDir = './backups'
  const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000)
  
  fs.readdirSync(backupDir).forEach(file => {
    const filePath = `${backupDir}/${file}`
    const stats = fs.statSync(filePath)
    if (stats.birthtime < thirtyDaysAgo) {
      fs.unlinkSync(filePath)
    }
  })
})
```

---

## 🔌 Integração com Stripe

### Instalação
```bash
npm install stripe @stripe/react-stripe-js
```

### Backend
```javascript
// backend/routes/pagamentos.js
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)

router.post('/criar-intencao', async (req, res) => {
  try {
    const { valor, consulta_id } = req.body
    const intent = await stripe.paymentIntents.create({
      amount: Math.round(valor * 100),
      currency: 'brl',
      metadata: { consulta_id }
    })
    res.json({ clientSecret: intent.client_secret })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})
```

### Frontend
```jsx
// frontend/src/components/PagamentoStripe.jsx
import { Elements } from '@stripe/react-stripe-js'
import { loadStripe } from '@stripe/js'

const stripePromise = loadStripe(process.env.VITE_STRIPE_PUBLIC_KEY)

export default function PagamentoStripe({ consulta }) {
  return (
    <Elements stripe={stripePromise}>
      {/* Implementar CardElement */}
    </Elements>
  )
}
```

---

## 📧 Email com SendGrid

### Instalação
```bash
npm install @sendgrid/mail
```

### Uso
```javascript
const sgMail = require('@sendgrid/mail')
sgMail.setApiKey(process.env.SENDGRID_API_KEY)

const msg = {
  to: 'paciente@email.com',
  from: 'clinica@email.com',
  subject: 'Lembrete de Consulta',
  html: '<strong>Você tem consulta amanhã!</strong>',
}

await sgMail.send(msg)
```

---

## 📞 SMS com Twilio

### Instalação
```bash
npm install twilio
```

### Uso
```javascript
const twilio = require('twilio')
const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
)

await client.messages.create({
  body: 'Lembrete: você tem consulta amanhã!',
  from: process.env.TWILIO_PHONE_NUMBER,
  to: '+5511999999999'
})
```

---

## 🧪 Testes Automatizados

### Jest para Backend
```bash
npm install --save-dev jest supertest
```

```javascript
// backend/__tests__/auth.test.js
const request = require('supertest')
const app = require('../server')

describe('Autenticação', () => {
  test('Login com credenciais válidas', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@test.com', senha: 'senha123' })
    
    expect(response.status).toBe(200)
    expect(response.body).toHaveProperty('token')
  })
})
```

### Vitest para Frontend
```bash
npm install --save-dev vitest
```

---

## 🎨 Customização de Temas

### Variáveis CSS Globais
```css
/* frontend/src/theme.css */
:root {
  --primary: #667eea;
  --secondary: #34495e;
  --success: #27ae60;
  --danger: #e74c3c;
  --warning: #f39c12;
  --border-radius: 4px;
  --shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}
```

---

## 📱 Progressive Web App (PWA)

### Manifest
```json
// frontend/public/manifest.json
{
  "name": "Sistema Odontológico",
  "short_name": "Odonto",
  "start_url": "/",
  "display": "standalone",
  "theme_color": "#667eea",
  "background_color": "#ffffff",
  "icons": [...]
}
```

---

## 🎯 Performance

### Compressão Gzip
```javascript
const compression = require('compression')
app.use(compression())
```

### Caching
```javascript
app.use((req, res, next) => {
  if (req.method === 'GET') {
    res.set('Cache-Control', 'public, max-age=300')
  }
  next()
})
```

---

## 📈 Escalabilidade Futura

- [ ] Redis para cache de sessões
- [ ] MessageQueue (RabbitMQ/Bull) para jobs
- [ ] Microserviços separados
- [ ] GraphQL no lugar de REST
- [ ] Kubernetes para orquestração
- [ ] Load Balancer (Nginx)

---

**Sistema profissional e escalável! 🚀**
