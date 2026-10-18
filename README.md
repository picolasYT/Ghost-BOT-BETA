# Ghost-BOT Beta

Bot modular de WhatsApp basado en `Baileys`.

## Que usa hoy

Este proyecto ahora arranca solo con `Baileys` para mejorar compatibilidad con Termux, Linux y Windows.

Eso significa:

- El arranque ya no depende de Chromium ni `whatsapp-web.js`.
- `npm install` ya no deberia intentar instalar `puppeteer`.
- El mismo flujo de login sirve para PC, VPS y Termux.

## Mejoras agregadas

- Inicio mas portable para Windows, Linux y Termux.
- Configuracion simple por variables de entorno.
- Carpeta de sesion configurable.
- Comandos nuevos: `estado`, `uptime`, `reload`.
- Recarga real de plugins sin reiniciar.
- Se reconocen los IDs de botones y filas de WhatsApp para ejecutar el comando seleccionado.

## Requisitos

- Node.js 20 o superior
- `npm install`

## Inicio rapido

```bash
npm start
```

## Variables utiles

`Baileys` queda fijo por codigo, asi que no hace falta configurar `PROVIDER`.

```env
BOT_PREFIX=!
BOT_NAME=Ghost-Bot
OWNER_NAME=Picolas
OWNER_NUMBER=
LOGIN_METHOD=qr
PHONE_NUMBER=
AUTH_PATH=./data/auth
REPO_URL=https://github.com/picolasYT/Ghost-BOT-BETA.git
WEB_PORT=3000
WEB_HOST=0.0.0.0
```

En Termux usa `BOT_PREFIX=!`: Termux reserva `PREFIX` para la ruta de instalación. También se aceptan los comandos con `.`.

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

### Termux

```bash
pkg update
pkg install nodejs-lts
npm install
npm start
```

Si `pkg install nodejs-lts` no existe en tu version de Termux, usa una instalacion de Node compatible con 20 o superior.

## Comandos nuevos

- `!estado`: muestra provider, plataforma, ruta de auth y datos del runtime.
- `!uptime`: muestra cuanto lleva encendido el bot.
- `!reload`: recarga plugins sin reiniciar el proceso. Solo responde desde la cuenta del owner.
- `!sug <texto>`: envia una sugerencia o reporte al owner del bot.

## Web de estado

Al iniciar el proyecto tambien se levanta una pagina web simple con el estado del bot.

```text
http://localhost:3000
```

Muestra:

- estado del bot
- uptime
- comandos cargados
- provider
- owner
- ruta de auth

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


## Menú interactivo y prefijos

- `!menu2` abre el menú interactivo con botones nativos de WhatsApp.
- También podés usar `.menu2` y ejecutar los comandos con `.`, aunque `BOT_PREFIX` tenga otro valor.
- Si el cliente no admite el formato interactivo, el menú responde con una lista de texto.

## Dashboard web y health checks

El dashboard web está disponible en `http://localhost:3000` (o el puerto configurado) e incluye el estado del bot, subbots y comprobaciones de proceso, WhatsApp y memoria.

- `GET /health`: liveness del servidor web.
- `GET /health/ready`: readiness de WhatsApp; responde HTTP 503 hasta que se conecta.
- `GET /api/health`: estado detallado de las comprobaciones.
