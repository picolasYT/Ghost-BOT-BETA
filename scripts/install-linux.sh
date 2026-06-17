#!/usr/bin/env bash

echo "👻 Instalando dependencias de Ghost Bot para Linux / Codespaces..."

sudo apt update

sudo apt install -y \
  libatk1.0-0 \
  libatk-bridge2.0-0 \
  libcups2 \
  libxcomposite1 \
  libxrandr2 \
  libxdamage1 \
  libpango-1.0-0 \
  libnss3 \
  libxshmfence1 \
  libgbm1 \
  libgtk-3-0 \
  fonts-liberation \
  xdg-utils

sudo apt install -y libasound2t64 || sudo apt install -y libasound2

echo "✅ Dependencias de Chrome instaladas."
echo "📦 Instalando dependencias de Node..."
npm install

echo "✅ Ghost Bot listo."
echo "🚀 Ahora ejecutá: npm start"