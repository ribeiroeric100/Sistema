# Backend Sistema Odontológico

## Instalação

```bash
cd backend
npm install
```

## Rodar o servidor

```bash
npm run dev
```

O servidor rodará em `http://localhost:3001`

## Endpoints disponíveis

### Autenticação
- `POST /api/auth/register` - Registrar novo usuário
- `POST /api/auth/login` - Login de usuário
- `POST /api/auth/forgot-password` - Recuperação de senha
- `POST /api/auth/reset-password` - Redefinir senha

Notas:
- Roles atuais: `admin`, `dentista`, `recepcao` (compatibilidade: `assistente` → `recepcao`).
- Se não existir nenhum usuário no banco, o primeiro registro vira `admin` automaticamente.
- Depois disso, por segurança, o registro exige um `admin` autenticado.

### Estoque
- `GET /api/estoque` - Listar produtos
- `POST /api/estoque` - Criar produto
- `POST /api/estoque/:id/movimentar` - Entrada/saída de produtos
- `GET /api/estoque/alertas/reposicao` - Alertas de reposição

### Pacientes
- `GET /api/pacientes` - Listar pacientes
- `POST /api/pacientes` - Criar paciente
- `PUT /api/pacientes/:id` - Atualizar paciente

### Consultas
- `GET /api/consultas` - Listar consultas
- `POST /api/consultas` - Agendar consulta
- `GET /api/consultas/disponibilidade/:data` - Horários disponíveis

### Relatórios
- `GET /api/relatorios/estoque` - Relatório de estoque
- `GET /api/relatorios/receita` - Relatório de receita
- `GET /api/relatorios/agendamentos` - Relatório de agendamentos
- `POST /api/relatorios/exportar-pdf` - Exportar em PDF
- `POST /api/relatorios/exportar-excel` - Exportar em Excel
