# 🦷 Sistema de Gestão Odontológica

O **Sistema de Gestão** é um sistema completo de gestão para clínicas odontológicas, desenvolvido como projeto de portfólio com foco em **organização**, **segurança** e **boa experiência do usuário**.

A aplicação centraliza pacientes, consultas, procedimentos, estoque e usuários em um único sistema, evitando controles manuais e planilhas espalhadas.

---

## 💡 Sobre o projeto

Esse projeto simula um sistema real usado no dia a dia de uma clínica odontológica, com múltiplos perfis de acesso e funcionalidades completas de gestão.

Ele foi pensado para demonstrar:

* Arquitetura full stack
* Controle de permissões
* Boas práticas de frontend e backend
* Integração com banco de dados
* Interface moderna e funcional

---

## 🚀 Funcionalidades

### 👤 Pacientes

* Cadastro, edição e exclusão
* Perfil completo com histórico
* Busca rápida por nome ou telefone

### 📅 Consultas & Procedimentos

* Agendamento de consultas
* Registro de procedimentos
* Controle de valores
* Vários procedimentos por atendimento

### 📦 Estoque

* Controle de materiais e produtos
* Quantidade, validade, fornecedor e preço
* Filtros e busca

### 👥 Usuários & Permissões

* Perfis: **admin**, **dentista** e **recepção**
* Controle de acesso por nível
* Gestão de usuários

### 🔐 Autenticação & Segurança

* Login e recuperação de senha
* Rotas protegidas
* Validação de dados

### 📊 Relatórios & Auditoria

* Registro de ações no sistema
* Relatórios de atendimentos, pacientes e estoque

### 🎨 Interface

* Tema claro e escuro
* Layout moderno
* Modais personalizados
* Navegação simples e intuitiva

---

## 🖥️ Tecnologias utilizadas

**Frontend**

* React
* Vite

**Backend**

* Node.js
* Express
* JWT para autenticação

**Banco de Dados**

* PostgreSQL
* SQLite (ambiente de desenvolvimento)

**Desktop**

* Electron

---

## 🧱 Arquitetura

* Frontend e backend separados
* API REST
* Controle de permissões por perfil
* Código organizado e escalável

---

## ▶️ Como rodar o projeto

```bash
# clone o repositório
git clone https://github.com/ribeiroeric100/Sistema

# instale as dependências
npm install

# rode o backend
cd backend
npm run dev

# rode o frontend
cd frontend
npm run dev

#rodar completo
npm run dev:all
```

> É necessário configurar o arquivo `.env` com as variáveis do banco de dados.

# user para teste: 
email: recepcao@local
senha: 323232

## 🎯 Objetivo do projeto

Este projeto foi desenvolvido para fins de **estudo e portfólio**, com o objetivo de demonstrar habilidades em:

* Desenvolvimento Full Stack
* Criação de sistemas reais
* Autenticação e segurança
* Modelagem de dados
* UI/UX funcional

---

## 📌 Próximos passos (ideias)

* Dashboard com métricas
* Notificações automáticas
* Integração real com e-mail/SMS
* Deploy completo em produção

---

## 👨‍💻 Autor

Desenvolvido por **Eric**
Projeto de portfólio para demonstração de habilidades em desenvolvimento web.
