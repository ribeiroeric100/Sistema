# Backend Sistema Odontológico

## Instalação

```bash
cd backend
npm install
```

## Banco de dados (Postgres)

Este backend usa Postgres via `pg` e cria o schema via migrations (`node-pg-migrate`).

### Variáveis de ambiente

- `DATABASE_URL` (obrigatório)
	- Dev local (exemplo): `postgres://postgres:postgres@localhost:5432/odonto`
	- Render: o próprio Render fornece `DATABASE_URL` automaticamente ao criar um Postgres.
- `PGSSL=true` (opcional)
	- Em produção, o backend já ativa SSL automaticamente.

### Rodar migrations

```bash
npm run migrate:up
```

### Importar dados antigos do SQLite (migração local → Postgres)

Se seus dados antigos estavam em um arquivo SQLite (`.db`/`.sqlite`), você pode importar para o Postgres configurado em `DATABASE_URL`.

1) Conferir quantas linhas o SQLite tem (não escreve nada):

```bash
npm run import:sqlite -- C:\caminho\para\seu\banco.sqlite --dry-run
```

2) Importar de fato:

```bash
npm run import:sqlite -- C:\caminho\para\seu\banco.sqlite
```

3) Para substituir (apagar dados atuais no Postgres e importar do zero):

```bash
npm run import:sqlite -- C:\caminho\para\seu\banco.sqlite --truncate
```

Depois valide com:

```bash
node scripts/db-check.js DATABASE_URL
```

## Rodar o servidor

```bash
npm run dev
```

Se for a primeira vez com Postgres, rode antes:

```bash
npm run migrate:up
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
