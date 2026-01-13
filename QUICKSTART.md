# ⚡ Guia Rápido de Início

## 5 Minutos para Rodar o Sistema

### 1️⃣ Clone/Abra o Projeto
```bash
cd c:\Users\derek\Desktop\odonto-app
```

### 2️⃣ Instale Dependências (Execute APENAS UMA VEZ)

**Windows:**
```bash
install.bat
```

**macOS/Linux:**
```bash
bash install.sh
```

Ou manualmente:
```bash
cd backend && npm install && cd ..
cd frontend && npm install && cd ..
cd electron && npm install && cd ..
```

Ou (recomendado) pela raiz usando workspaces:
```bash
npm install
```

### 3️⃣ Abra 3 Terminais

#### Terminal 1 - Backend
```bash
cd backend
npm run dev
```
Aguarde: `🦷 Servidor odontológico rodando na porta 3001`

#### Terminal 2 - Frontend
```bash
cd frontend
npm run dev
```
Aguarde: `VITE v7.2.4 ready in ...`

#### Terminal 3 - Electron
```bash
cd electron
npm start
```
A janela do Electron abrirá automaticamente.

---

## 🚀 Alternativa: rodar tudo com 1 comando

Na raiz do projeto:

- Backend + Frontend (web):
```bash
npm run dev:web
```

- Backend + Frontend + Electron:
```bash
npm run dev:all
```

Obs.: o Electron espera o Vite subir em uma das portas `5173-5176`.

## 🎯 Primeiro Login

### Criar Conta Admin

No navegador em `http://localhost:5173` ou no Electron:

1. Clique em "Registrar-se"
2. Preencha:
   - **Nome:** Dr. Marcos Silva
   - **Email:** marcos@clinica.com
   - **Senha:** senha123
   - **Tipo:** admin (escolha na página de registro)
3. Clique em "Registrar"
4. Faça login com essas credenciais

Nota: após existir pelo menos 1 usuário no sistema, o registro fica restrito e só um `admin` autenticado pode criar novos usuários (por segurança).

---

## 📱 Acessar o Sistema

### Via Navegador
```
http://localhost:5173
```

### Via Electron
A aplicação abrirá automaticamente mostrando a mesma interface.

---

## 🚀 Funcionalidades Principais

### Dashboard
- Resumo de receita mensal
- Consultas agendadas
- Produtos com estoque baixo
- Alertas em tempo real

### Pacientes
- Cadastrar novos pacientes
- Visualizar histórico
- Editar informações

### Estoque
- Listar produtos
- Registrar entrada/saída
- Alertas automáticos
- Cálculo de valor total

### Agenda
- Visualizar horários disponíveis
- Agendar consultas
- Gerenciar status

### Atendimentos
- Ver consultas agendadas
- Marcar como realizada
- Registrar pagamento

### Relatórios
- Estoque completo
- Receita por período
- Agendamentos
- Exportar PDF/Excel

---

## 🔐 Controle de Acesso

Existem 3 tipos de usuários (atuais no código):

| Tipo | Acesso |
|------|--------|
| **Admin** | Acesso total (usuários, auditoria, configurações, etc.) |
| **Dentista** | Operação clínica (conforme permissões das rotas) |
| **Recepção** | Operação administrativa (conforme permissões das rotas) |

Compatibilidade: `assistente` é normalizado para `recepcao`.

---

## 💾 Dados Salvos Automaticamente

- Banco de dados SQLite em `backend/database.db`
- Sincroniza em tempo real entre abas/janelas
- Todas as operações têm histórico

---

## 🐛 Problemas Comuns

### "Porta 3001 já está em uso"
```bash
# Mude para outra porta no arquivo backend/.env
PORT=3002
```

### Frontend não conecta ao backend
1. Verifique se backend está rodando (`npm run dev` no terminal)
2. Espere 10 segundos para compilação
3. Recarregue a página (F5)

### Electron abre página em branco
- Aguarde 10 segundos para Vite compilar
- Atualize com Ctrl+R

### "Database locked"
- Feche outros programas usando o banco
- Reinicie o backend

---

## 📚 Documentação Completa

- **README.md** - Visão geral do projeto
- **TESTING.md** - Guia de testes e exemplos cURL
- **API_REFERENCE.md** - Documentação detalhada das APIs
- **backend/README.md** - Documentação do backend

---

## 🎨 Estrutura de Pastas

```
odonto-app/
├── backend/           # API Node.js + Express
├── frontend/          # Interface React + Vite
├── electron/          # Aplicação desktop
├── README.md          # Documentação principal
├── TESTING.md         # Guia de testes
├── API_REFERENCE.md   # Referência de APIs
└── install.bat/sh     # Script de instalação
```

---

## ✨ Próximas Melhorias

- [ ] Integração Stripe para pagamentos
- [ ] SMS/Email automáticos
- [ ] Backup na nuvem
- [ ] App Mobile (React Native)
- [ ] Dark mode
- [ ] Gráficos e analytics
- [ ] Notificações WebSocket

---

## 🆘 Precisa de Ajuda?

1. Leia **TESTING.md** para exemplos práticos
2. Consulte **API_REFERENCE.md** para detalhes técnicos
3. Verifique logs do backend (Terminal 1)
4. Abra o DevTools do Electron (F12) para erros frontend

---

## 🎉 Parabéns!

Você tem agora um sistema profissional de gerenciamento odontológico em 5 minutos!

**Bom uso! 🦷✨**
