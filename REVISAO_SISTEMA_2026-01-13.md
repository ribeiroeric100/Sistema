# Revisão do Sistema Odontológico (Jan/2026)

Data da revisão: **2026-01-13**

## Escopo e premissas
Esta revisão foi feita por leitura do repositório (docs + backend + frontend + Electron), com foco em:
- arquitetura e clareza de fluxos
- segurança (JWT, CORS, armazenamento de token, reset de senha)
- consistência de dados (agenda, receita, estoque)
- qualidade técnica (validações, erros, DX)

> Não executei o sistema aqui nem rodei testes automatizados (não há suíte de testes no repo). Os pontos abaixo são inferidos pela leitura do código.

---

## Visão geral (o que o sistema é hoje)
- Monorepo com workspaces: **backend (Express + Postgres)**, **frontend (React + Vite)**, **electron**.
- Autenticação via **JWT** e controle de acesso por **roles** (`admin`, `dentista`, `recepcao`).
- Banco em Postgres (configurado via `DATABASE_URL`).
- Funcionalidades chave: pacientes, agenda/consultas, atendimentos (status/pagamento), estoque/movimentações, relatórios + exportação PDF/Excel, auditoria.

Arquivos-base importantes:
- Backend entry: `backend/server.js`
- Banco + schema: `backend/config/database.js`
- Auth + roles: `backend/middleware/auth.js` e `backend/routes/auth.js`
- Cliente HTTP frontend: `frontend/src/services/api.js`
- Auth state frontend: `frontend/src/context/AuthContext.jsx`
- Electron shell: `electron/main.js`

---

## Pontos fortes (bem resolvidos)

### 1) Estrutura e DX
- Workspaces + scripts na raiz (`npm run dev:web`, `npm run dev:all`) facilitam rodar tudo.
- Documentação está bem completa (README/QUICKSTART/TESTING/API_REFERENCE etc.).

### 2) Autenticação e reset de senha (melhor do que o “mínimo”)
- Rate limiting em endpoints sensíveis (login/registro/forgot/reset) (`backend/middleware/rateLimit.js`).
- Fluxo de “forgot password” evita enumeração de usuário (sempre retorna 200 com mensagem genérica) (`backend/routes/auth.js`).
- Token de reset é armazenado **com hash (HMAC)** no banco (`password_resets.token_hash`) — bom para reduzir impacto de vazamento do DB.

### 3) Auditoria
- Existe trilha de auditoria com índices (`audit_logs`) e um service que “não quebra request” (`backend/services/audit.js`).

### 4) Conflito de agenda
- No agendamento de consulta, há checagem de conflito de horário (mesmo `data_hora`) com filtro por dentista quando aplicável (`backend/routes/consultas.js`).

---

## Principais riscos e problemas (prioridade P0)

### P0.1) Segredos fracos por fallback (JWT)
No backend, se `JWT_SECRET` não estiver configurado, o sistema usa fallback `'seu_jwt_secret'` (`backend/middleware/auth.js` e `backend/routes/auth.js`).

Impacto:
- Se alguém rodar isso em produção sem configurar env, qualquer atacante pode forjar tokens.

Recomendação:
- **Falhar o boot em produção** se `JWT_SECRET` não existir.
- Ter `.env.example` no backend e checklist de deploy exigindo o secret.

### P0.2) CORS permissivo por padrão
O CORS libera tudo quando `CORS_ORIGIN` não está setado (`backend/server.js`).

Impacto:
- Em produção, isso facilita abuso via browsers de qualquer origem (especialmente se o token estiver em localStorage).

Recomendação:
- Em produção, exigir `CORS_ORIGIN` e negar quando vazio.

### P0.3) Bug real em atualização de receita diária (`daily_receitas`)
Em `backend/routes/consultas.js`, no update de status (quando `pago` muda de 0→1), a query tem **2 placeholders**, mas o bind passa **3 valores**:
- SQL: `INSERT INTO daily_receitas (dia, total) VALUES (?, ?) ON CONFLICT(dia) DO UPDATE ...`
- Params: `[dia, valorConsulta, valorConsulta]`

Impacto:
- Pode gerar erro `SQLITE_RANGE` e **não atualizar receita diária**, deixando dashboard/relatórios inconsistentes.

Recomendação:
- Corrigir para `[dia, valorConsulta]`.
- Ideal: envolver update de status + update de receita + movimentação de estoque em **transação** (hoje é “melhor esforço”).

### P0.4) Inconsistência do campo `tipo` nas movimentações (saida vs saída)
Em `backend/routes/estoque.js`, o comentário diz “saída”, mas:
- No relatório de estoque (`backend/routes/relatorios.js`) soma por `tipo = 'saida'` (sem acento).
- No update de consulta realizada (`backend/routes/consultas.js`) grava `tipo = 'saida'`.
- No endpoint `/movimentar`, o backend grava exatamente o `tipo` recebido do cliente.

Impacto:
- Se algum cliente mandar `"saída"` (com acento) ou outra variação, relatórios ficam errados.

Recomendação:
- Normalizar e validar `tipo` no backend: aceitar somente `entrada|saida`.

### P0.5) Tokens em `localStorage` (risco XSS)
O frontend guarda `token` e `user` no `localStorage` (`frontend/src/context/AuthContext.jsx` e `frontend/src/services/api.js`).

Impacto:
- Se houver XSS em qualquer parte do app, o atacante rouba token facilmente.

Recomendação (web/SaaS):
- Preferir cookies `HttpOnly` + `SameSite` + sessão.
- Se manter JWT no client: endurecer CSP + sanitização + revisão de pontos de entrada de HTML, e considerar expiração curta + refresh token.

---

## Melhorias importantes (P1)

### P1.1) Validação consistente de payloads
Hoje há Zod em auth e parte de consultas, mas vários endpoints aceitam payload “livre” (ex.: pacientes/estoque/usuarios update).

Recomendação:
- Padronizar `validateBody(zodSchema)` em todas rotas mutáveis.
- Padronizar tipos (ex.: `valor` sempre number, `data_hora` com regex/ISO).

### P1.2) Consistência: soft-delete vs delete
- Paciente é deletado com `DELETE FROM pacientes` (`backend/routes/pacientes.js`), enquanto produtos usam soft-delete (`ativo = 0`).

Recomendação:
- Trocar paciente para soft-delete e preservar integridade com consultas/auditoria.

### P1.3) Robustez transacional (estoque e receita)
Algumas atualizações críticas são feitas em várias operações separadas (ex.: consulta realizada → decrementa estoque e grava movimentações; pago → atualiza daily_receitas).

Recomendação:
- Encapsular operações relacionadas em `BEGIN TRANSACTION`/`COMMIT`/`ROLLBACK`.
- Validar que estoque não fique negativo.

### P1.4) Tratamento de erro no client `api()`
Em `frontend/src/services/api.js`, quando `response.ok` é falso, assume sempre JSON:
```js
const error = await response.json()
```
Se o backend retornar texto/HTML, isso explode com erro de parsing e perde a mensagem real.

Recomendação:
- Fazer fallback para `response.text()` quando JSON falhar.
- Tratar `204 No Content`.
- Centralizar tratamento de `401` para fazer logout.

### P1.5) Hardening do Electron
Em `electron/main.js`, `BrowserWindow` não explicita opções de segurança.

Recomendação:
- Setar explicitamente `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`.
- Definir `Content-Security-Policy` no app empacotado.

---

## Melhorias desejáveis (P2)

### P2.1) Multi-tenancy / SaaS
Se o objetivo é SaaS, hoje não existe `clinic_id` nas tabelas; tudo é single-tenant.

Recomendação:
- Introduzir `clinic_id` em entidades principais + ACL por clínica.
- Migrar SQLite → Postgres (ou ao menos oferecer) para concorrência e observabilidade.

### P2.2) Observabilidade
- Logs estruturados, correlação de request (`requestId`), e monitoramento de erros.

### P2.3) Testes automatizados mínimos
- Supertest no backend para auth/roles.
- Teste de regressão para o bug de `daily_receitas`.

---

## Checklist acionável (sugestão)

### P0 (fazer primeiro)
- [ ] Exigir `JWT_SECRET` em produção (sem fallback).
- [ ] Trancar CORS em produção (obrigar `CORS_ORIGIN`).
- [ ] Corrigir bind errado do `daily_receitas` na atualização de status.
- [ ] Normalizar `tipo` de movimentação para `entrada|saida`.

### P1 (próxima iteração)
- [ ] Zod em todos endpoints mutáveis.
- [ ] Transações para updates críticos (estoque/receita/status).
- [ ] Melhorar `api()` do frontend (erro/401/204).
- [ ] Hardening do Electron.

---

## Perguntas para direcionar a próxima revisão
1) O alvo é **apenas desktop/local** (Electron + SQLite) ou **SaaS multi-clínica**?
2) Vocês precisam de conformidade/LGPD (ex.: logs de acesso, exportação/retensão, backups, criptografia)?
3) O fluxo de token pode migrar para cookie HttpOnly no modo web?

Se você quiser, eu posso:
- aplicar correções P0 diretamente no código, ou
- abrir uma PR “hardening + validações” com mudanças pequenas e seguras.
