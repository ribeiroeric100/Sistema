@echo off
REM Script de instalação completa do Sistema Odontológico

echo.
echo 🦷 Instalando Sistema Odontologico...
echo.

REM Backend
echo 📦 Instalando dependências do Backend...
cd backend
call npm install
echo ✅ Backend instalado!
echo.

REM Frontend
echo 📦 Instalando dependências do Frontend...
cd ..\frontend
call npm install
echo ✅ Frontend instalado!
echo.

REM Electron
echo 📦 Instalando dependências do Electron...
cd ..\electron
call npm install
echo ✅ Electron instalado!
echo.

echo 🎉 Instalação completa!
echo.
echo Para iniciar o sistema, abra 3 terminais e execute:
echo.
echo Terminal 1 (Backend):
echo   cd backend && npm run dev
echo.
echo Terminal 2 (Frontend):
echo   cd frontend && npm run dev
echo.
echo Terminal 3 (Electron):
echo   cd electron && npm start
echo.
pause
