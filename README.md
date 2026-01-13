# 🦷 Sistema de Gerenciamento para Clínica Odontológica

Um sistema completo e profissional para gerenciar todos os aspectos de uma clínica odontológica, desenvolvido com tecnologias modernas.

## 📋 Funcionalidades

### ✅ Gestão de Estoque
- Controle total de produtos odontológicos
- Entrada e saída de materiais com rastreamento
- **Alertas automáticos** quando estoque atinge nível mínimo
- Cálculo automático de valores de estoque
- Histórico de movimentações

### 📊 Relatórios Inteligentes
- Geração automática de relatórios mensais
- Análise de uso de materiais
- Receita da clínica e análise financeira
- Agendamentos e performance
- **Exportação em PDF e Excel**

### 📅 Marcação de Consultas
- Agendamento intuitivo com calendar
- Visualização de horários disponíveis em tempo real
- Sistema de lembretes automáticos (preparado para SMS/Email)
- Múltiplos tipos de consultas (limpeza, tratamento, avaliação, etc)
- Histórico completo de pacientes

### 👥 Gestão de Pacientes
- Cadastro completo com dados pessoais
- Histórico de consultas
- Observações clínicas
- Fácil busca e filtros

### 🔐 Segurança e Controle de Acesso
- Autenticação com JWT
- 3 níveis de permissão (atuais no código):
  - **Admin**: Acesso total (inclui usuários, auditoria, configurações)
  - **Dentista**: Operação clínica (pacientes/agenda/relatórios e ações permitidas)
  - **Recepção**: Operação administrativa (agenda/pacientes e ações permitidas)

Obs.: o sistema normaliza `assistente` → `recepcao` por compatibilidade, mas o role persistido/uso real é `recepcao`.

### 💳 Integrações (Preparadas)
- Pronto para integração com Stripe/PayPal
- APIs para integração contábil
- Exportação de dados para ERP

---

## 🚀 Instalação e Configuração

### Pré-requisitos
- Node.js 16+
- npm ou yarn
- Git

### Instalação (monorepo)
O projeto usa workspaces. Você pode instalar tudo pela raiz:

```bash
npm install
```

### 1. Backend (Node.js + Express)

```bash
cd backend
npm install
npm run dev
```

O backend rodará em `http://localhost:3001`

### 2. Frontend (React + Vite)

```bash
cd frontend
npm install
npm run dev
```

O frontend estará disponível em `http://localhost:5173`

#### Configurar URL do backend (recomendado)
No frontend, a base da API é configurável via env:

- Variável: `VITE_API_URL` (inclua `/api`)
- Exemplo: `VITE_API_URL=http://localhost:3001/api`

Veja o modelo em `frontend/.env.example`.

### 3. Electron (Aplicação Desktop)

```bash
cd electron
npm install
npm start
```

---

## 📁 Estrutura do Projeto

```
odonto-app/
├── backend/                    # API REST Node.js
│   ├── config/                 # Configurações (banco de dados, etc)
│   ├── routes/                 # Rotas API
│   ├── controllers/            # Lógica das rotas
│   ├── middleware/             # Autenticação, validação
│   └── server.js               # Servidor principal
│
├── frontend/                   # Interface React
│   ├── src/
│   │   ├── pages/              # Páginas (Dashboard, Pacientes, etc)
│   │   ├── components/         # Componentes reutilizáveis
│   │   ├── services/           # Chamadas à API
│   │   ├── context/            # Contexto de autenticação
│   │   └── App.jsx             # App principal com rotas
│   └── package.json
│
└── electron/                   # Aplicação Desktop
    ├── main.js                 # Processo principal
    └── preload.js              # Preload script
```

---

## 🔌 APIs Disponíveis

### Autenticação
```
POST   /api/auth/register        Registrar novo usuário
POST   /api/auth/login           Login e obter JWT
POST   /api/auth/forgot-password Recuperação de senha
POST   /api/auth/reset-password  Redefinir senha
```

### Estoque
```
GET    /api/estoque              Listar produtos
POST   /api/estoque              Criar novo produto
POST   /api/estoque/:id/movimentar  Entrada/Saída de produtos
GET    /api/estoque/alertas/reposicao  Alertas de reposição
```

### Pacientes
```
GET    /api/pacientes            Listar pacientes
POST   /api/pacientes            Criar paciente
PUT    /api/pacientes/:id        Atualizar paciente
GET    /api/pacientes/:id        Buscar paciente
```

### Consultas
```
GET    /api/consultas            Listar consultas
POST   /api/consultas            Agendar consulta
PUT    /api/consultas/:id/status Atualizar status
GET    /api/consultas/disponibilidade/:data  Horários disponíveis
```

### Relatórios
```
GET    /api/relatorios/estoque   Relatório de estoque
GET    /api/relatorios/receita   Relatório financeiro
GET    /api/relatorios/agendamentos  Relatório de agendamentos
POST   /api/relatorios/exportar-pdf   Exportar em PDF
POST   /api/relatorios/exportar-excel Exportar em Excel
```

---

## 🔐 Autenticação

Todas as rotas (exceto login/register) requerem o header:

```
Authorization: Bearer <seu_token_jwt>
```

O token é obtido no login e salvo localmente no navegador.

---

## 🎯 Exemplo de Uso

### 1. Registrar um novo usuário
```bash
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "nome": "Dr. Marcos",
    "email": "marcos@clinica.com",
    "senha": "senha123",
    "role": "dentista"
  }'
```

Nota importante sobre registro:
- Se não existir nenhum usuário no banco, o primeiro registro vira `admin` automaticamente.
- Depois disso, por segurança, o endpoint de registro passa a exigir um `admin` autenticado (via `Authorization: Bearer <token>`).

### 2. Fazer login
```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "marcos@clinica.com",
    "senha": "senha123"
  }'
```

### 3. Criar um paciente
```bash
curl -X POST http://localhost:3001/api/pacientes \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "nome": "João Silva",
    "email": "joao@email.com",
    "telefone": "(11) 99999-9999",
    "cpf": "123.456.789-00"
  }'
```

---

## 📊 Dashboard

O dashboard mostra:
- 📈 Receita mensal (últimos 30 dias)
- 📅 Consultas agendadas para hoje
- ⚠️ Produtos com estoque baixo
- 👥 Total de pacientes cadastrados
- 🔔 Alertas em tempo real

---

## 🎨 Tecnologias Utilizadas

### Backend
- **Express.js** - Framework web
- **SQLite3** - Banco de dados (fácil deploy)
- **JWT** - Autenticação segura
- **bcryptjs** - Criptografia de senhas
- **PDFKit** - Geração de PDFs
- **ExcelJS** - Geração de planilhas Excel
- **Nodemailer** - Envio de emails (para lembretes)

### Frontend
- **React 19** - Interface de usuário
- **Vite** - Bundler rápido
- **React Router** - Navegação
- **CSS Modules** - Estilos modularizados

### Desktop
- **Electron** - Aplicação desktop multiplataforma

---

## 🔄 Fluxo de Trabalho Típico

### Para um Administrador:
1. Login → 2. Dashboard → 3. Gerenciar Estoque → 4. Gerar Relatórios → 5. Exportar PDFs

### Para um Dentista:
1. Login → 2. Ver Agenda → 3. Registrar Pacientes → 4. Consultar Estoque → 5. Visualizar Relatórios

### Para Recepção:
1. Login → 2. Ver Agenda → 3. Cadastrar/editar Pacientes → 4. Agendar consultas

Portal do paciente: não existe como role ativo no backend atual (fica como ideia/roadmap).

---

## 🚀 Próximas Melhorias

- [ ] Integração com Stripe para pagamentos online
- [ ] Envio de SMS via Twilio
- [ ] Envio de Email automático com Sendgrid
- [ ] Backup automático do banco de dados
- [ ] App mobile (React Native)
- [ ] Dark Mode
- [ ] Notificações em tempo real com WebSocket
- [ ] Integração com Google Calendar

---

## 📝 Licença

Este projeto é de código aberto e pode ser usado livremente.

---

## 💬 Suporte

Para dúvidas ou problemas, entre em contato.

---

**Desenvolvido com ❤️ para clínicas odontológicas**
