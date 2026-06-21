#!/usr/bin/env bash
set -e

echo "Instalando Chromium para Ghost Bot..."

if command -v apt-get >/dev/null 2>&1; then
  apt-get update
  apt-get install -y chromium
else
  echo "apt-get no esta disponible en este entorno."
  exit 1
fi

if command -v chromium >/dev/null 2>&1; then
  echo "Chromium instalado en: $(command -v chromium)"
elif command -v chromium-browser >/dev/null 2>&1; then
  echo "Chromium instalado en: $(command -v chromium-browser)"
else
  echo "No se encontro el ejecutable de Chromium despues de instalar."
  exit 1
fi
