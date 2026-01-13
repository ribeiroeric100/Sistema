# 🚀 INICIAR O SISTEMA - INSTRUÇÕES

## ✅ Dependências Instaladas com Sucesso!

Todas as dependências do backend, frontend e electron já foram instaladas.

---

## 📋 INICIAR OS 3 SERVIÇOS

Abra **3 terminais PowerShell** separados e execute os comandos abaixo em cada um:

### Terminal 1 - Backend (Express)
```powershell
cd c:\Users\derek\Desktop\odonto-app\backend
npm run dev
```
✅ Esperado: `✓ Servidor rodando em http://localhost:3001`

---

### Terminal 2 - Frontend (React + Vite)
```powershell
cd c:\Users\derek\Desktop\odonto-app\frontend
npm run dev
```
✅ Esperado: `Local: http://localhost:5173` ou `5174`

---

### Terminal 3 - Electron (Desktop App)
```powershell
cd c:\Users\derek\Desktop\odonto-app\electron
npm start
```
✅ Esperado: Janela Electron abre automaticamente

---

## 🌐 Acessar o Sistema

Após os 3 serviços iniciarem:

1. **Via Navegador**: http://localhost:5173 (ou 5174)
2. **Via Electron**: Abre automaticamente uma janela
3. **Backend Health Check**: http://localhost:3001/api/health

---

## 🔐 Criar Primeira Conta

1. Abra a aplicação (navegador ou Electron)
2. Clique em "Criar Conta"
3. Preencha:
   - Email: `admin@clinic.com`
   - Senha: `Admin@123`
   - Nome: `Administrador`
4. Clique em "Registrar"
5. Faça login com essas credenciais

---

## ✅ Testando as Funcionalidades

Após logado, você verá:
- ✅ Dashboard (resumo com alertas)
- ✅ Pacientes (cadastro de pacientes)
- ✅ Estoque (gerenciar materiais)
- ✅ Agenda (agendar consultas)
- ✅ Atendimentos (acompanhar consultas)
- ✅ Relatórios (gerar relatórios e exportar)

---

## 🛠️ Troubleshooting

### "Porta já em uso"
Se receber erro de porta já em uso:
- Backend usa porta 3001
- Frontend usa porta 5173 (depois 5174, 5175...)
- Feche outros processos Node.js: `Get-Process node | Stop-Process`

### "Failed to resolve import"
Se der erro de módulo não encontrado:
- Execute novamente em cada pasta: `npm install`

### "Electron não abre"
- Verifique se o Backend está rodando primeiro
- Verifique se há erros no console do Terminal 3

---

## 📚 Documentação

- **QUICKSTART.md** - Guia rápido
- **README.md** - Documentação completa
- **TESTING.md** - Como testar com cURL
- **API_REFERENCE.md** - Documentação técnica

---

## 🎯 Status das Instalações

✅ Backend dependencies - OK  
✅ Frontend dependencies - OK  
✅ Electron dependencies - OK  
✅ Pronto para iniciar!

---

**Próximo passo**: Abra 3 terminais PowerShell e execute os comandos acima! 🚀
