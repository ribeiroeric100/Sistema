# Deploy completo (SaaS) — Odonto App (Frontend/Backend separados)

Este guia transforma o sistema em um SaaS pronto para produção, com **deploy separado** de:
- **Frontend (React SPA)**
- **Backend (Node.js API REST)**
- **Banco de dados (PostgreSQL ou MySQL gerenciado)**

> Observação importante do seu repositório: o backend atual usa **SQLite** (arquivo local) em `backend/config/database.js`. Para um SaaS comercial e escalável, o recomendado é migrar para **PostgreSQL** (ou MySQL) gerenciado.

---

## 1) Arquitetura de deploy

### 1.1 Separação (padrão SaaS)

**Padrão recomendado (simples e robusto):**
- `app.seudominio.com` → **Frontend SPA** (CDN/static hosting)
- `api.seudominio.com` → **Backend API** (container/Node) atrás de proxy/LB
- Banco gerenciado (RDS/Cloud SQL/Supabase/Neon/PlanetScale etc) em rede privada/controle por firewall

**Fluxo:**
1. Browser carrega SPA do CDN.
2. SPA chama API via `https://api.seudominio.com/api/...`.
3. API autentica via JWT, acessa banco gerenciado.

### 1.2 HTTPS e comunicação segura
- HTTPS obrigatório no frontend e backend.
- Use HSTS no domínio (via CDN/proxy).
- CORS estrito: permitir somente origens do(s) front(s) autorizados.

### 1.3 Padrão de arquitetura SaaS (multi-tenant)
Você tem 3 estratégias típicas:

1) **Single DB + `tenant_id` por tabela (recomendado para início)**
- Cada registro tem `tenant_id`.
- Todas as queries filtram `tenant_id`.
- Pode evoluir para RLS (Row Level Security) no Postgres.

2) **Schema por tenant**
- Um schema Postgres por clínica.
- Isolamento melhor, migrações mais complexas.

3) **DB por tenant**
- Isolamento máximo; custo e operação maiores.

Para clínicas odontológicas (PME), o padrão 1 é o melhor trade-off inicial.

---

## 2) Backend — Deploy (Node.js)

### 2.1 Scripts de produção
No seu backend, o script de produção já existe:
- `npm run start --workspace=backend`

Recomendação:
- Em produção, rode com `NODE_ENV=production`.
- Use `npm ci` no pipeline (instalação determinística).

Exemplo (host genérico):
```bash
npm ci --workspace=backend
NODE_ENV=production PORT=3001 npm run start --workspace=backend
```

### 2.2 Variáveis de ambiente (.env)
Use variáveis por ambiente e **não comite** `.env` real.
- Exemplo: `backend/.env.example`

Obrigatórias em produção:
- `NODE_ENV=production`
- `JWT_SECRET` (forte)
- `CORS_ORIGIN` (lista de origens permitidas)
- `APP_URL` (para link de reset de senha)

Gerar segredo forte:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 2.3 CORS (produção)
O backend já suporta `CORS_ORIGIN` como lista separada por vírgula.
- Em produção, configure algo como:
  - `CORS_ORIGIN=https://app.seudominio.com`

Boas práticas:
- Não usar `*` com Authorization.
- Permitir somente domínios que você controla.

### 2.4 JWT e segurança
Pontos críticos para SaaS:
- `JWT_SECRET` não pode ter fallback em produção.
- JWT com expiração (ok: `24h` hoje). Para SaaS, considere:
  - Access token curto (ex.: 15m)
  - Refresh token (mais complexo) se precisar.

### 2.5 Proxy/LB e IP real
Em produção você quase sempre fica atrás de proxy/LB. Por isso:
- Configure `trust proxy` no Express.
- Isso melhora logs, auditoria e rate-limit por IP.

### 2.6 Banco remoto
Hoje o projeto usa SQLite local. Em produção SaaS, use Postgres/MySQL gerenciado:
- Postgres: Supabase / Neon / AWS RDS / GCP Cloud SQL
- MySQL: PlanetScale / AWS RDS / Cloud SQL

**Recomendação prática:** Postgres.

### 2.7 Migrations
O backend atual cria tabelas no startup (DDL) e faz “migrações leves” com `ALTER TABLE`.
Para SaaS comercial, migrações versionadas são essenciais.

Opções comuns:
- **Prisma**: `prisma migrate dev` / `prisma migrate deploy`
- **Knex**: `knex migrate:latest`
- **Sequelize**: `sequelize-cli db:migrate`

Estratégia recomendada:
1. Introduzir ORM/migrator
2. Codificar schema versionado
3. Rodar `migrate deploy` no pipeline antes de subir o app

### 2.8 API pública e segura
Checklist de segurança para API:
- Validar input (vocês já usam Zod em auth).
- Rate-limit em endpoints sensíveis (já existe para auth).
- Headers de segurança (Helmet).
- Logs estruturados e sem dados sensíveis.
- Proteção contra enumeração (vocês já retornam 200 no forgot-password).

---

## 3) Frontend — Deploy (React SPA)

### 3.1 Build de produção
Com Vite:
```bash
npm ci --workspace=frontend
npm run build --workspace=frontend
```
Saída: `frontend/dist/`.

### 3.2 Variáveis de ambiente
O frontend usa `VITE_API_URL` (ver `frontend/.env.example`).
Em produção:
- `VITE_API_URL=https://api.seudominio.com/api`

Importante:
- Variáveis do Vite são “build-time”: se mudar a URL da API, precisa rebuild.

### 3.3 Hospedagem estática (CDN)
Boas opções (fáceis):
- Cloudflare Pages
- Vercel
- Netlify

Regras essenciais:
- SPA fallback: qualquer rota deve servir `index.html`.
- Cache agressivo para assets versionados (hash no filename), cache moderado/zero para `index.html`.

### 3.4 Cache e performance
- CDN na frente do frontend.
- `Cache-Control`:
  - `index.html`: `no-cache` ou cache curto
  - `/assets/*`: cache longo (`max-age=31536000, immutable`)
- Gzip/Brotli habilitado no host.

### 3.5 Comunicação segura com o backend
- Sempre HTTPS.
- Evitar mixed content.
- Se usar subdomínios (`app` e `api`), isso ajuda a isolar cookies (se existirem) e políticas.

---

## 4) Banco de dados (cloud)

### 4.1 Criação
Escolha um provedor gerenciado e crie o DB:
- Postgres recomendado.

Configuração mínima:
- Usuário de aplicação com permissões mínimas.
- `sslmode=require` (ou equivalente).

### 4.2 Backups automáticos
Ative:
- Backups diários
- Retenção (ex.: 7/14/30 dias)
- PITR (Point-in-time recovery) se disponível

### 4.3 Segurança de acesso
- **IP allowlist**: liberar apenas IPs do backend (ou usar VPC/private networking).
- Senha forte + rotação.
- TLS obrigatório.

### 4.4 Migrações de schema
Em produção:
- Migração deve rodar **antes** de subir nova versão.
- Migrações devem ser **idempotentes** e versionadas.

---

## 5) Domínio e HTTPS

### 5.1 DNS (padrão recomendado)
- `app.seudominio.com` → frontend (CNAME para seu host)
- `api.seudominio.com` → backend (A/CNAME conforme provedor)

### 5.2 Certificado SSL
- Em PaaS/CDN (Vercel/Netlify/Render/Cloudflare) o SSL é automático.
- Em VPS/VM, use Caddy ou Nginx + Let’s Encrypt.

### 5.3 HTTPS obrigatório
- Redirecionar HTTP → HTTPS.
- HSTS (no proxy/CDN) para bloquear downgrade.

---

## 6) Ambientes (Development / Production)

### 6.1 Separação real
- **Development**: localhost, SQLite ok, logs verbosos.
- **Production**: domínio real, Postgres/MySQL gerenciado, secrets no secret manager.

### 6.2 Estratégia de variáveis
Recomendação:
- `backend/.env` local (não commitado)
- Secrets no provedor (Render/Vercel/Cloud Run/Secrets Manager)
- `frontend` recebe `VITE_API_URL` no build do provedor

---

## 7) Escalabilidade

### 7.1 Preparar para múltiplos usuários
- Backend **stateless** (JWT ajuda).
- Banco gerenciado com conexões/pool.

### 7.2 Escala horizontal
- Rodar múltiplas instâncias do backend atrás de LB.
- Para isso, SQLite não serve (arquivo local por instância). Migre para Postgres/MySQL.

### 7.3 Boas práticas para crescer
- Separar uploads/arquivos (se houver) para object storage.
- Observabilidade desde cedo.
- Limites: payload size, rate limits, timeouts.

---

## 8) Monitoramento e logs

### 8.1 Logs de aplicação
- Centralizar logs no provedor (Render/Fly/CloudWatch/Stackdriver).
- Evitar logar: senha, tokens, dados sensíveis de pacientes.

### 8.2 Logs de erro
- Sentry (frontend e backend) é o caminho mais rápido.

### 8.3 Disponibilidade
- UptimeRobot / Better Stack / Pingdom para health check em `GET /api/health`.

### 8.4 Alertas
- Alertar por: 5xx, latência alta, DB down, deploy falho.

---

## 9) Segurança em produção (LGPD)

### 9.1 Proteção contra ataques comuns
- TLS + HSTS.
- Helmet + headers.
- Rate limit (já existe em auth; avalie global por IP/rota).
- Validação de input (expandir para rotas principais).

### 9.2 Proteção de rotas sensíveis
- JWT + RBAC (vocês já têm `verifyRole`).
- Auditoria (vocês já registram ações relevantes em `audit_logs`).

### 9.3 Dados sensíveis (LGPD)
- Criptografia em repouso (banco gerenciado geralmente oferece).
- Criptografia em trânsito (TLS DB + HTTPS).
- Controle de acesso por papel (admin/dentista/recepcao).
- Registro de acesso/alterações (auditoria).
- Política de retenção/backup.

---

## 10) Checklist final de produção

### Antes do deploy
- Definir domínios: `app.*` e `api.*`.
- Definir provedor do backend e do frontend.
- Criar banco Postgres/MySQL gerenciado.
- Criar secrets no provedor:
  - `JWT_SECRET`, `RESET_TOKEN_SECRET`, `CORS_ORIGIN`, `APP_URL`, `DATABASE_URL` (quando migrar)
- Revisar CORS (somente domínio do app).
- Definir política de backup e retenção.

### Durante o deploy
- Backend:
  - Subir API e validar `GET /api/health`.
  - Conferir logs e variáveis.
- Frontend:
  - Configurar `VITE_API_URL`.
  - Garantir SPA fallback.
- DNS/HTTPS:
  - Validar SSL e redirecionamento.

### Pós-deploy (validação)
- Login/logout.
- Criação de usuários (apenas admin após bootstrap).
- Cadastro e busca de pacientes.
- Agenda/consultas.
- Exportações (PDF/Excel) e CORS.
- Auditoria registrando ações.
- Monitoramento/alertas ativos.

---

## Sugestão de caminho “mais rápido” para colocar em produção

Se você quer ir para produção com pouco esforço operacional:
1) Frontend no Cloudflare Pages/Vercel
2) Backend no Render/Fly.io
3) Banco Postgres no Supabase/Neon
4) Domínios em Cloudflare
5) Sentry + UptimeRobot

Quando quiser, eu posso:
- Propor um plano de migração de SQLite → Postgres (Prisma/Knex) baseado nas tabelas atuais.
- Criar um pipeline CI/CD (GitHub Actions) para build/deploy separado de frontend e backend.
