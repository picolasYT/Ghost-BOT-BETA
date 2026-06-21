# Ghost-BOT Beta

Bot modular de WhatsApp basado actualmente en `Baileys` como provider principal.

## Que usa hoy

Este proyecto usa `Baileys` como provider principal para mejorar compatibilidad con Termux, Linux y entornos sin Chromium.

Eso significa:

- El arranque principal ya no depende de Chromium.
- La compatibilidad con Termux mejora mucho frente a `whatsapp-web.js`.
- Algunos flujos heredados todavia pueden seguir dependiendo de comandos pensados originalmente para otras capas.

## Mejoras agregadas

- Inicio mas portable para Windows, Linux y Termux.
- Configuracion por variables de entorno para `CHROME_PATH`, `AUTH_PATH`, `DISABLE_SANDBOX` y `PUPPETEER_HEADLESS`.
- Carpeta de sesion configurable.
- Comandos nuevos: `estado`, `uptime`, `reload`.
- Recarga real de plugins sin reiniciar.

## Requisitos

- Node.js 20 o superior
- `npm install`

## Inicio rapido

```bash
npm start
```

## Variables utiles

```env
PREFIX=!
BOT_NAME=Ghost-Bot
OWNER_NAME=Picolas
OWNER_NUMBER=
LOGIN_METHOD=qr
PHONE_NUMBER=
AUTH_PATH=./data/auth
CHROME_PATH=
PUPPETEER_HEADLESS=true
DISABLE_SANDBOX=auto
PROVIDER=baileys
REPO_URL=https://github.com/picolasYT/Ghost-BOT-BETA.git
```

## Plataformas

### Windows

```powershell
npm install
npm start
```

### Linux

```bash
npm install
npm start
```

Si tu servidor necesita ruta manual:

```bash
export CHROME_PATH=/usr/bin/chromium-browser
npm start
```

### Termux

```bash
pkg update
pkg install nodejs chromium
npm install
export CHROME_PATH=/data/data/com.termux/files/usr/bin/chromium
npm start
```

Si Chromium cambia de ruta en tu instalacion, ajusta `CHROME_PATH`.

## Comandos nuevos

- `!estado`: muestra provider, plataforma, ruta de auth y datos del runtime.
- `!uptime`: muestra cuanto lleva encendido el bot.
- `!reload`: recarga plugins sin reiniciar el proceso. Solo responde desde la cuenta del owner.
- `!sug <texto>`: envia una sugerencia o reporte al owner del bot.

## Sugerencias al owner

Si queres recibir sugerencias de usuarios en privado, configura:

```env
OWNER_NUMBER=54911XXXXXXXX
```

Usa el numero con codigo de pais y sin `+`, espacios ni guiones.
