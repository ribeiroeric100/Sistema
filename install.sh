#!/bin/bash

# Script de instalação completa do Sistema Odontológico

echo "🦷 Instalando Sistema Odontológico..."
echo ""

# Backend
echo "📦 Instalando dependências do Backend..."
cd backend
npm install
echo "✅ Backend instalado!"
echo ""

# Frontend
echo "📦 Instalando dependências do Frontend..."
cd ../frontend
npm install
echo "✅ Frontend instalado!"
echo ""

# Electron
echo "📦 Instalando dependências do Electron..."
cd ../electron
npm install
echo "✅ Electron instalado!"
echo ""

echo "🎉 Instalação completa!"
echo ""
echo "Para iniciar o sistema, abra 3 terminais e execute:"
echo ""
echo "Terminal 1 (Backend):"
echo "  cd backend && npm run dev"
echo ""
echo "Terminal 2 (Frontend):"
echo "  cd frontend && npm run dev"
echo ""
echo "Terminal 3 (Electron):"
echo "  cd electron && npm start"
echo ""
