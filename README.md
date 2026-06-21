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
OWNER_NUMBER=
LOGIN_METHOD=qr
PHONE_NUMBER=
AUTH_PATH=./data/auth
CHROME_PATH=
PUPPETEER_HEADLESS=true
DISABLE_SANDBOX=auto
PROVIDER=baileys
REPO_URL=https://github.com/picolasYT/Ghost-BOT-BETA.git
WEB_PORT=3000
WEB_HOST=0.0.0.0
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

### Render

Si queres usar la web de emparejamiento de subbots en Render, `whatsapp-web.js` necesita Chrome o Chromium real.

Opciones:

1. Instalar Chromium en el deploy y definir `CHROME_PATH`.
2. Usar una ruta ya existente del sistema si Render la expone.

Variables recomendadas:

```env
CHROME_PATH=/usr/bin/chromium
DISABLE_SANDBOX=auto
PUPPETEER_HEADLESS=true
```

Si tu servicio permite instalar paquetes del sistema, podes usar:

```bash
npm run install:render-chrome
```

Sin Chrome/Chromium disponible, el bot principal no se cae, pero la web no va a poder generar el código de emparejamiento del subbot.

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

## Web de emparejamiento

Al iniciar el proyecto tambien se levanta una pagina web para Render o localhost.

```text
http://localhost:3000
```

Desde esa pagina ahora podes:

- crear subbots desde el navegador
- obtener el codigo de emparejamiento sin usar el chat
- apagar subbots activos

Si queres cambiar host o puerto:

```env
WEB_PORT=3000
WEB_HOST=0.0.0.0
```

## Sugerencias al owner

Si queres recibir sugerencias de usuarios en privado, configura:

```env
OWNER_NUMBER=54911XXXXXXXX
```

Usa el numero con codigo de pais y sin `+`, espacios ni guiones.

## Nota sobre compatibilidad

El bot principal ya arranca con Baileys, pero algunos comandos heredados siguen pensados originalmente para `whatsapp-web.js`. El caso mas claro hoy es la capa de subbots.
