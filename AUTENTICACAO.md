# 🔐 Guia de Login e Registro

## ✨ Como Funciona

### 1️⃣ Primeira Vez - Criar Conta
Clique em **"Registrar-se"** e preencha:
- **Nome:** Seu nome completo
- **Email:** Um email válido (ex: admin@clinica.com)
- **Senha:** No mínimo 6 caracteres
- **Confirmar Senha:** Mesma senha novamente

Clique em **Registrar** e você será logado automaticamente!

---

## 🧪 Usuários de Teste

Se quiser testar rapidamente, crie essas contas:

### Admin
- **Email:** admin@clinica.com
- **Senha:** Admin@123
- **Nome:** Administrador

### Dentista
- **Email:** dentista@clinica.com
- **Senha:** Dent@123
- **Nome:** Dr. João Silva

### Recepção
- **Email:** recepcao@clinica.com
- **Senha:** Recep@123
- **Nome:** Maria Recepção

Obs.: o role `assistente` é aceito por compatibilidade e normalizado para `recepcao`.

---

## 🔄 Fluxo de Autenticação

1. **Login/Registro** → Você faz login com email e senha
2. **Token JWT** → Sistema gera um token válido por 24 horas
3. **Dashboard** → Você é redirecionado automaticamente para o painel
4. **Logout** → Clique em "Sair" para fazer logout

---

## 🛡️ Segurança

- ✅ Senhas criptografadas com bcryptjs (10 salt rounds)
- ✅ Tokens JWT com expiração de 24 horas
- ✅ Rate limiting em endpoints sensíveis (login/registro/recuperação)
- ✅ Dados salvos apenas no banco (SQLite)

---

## 🐛 Problemas Comuns

### "Email já registrado"
Se você tentar registrar com um email que já existe, receberá esse erro. Use outro email.

### "Senha inválida"
Ao fazer login, se a senha estiver errada, receberá erro de autenticação.

### "Token expirado"
Se ficar muito tempo sem usar (> 24h), você será desconectado e precisará fazer login novamente.

---

## ✅ Próximos Passos

1. ✅ Vá em **"Registrar-se"**
2. ✅ Crie sua primeira conta
3. ✅ Explore o **Dashboard**
4. ✅ Teste as funcionalidades (Pacientes, Estoque, Agenda, etc)

---

**Pronto para começar? 🚀**
