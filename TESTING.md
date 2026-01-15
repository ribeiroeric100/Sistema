# 🧪 Guia de Testes e Uso Prático

## Como Testar o Sistema

### Pré-requisito: Instalar Dependências

Execute uma vez:

```bash
npm install  # Na raiz do projeto
```

Ou execute os scripts de instalação:
- **Windows**: `install.bat`
- **macOS/Linux**: `bash install.sh`

---

## 1️⃣ Iniciar os Servidores

Abra **3 terminais** diferentes:

### Terminal 1: Backend (API)
```bash
cd backend
npm run dev
```
Aguarde: `✅ Conectado ao SQLite` e `🦷 Servidor odontológico rodando na porta 3001`

### Terminal 2: Frontend (Interface Web)
```bash
cd frontend
npm run dev
```
Aguarde: `VITE v7.2.4 ready in xxx ms`

### Terminal 3: Electron (App Desktop)
```bash
cd electron
npm start
```
A janela do Electron deve abrir automaticamente.

---

## 2️⃣ Primeiro Acesso

### Registrar um Novo Usuário

Na página de login, clique em "Registrar-se" ou use cURL:

```bash
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "nome": "Dr. Marcos Silva",
    "email": "marcos@clinica.com",
    "senha": "senha123",
    "role": "dentista"
  }'
```

**Resposta esperada:**
```json
{
  "id": "uuid-aqui",
  "nome": "Dr. Marcos Silva",
  "email": "marcos@clinica.com",
  "role": "dentista"
}
```

### Fazer Login

```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "marcos@clinica.com",
    "senha": "senha123"
  }'
```

**Resposta esperada:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "uuid-aqui",
    "nome": "Dr. Marcos Silva",
    "email": "marcos@clinica.com",
    "role": "dentista"
  }
}
```

---

## 3️⃣ Testando Funcionalidades

### ✅ Gestão de Estoque

#### Criar um Produto

```bash
TOKEN="seu_token_aqui"

curl -X POST http://localhost:3001/api/estoque \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "nome": "Luva de Procedimento",
    "categoria": "EPP",
    "quantidade": 100,
    "quantidade_minima": 20,
    "preco_unitario": 2.50,
    "fornecedor": "Fornecedor XYZ"
  }'
```

#### Registrar Entrada de Estoque

```bash
curl -X POST http://localhost:3001/api/estoque/{produto_id}/movimentar \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "quantidade": 50,
    "tipo": "entrada",
    "motivo": "Compra ao fornecedor"
  }'
```

#### Registrar Saída de Estoque

```bash
curl -X POST http://localhost:3001/api/estoque/{produto_id}/movimentar \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "quantidade": 10,
    "tipo": "saida",
    "motivo": "Uso em procedimento"
  }'
```

#### Ver Alertas de Reposição

```bash
curl -X GET http://localhost:3001/api/estoque/alertas/reposicao \
  -H "Authorization: Bearer $TOKEN"
```

---

### 👥 Gestão de Pacientes

#### Criar um Paciente

```bash
curl -X POST http://localhost:3001/api/pacientes \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "nome": "João Silva",
    "email": "joao@email.com",
    "telefone": "(11) 99999-9999",
    "cpf": "123.456.789-00",
    "data_nascimento": "1990-05-15",
    "endereco": "Rua das Flores",
    "numero": "123",
    "bairro": "Centro",
    "cidade": "São Paulo",
    "cep": "01310-100",
    "observacoes": "Paciente com histórico de sensibilidade dental"
  }'
```

#### Listar Pacientes

```bash
curl -X GET http://localhost:3001/api/pacientes \
  -H "Authorization: Bearer $TOKEN"
```

---

### 📅 Gestão de Consultas

#### Verificar Horários Disponíveis

```bash
curl -X GET "http://localhost:3001/api/consultas/disponibilidade/2024-12-28" \
  -H "Authorization: Bearer $TOKEN"
```

**Resposta esperada:**
```json
{
  "data": "2024-12-28",
  "horarios_disponiveis": ["08:00", "08:30", "09:00", "09:30", "10:00", ...]
}
```

#### Agendar uma Consulta

```bash
curl -X POST http://localhost:3001/api/consultas \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "paciente_id": "uuid-do-paciente",
    "dentista_id": "uuid-do-dentista",
    "data_hora": "2024-12-28 10:00",
    "tipo_consulta": "limpeza",
    "descricao": "Limpeza e avaliação",
    "valor": 150.00
  }'
```

#### Marcar Consulta como Realizada

```bash
curl -X PUT http://localhost:3001/api/consultas/{consulta_id}/status \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "status": "realizada",
    "pago": true
  }'
```

---

### 📊 Gerar Relatórios

#### Relatório de Estoque

```bash
curl -X GET http://localhost:3001/api/relatorios/estoque \
  -H "Authorization: Bearer $TOKEN"
```

#### Relatório de Receita (com período)

```bash
curl -X GET "http://localhost:3001/api/relatorios/receita?data_inicio=2024-12-01&data_fim=2024-12-31" \
  -H "Authorization: Bearer $TOKEN"
```

#### Relatório de Agendamentos

```bash
curl -X GET http://localhost:3001/api/relatorios/agendamentos \
  -H "Authorization: Bearer $TOKEN"
```

#### Exportar Relatório em PDF

```bash
curl -X POST http://localhost:3001/api/relatorios/exportar-pdf \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "tipo": "estoque",
    "dados": { "total_produtos": 45, "valor_total": 5000.00 }
  }' \
  --output relatorio.pdf
```

---

## 4️⃣ Testar no Frontend

### Acessar a Interface Web

1. Abra o navegador em `http://localhost:5173`
2. Registre uma nova conta ou use uma existente
3. Faça login
4. Explore as páginas:
   - **Dashboard**: Resumo geral
   - **Pacientes**: CRUD de pacientes
   - **Estoque**: Gestão de produtos
   - **Agenda**: Agendar consultas
   - **Atendimentos**: Registrar atendimentos realizados
   - **Relatórios**: Gerar e exportar relatórios

---

## 5️⃣ Testar no Electron

A aplicação Electron rodará a interface React em uma janela desktop.

1. O Electron abrirá automaticamente
2. A janela mostra a interface web em `http://localhost:5173`
3. Você pode usar todos os recursos como no navegador
4. Os dados são salvos no banco Postgres

---

## ⚠️ Solução de Problemas

### Erro: "EADDRINUSE :::3001"
Porta 3001 já está em uso. Mude a porta no `.env`:
```
PORT=3002
```

### Erro de conexão com o banco
- Verifique se `DATABASE_URL` está configurado em `backend/.env`
- Rode migrations: `npm run migrate:up --workspace=backend`

### Frontend não conecta ao Backend
1. Verifique se o backend está rodando na porta 3001
2. Verifique o arquivo `frontend/src/services/api.js`
3. Certifique-se que `API_URL = 'http://localhost:3001/api'` está correto

### Electron abre página em branco
Aguarde 5-10 segundos para o Vite compilar o frontend.

---

## 📈 Próximos Passos

1. **Integração de Pagamentos**: Adicione Stripe ou PayPal
2. **Notificações**: Implemente WebSocket para notificações em tempo real
3. **Backup**: Configure backup automático do banco de dados
4. **Mobile**: Desenvolva app mobile com React Native
5. **Relatórios Avançados**: Adicione gráficos com Chart.js

---

## 🔒 Segurança em Produção

Antes de usar em produção:

1. Mude `JWT_SECRET` para uma chave segura no `.env`
2. Use HTTPS em vez de HTTP
3. Configure CORS corretamente
4. Use PostgreSQL em vez de SQLite
5. Adicione rate limiting nas APIs
6. Implemente logs e monitoramento
7. Faça backup regular do banco

---

**Bom teste! 🦷✨**
