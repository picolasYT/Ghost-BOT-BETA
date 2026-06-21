# Ghost-BOT Beta

Bot modular de WhatsApp basado actualmente en `Baileys` como provider principal.

## Que usa hoy

Este proyecto usa `Baileys` como provider principal para mejorar compatibilidad con Termux, Linux y entornos sin Chromium.

Eso significa:

- El arranque principal ya no depende de Chromium.
- La compatibilidad con Termux mejora mucho frente a `whatsapp-web.js`.
- Algunos flujos avanzados heredados, como ciertos subbots, todavia usan `whatsapp-web.js`.

## Mejoras agregadas

- Inicio mas portable para Windows, Linux y Termux.
- Configuracion por variables de entorno para `CHROME_PATH`, `AUTH_PATH`, `DISABLE_SANDBOX` y `PUPPETEER_HEADLESS`.
- Carpeta de sesion configurable.
- Comandos nuevos: `estado`, `uptime`, `reload`.
- Recarga real de plugins sin reiniciar.

## Requisitos

- Node.js 20 o superior
- `npm install`
- Chromium o Chrome disponible si tu entorno no lo resuelve automaticamente

## Inicio rapido

```bash
npm start
```

## Variables utiles

```env
PREFIX=!
BOT_NAME=Ghost-Bot
OWNER_NAME=Picolas
LOGIN_METHOD=qr
PHONE_NUMBER=
AUTH_PATH=./data/auth
CHROME_PATH=
PUPPETEER_HEADLESS=true
DISABLE_SANDBOX=auto
PROVIDER=baileys
```

## Plataformas

### Windows

```powershell
npm install
npm start
```

Si Chrome no es detectado:

```powershell
$env:CHROME_PATH="C:\Program Files\Google\Chrome\Application\chrome.exe"
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

## Nota sobre compatibilidad

El bot principal ya arranca con Baileys, pero algunos comandos heredados siguen pensados originalmente para `whatsapp-web.js`. El caso mas claro hoy es la capa de subbots.
