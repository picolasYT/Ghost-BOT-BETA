# Ghost-BOT Beta

Bot modular de WhatsApp basado actualmente en `whatsapp-web.js`.

## Que usa hoy

Este proyecto **ya tiene Baileys instalado**, pero el codigo activo del bot corre con `whatsapp-web.js`.

Eso significa:

- Hoy funciona con navegador Chromium/Puppeteer.
- No hubo migracion completa a Baileys todavia.
- La estructura ya quedo preparada para una futura migracion mas ordenada.

## Mejoras agregadas

- Inicio mas portable para Windows, Linux y Termux.
- Configuracion por variables de entorno para `CHROME_PATH`, `AUTH_PATH`, `DISABLE_SANDBOX` y `PUPPETEER_HEADLESS`.
- Carpeta de sesion configurable.
- Comandos nuevos: `estado`, `uptime`, `reload`.
- Recarga real de plugins sin reiniciar.

## Requisitos

- Node.js 18 o superior
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
PROVIDER=whatsapp-web.js
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

## Nota sobre Baileys

Si queres, el siguiente paso puede ser una migracion completa a Baileys. No la hice ahora porque implicaria reescribir la capa de eventos, envio de mensajes, medios, grupos y autenticacion para no romper tus plugins actuales.
