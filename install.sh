#!/bin/bash

# Script de instalação completa do Sistema Odontológico

echo "🦷 Instalando Sistema Odontológico..."
echo ""

# Instalação via Workspaces (raiz)
echo "📦 Instalando dependências (workspaces) na raiz..."
cd "$(dirname "$0")"
npm install
echo "✅ Dependências instaladas!"
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
echo "Alternativa pela raiz:"
echo "  npm run dev:web"
echo "  npm run dev:all"
echo ""
