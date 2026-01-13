# 🚀 Documentação Avançada - APIs e Integrações

## 📡 API REST - Endpoints Completos

### Base URL
```
http://localhost:3001/api
```

### Headers Obrigatórios
```
Authorization: Bearer <token>
Content-Type: application/json
```

---

## 🔐 Autenticação

### POST `/auth/register`
Criar nova conta de usuário.

**Request:**
```json
{
  "nome": "Dr. João",
  "email": "joao@clinica.com",
  "senha": "senha_segura_123",
  "role": "dentista"
}
```

**Roles Disponíveis:**
- `admin` - Acesso total
- `dentista` - Gerenciamento completo
- `recepcao` - Operações administrativas

Compatibilidade: o backend normaliza `assistente` → `recepcao`.

**Regra de segurança do registro (importante):**
- Se não existir nenhum usuário no banco, o primeiro registro vira `admin` automaticamente.
- Depois disso, o endpoint passa a exigir um `admin` autenticado (via `Authorization: Bearer <token>`) para criar novos usuários.

**Response (201):**
```json
{
  "id": "uuid-1234",
  "nome": "Dr. João",
  "email": "joao@clinica.com",
  "role": "dentista"
}
```

---

### POST `/auth/login`
Fazer login e obter token JWT.

**Request:**
```json
{
  "email": "joao@clinica.com",
  "senha": "senha_segura_123"
}
```

**Response (200):**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "uuid-1234",
    "nome": "Dr. João",
    "email": "joao@clinica.com",
    "role": "dentista"
  }
}
```

**Token Expiration:** 24 horas

---

## 📦 Gestão de Estoque

### GET `/estoque`
Listar todos os produtos.

**Response:**
```json
[
  {
    "id": "uuid-5678",
    "nome": "Luva de Procedimento",
    "categoria": "EPP",
    "quantidade": 150,
    "quantidade_minima": 20,
    "preco_unitario": 2.50,
    "fornecedor": "Fornecedor XYZ",
    "ativo": 1,
    "criado_em": "2024-12-28T10:00:00Z"
  }
]
```

---

### POST `/estoque`
Criar novo produto. ✅ Requer role: `admin`

**Request:**
```json
{
  "nome": "Resina Composta",
  "descricao": "Resina de alta durabilidade cor A2",
  "quantidade": 50,
  "quantidade_minima": 10,
  "unidade": "seringa",
  "preco_unitario": 45.00,
  "fornecedor": "Fornecedor ABC",
  "categoria": "Materiais de Restauração"
}
```

**Response (201):**
```json
{
  "id": "uuid-9101",
  "nome": "Resina Composta",
  "quantidade": 50,
  "quantidade_minima": 10
}
```

---

### POST `/estoque/{id}/movimentar`
Registrar entrada ou saída de estoque.

**Request:**
```json
{
  "quantidade": 20,
  "tipo": "entrada",
  "motivo": "Reposição do fornecedor ABC"
}
```

**Tipos permitidos:**
- `entrada` - Adicionar estoque
- `saida` - Remover estoque

**Response (200):**
```json
{
  "success": true,
  "movimentacao_id": "uuid-1122"
}
```

**Automático:**
- Se quantidade ≤ quantidade_minima → Cria alerta
- Registra histórico de movimentação
- Atualiza estoque em transação

---

### GET `/estoque/alertas/reposicao`
Listar alertas de produtos com estoque baixo.

**Response:**
```json
[
  {
    "id": "uuid-3344",
    "produto_id": "uuid-5678",
    "nome": "Luva de Procedimento",
    "quantidade": 15,
    "quantidade_minima": 20,
    "tipo": "reposicao",
    "mensagem": "Produto com estoque baixo: 15 un.",
    "lido": 0,
    "criado_em": "2024-12-28T14:30:00Z"
  }
]
```

---

## 👥 Gestão de Pacientes

### GET `/pacientes`
Listar todos os pacientes.

**Query Parameters (opcional):**
- `filtro=nome` - Buscar por nome
- `ativo=1` - Apenas ativos

**Response:**
```json
[
  {
    "id": "uuid-5555",
    "nome": "João Silva",
    "email": "joao@email.com",
    "telefone": "(11) 99999-9999",
    "cpf": "123.456.789-00",
    "data_nascimento": "1990-05-15",
    "endereco": "Rua das Flores",
    "numero": "123",
    "complemento": "Apto 42",
    "bairro": "Centro",
    "cidade": "São Paulo",
    "cep": "01310-100",
    "observacoes": "Sensibilidade dentária",
    "ativo": 1,
    "criado_em": "2024-12-20T09:00:00Z"
  }
]
```

---

### POST `/pacientes`
Criar novo paciente.

**Request:**
```json
{
  "nome": "Maria Santos",
  "email": "maria@email.com",
  "telefone": "(11) 98888-8888",
  "cpf": "987.654.321-00",
  "data_nascimento": "1985-03-22",
  "endereco": "Avenida Brasil",
  "numero": "456",
  "complemento": null,
  "bairro": "Vila Mariana",
  "cidade": "São Paulo",
  "cep": "04102-000",
  "observacoes": "Bruxismo noturno"
}
```

**Validações:**
- `nome` - Obrigatório
- `telefone` - Obrigatório
- `email` - Único
- `cpf` - Único

---

### PUT `/pacientes/{id}`
Atualizar dados de um paciente.

**Request:**
```json
{
  "nome": "João Silva Santos",
  "email": "joao.silva@email.com",
  "telefone": "(11) 99999-8888",
  "observacoes": "Atualizou endereço"
}
```

---

### GET `/pacientes/{id}`
Obter dados de um paciente específico.

---

## 📅 Gestão de Consultas

### GET `/consultas`
Listar todas as consultas com informações de paciente e dentista.

**Response:**
```json
[
  {
    "id": "uuid-6666",
    "paciente_id": "uuid-5555",
    "paciente_nome": "João Silva",
    "dentista_id": "uuid-1234",
    "dentista_nome": "Dr. João",
    "data_hora": "2024-12-28T10:00:00Z",
    "tipo_consulta": "limpeza",
    "status": "agendada",
    "descricao": "Limpeza e avaliação completa",
    "valor": 150.00,
    "pago": 0,
    "criado_em": "2024-12-27T15:30:00Z"
  }
]
```

**Status Disponíveis:**
- `agendada` - Consultado futuro
- `realizada` - Consulta concluída
- `cancelada` - Cancelada

---

### POST `/consultas`
Agendar nova consulta.

**Request:**
```json
{
  "paciente_id": "uuid-5555",
  "dentista_id": "uuid-1234",
  "data_hora": "2024-12-28 10:00",
  "tipo_consulta": "restauracao",
  "descricao": "Restauração da coroa do dente 36",
  "valor": 350.00
}
```

**Tipos de Consulta:**
- `geral` - Consulta geral
- `limpeza` - Limpeza profissional
- `tratamento` - Tratamento específico
- `restauracao` - Restauração
- `avaliacao` - Avaliação
- `emergencia` - Atendimento emergencial

**Validações:**
- `paciente_id` - Obrigatório
- `data_hora` - Obrigatório e deve ser futuro
- Não pode ter dois pacientes no mesmo horário

---

### GET `/consultas/paciente/{paciente_id}`
Listar consultas de um paciente específico.

---

### GET `/consultas/disponibilidade/{data}`
Obter horários disponíveis para uma data.

**Response:**
```json
{
  "data": "2024-12-28",
  "horarios_disponiveis": [
    "08:00", "08:30", "09:00", "09:30", "10:00",
    "10:30", "11:00", "11:30", "14:00", "14:30",
    "15:00", "15:30", "16:00", "16:30", "17:00"
  ]
}
```

**Horários de Funcionamento:**
- Segunda a Sexta: 08:00 - 17:30
- Intervalo de 30 minutos entre consultas

---

### PUT `/consultas/{id}/status`
Atualizar status de uma consulta.

**Request:**
```json
{
  "status": "realizada",
  "pago": true
}
```

**Transitions permitidas:**
- `agendada` → `realizada`
- `agendada` → `cancelada`
- `realizada` → `cancelada`

---

## 📊 Relatórios

### GET `/relatorios/estoque`
Gerar relatório completo de estoque. ✅ Requer role: `admin` ou `dentista`

**Response:**
```json
{
  "tipo": "Relatório de Estoque",
  "data_geracao": "2024-12-28T15:30:00Z",
  "total_produtos": 45,
  "valor_total_estoque": 5000.00,
  "produtos": [
    {
      "id": "uuid-5678",
      "nome": "Luva de Procedimento",
      "quantidade": 150,
      "preco_unitario": 2.50,
      "total": 375.00
    }
  ]
}
```

---

### GET `/relatorios/receita?data_inicio={YYYY-MM-DD}&data_fim={YYYY-MM-DD}`
Gerar relatório de receita por período.

**Response:**
```json
{
  "tipo": "Relatório de Receita",
  "periodo": "2024-12-01 a 2024-12-31",
  "total_receita": 8500.00,
  "total_consultas": 34,
  "consultas": [
    {
      "id": "uuid-6666",
      "paciente_nome": "João Silva",
      "data_hora": "2024-12-28T10:00:00Z",
      "tipo_consulta": "limpeza",
      "valor": 150.00,
      "pago": 1
    }
  ]
}
```

---

### GET `/relatorios/agendamentos`
Gerar relatório de agendamentos.

**Response:**
```json
{
  "tipo": "Relatório de Agendamentos",
  "total": 50,
  "por_status": {
    "agendada": 10,
    "realizada": 35,
    "cancelada": 5
  },
  "consultas": [...]
}
```

---

### POST `/relatorios/exportar-pdf`
Exportar relatório em formato PDF.

**Request:**
```json
{
  "tipo": "estoque",
  "dados": {}
}
```

**Response:**
- Content-Type: application/pdf
- File download: relatorio-estoque-{timestamp}.pdf

---

### POST `/relatorios/exportar-excel`
Exportar relatório em formato Excel.

**Request:**
```json
{
  "tipo": "agendamentos",
  "dados": []
}
```

**Response:**
- Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
- File download: relatorio-agendamentos-{timestamp}.xlsx

---

## 🔄 Fluxos Principais

### Fluxo: Agendar Consulta e Processar Pagamento

1. **Verificar disponibilidade:**
   ```bash
   GET /consultas/disponibilidade/2024-12-28
   ```

2. **Agendar consulta:**
   ```bash
   POST /consultas
   ```

3. **Processar pagamento (integração Stripe):**
   ```bash
   POST /pagamentos/criar-intencao
   ```

4. **Confirmar pagamento:**
   ```bash
   POST /pagamentos/confirmar
   ```

5. **Atualizar status:**
   ```bash
   PUT /consultas/{id}/status
   ```

### Fluxo: Gestão de Estoque

1. **Listar produtos:**
   ```bash
   GET /estoque
   ```

2. **Registrar entrada:**
   ```bash
   POST /estoque/{id}/movimentar
   ```

3. **Verificar alertas:**
   ```bash
   GET /estoque/alertas/reposicao
   ```

4. **Gerar relatório:**
   ```bash
   GET /relatorios/estoque
   ```

---

## 🎯 Limites e Validações

| Campo | Limite | Formato |
|-------|--------|---------|
| Nome | 255 caracteres | Texto |
| Email | 255 caracteres | email@domain.com |
| Telefone | 20 caracteres | (XX) XXXXX-XXXX |
| CPF | 14 caracteres | XXX.XXX.XXX-XX |
| CEP | 9 caracteres | XXXXX-XXX |
| Senha | Min 6 caracteres | Qualquer |
| Token | 24 horas | JWT |
| Valor | Decimal | 0.00 - 999.999,99 |

---

## ⚡ Performance e Cache

- **Listagens**: Implementar paginação a partir de 100 registros
- **Relatórios**: Cachear por 5 minutos
- **Alertas**: Atualizar em tempo real
- **Banco de Dados**: Índices em email, cpf, telefone

---

## 🔒 Segurança

- Todas as senhas são hasheadas com bcryptjs
- JWT expira em 24h
- CORS configurado apenas para localhost em desenvolvimento
- SQL Injection prevenido com prepared statements
- Rate limiting: 100 requisições/minuto por IP

---

## 📞 Suporte

Para dúvidas sobre a API, consulte os exemplos em `TESTING.md` ou veja os arquivos de exemplo em `backend/routes/` e `backend/services/`.
