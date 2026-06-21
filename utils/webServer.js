import crypto from "crypto";
import http from "http";
import { getAppState, patchWebState } from "./appState.js";
import { listSubbots, startSubbot, stopSubbot } from "./subbotManager.js";

const sessionStore = global.ghostBotAdminSessions || (global.ghostBotAdminSessions = new Map());

const adminIdeas = [
  "Estado en vivo del bot",
  "Uptime del proceso",
  "Cantidad de comandos cargados",
  "Lista de subbots activos",
  "Generar codigo de emparejamiento",
  "Apagar subbots desde web",
  "Ver errores recientes del panel",
  "Historial de sugerencias",
  "Atajos para update y reload",
  "Estado del provider",
  "Ruta de auth activa",
  "Datos del owner configurado",
  "Monitor de reconexiones",
  "Panel de moderacion",
  "Logs basicos del bot",
  "Accesos protegidos por login",
  "Healthcheck para Render",
  "Resumen de sesiones creadas",
  "API privada para automatizaciones",
  "Base para futuras funciones admin"
];

function sendJson(res, statusCode, payload, extraHeaders = {}) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    ...extraHeaders
  });
  res.end(body);
}

function sendHtml(res, html, statusCode = 200, extraHeaders = {}) {
  res.writeHead(statusCode, {
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "no-store",
    ...extraHeaders
  });
  res.end(html);
}

function parseCookies(req) {
  const raw = req.headers.cookie || "";
  const pairs = raw.split(";").map((part) => part.trim()).filter(Boolean);
  const cookies = {};

  for (const pair of pairs) {
    const index = pair.indexOf("=");
    if (index === -1) continue;
    const key = pair.slice(0, index);
    const value = pair.slice(index + 1);
    cookies[key] = decodeURIComponent(value);
  }

  return cookies;
}

function createSession() {
  const token = crypto.randomBytes(24).toString("hex");
  sessionStore.set(token, {
    createdAt: Date.now()
  });
  return token;
}

function isAuthenticated(req) {
  const cookies = parseCookies(req);
  const token = cookies.ghost_admin_session || "";
  return Boolean(token && sessionStore.has(token));
}

function requireAuth(req, res) {
  if (isAuthenticated(req)) return true;
  sendJson(res, 401, { error: "No autenticado." });
  return false;
}

function clearSession(req, res) {
  const cookies = parseCookies(req);
  const token = cookies.ghost_admin_session || "";
  if (token) sessionStore.delete(token);
  res.setHeader("Set-Cookie", "ghost_admin_session=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax");
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";

    req.on("data", (chunk) => {
      data += chunk;
      if (data.length > 1_000_000) {
        reject(new Error("El body es demasiado grande."));
        req.destroy();
      }
    });

    req.on("end", () => {
      if (!data) return resolve({});

      try {
        resolve(JSON.parse(data));
      } catch {
        reject(new Error("JSON invalido."));
      }
    });

    req.on("error", reject);
  });
}

function formatUptime(startedAt) {
  const seconds = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h}h ${m}m ${s}s`;
}

function renderLoginPage() {
  return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Ghost Bot Admin</title>
    <style>
      :root {
        --bg: #08101d;
        --card: rgba(11, 19, 34, 0.92);
        --line: rgba(148, 163, 184, 0.16);
        --text: #e8f1ff;
        --muted: #95a7c7;
        --accent: #41d6c3;
        --accent2: #7dd3fc;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif;
        color: var(--text);
        background:
          radial-gradient(circle at top left, rgba(65, 214, 195, 0.18), transparent 28%),
          radial-gradient(circle at bottom right, rgba(125, 211, 252, 0.16), transparent 26%),
          linear-gradient(160deg, #06101d 0%, #0a1220 46%, #111827 100%);
      }
      .box {
        width: min(460px, calc(100vw - 24px));
        padding: 28px;
        border-radius: 28px;
        background: var(--card);
        border: 1px solid var(--line);
        box-shadow: 0 24px 70px rgba(0, 0, 0, 0.35);
      }
      h1 {
        margin: 0 0 10px;
        font-size: clamp(2rem, 8vw, 3rem);
        line-height: 0.95;
      }
      p {
        color: var(--muted);
        margin: 0 0 20px;
      }
      label {
        display: grid;
        gap: 8px;
        margin-bottom: 14px;
        font-weight: 600;
      }
      input {
        padding: 14px 16px;
        border-radius: 16px;
        border: 1px solid var(--line);
        background: rgba(7, 13, 24, 0.88);
        color: var(--text);
      }
      button {
        width: 100%;
        padding: 14px 18px;
        border: 0;
        border-radius: 16px;
        font-weight: 800;
        color: #071017;
        cursor: pointer;
        background: linear-gradient(135deg, var(--accent), var(--accent2));
      }
      #msg {
        margin-top: 14px;
        min-height: 22px;
        color: #ffb4b4;
      }
    </style>
  </head>
  <body>
    <main class="box">
      <h1>Ghost Bot Admin</h1>
      <p>Ingresá con tu usuario y contraseña para abrir el panel de control.</p>
      <label>Usuario<input id="user" autocomplete="username" /></label>
      <label>Contraseña<input id="pass" type="password" autocomplete="current-password" /></label>
      <button id="loginBtn">Entrar al panel</button>
      <div id="msg"></div>
    </main>
    <script>
      async function safeJson(res) {
        const text = await res.text();
        if (!text) return {};
        try {
          return JSON.parse(text);
        } catch {
          throw new Error(text);
        }
      }

      document.getElementById("loginBtn").addEventListener("click", async () => {
        const user = document.getElementById("user").value.trim();
        const pass = document.getElementById("pass").value;
        const msg = document.getElementById("msg");
        msg.textContent = "Verificando...";

        try {
          const res = await fetch("/api/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ user, pass })
          });
          const json = await safeJson(res);
          if (!res.ok) throw new Error(json.error || "No se pudo iniciar sesion.");
          window.location.reload();
        } catch (error) {
          msg.textContent = error.message;
        }
      });
    </script>
  </body>
</html>`;
}

function renderDashboard() {
  const ideasMarkup = adminIdeas
    .map((idea, index) => `<div class="idea"><span>${index + 1}.</span> ${idea}</div>`)
    .join("");

  return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Ghost Bot Panel</title>
    <style>
      :root {
        --bg: #0c111b;
        --panel: rgba(14, 23, 40, 0.78);
        --line: rgba(148, 163, 184, 0.2);
        --text: #e5eefc;
        --muted: #9db0cc;
        --accent: #2dd4bf;
        --accent2: #60a5fa;
        --danger: #f87171;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        min-height: 100vh;
        font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif;
        color: var(--text);
        background:
          radial-gradient(circle at top left, rgba(45, 212, 191, 0.22), transparent 30%),
          radial-gradient(circle at top right, rgba(96, 165, 250, 0.18), transparent 25%),
          linear-gradient(160deg, #08101d 0%, #0b1220 46%, #111827 100%);
      }
      body::before {
        content: "";
        position: fixed;
        inset: 0;
        background-image:
          linear-gradient(rgba(157, 176, 204, 0.08) 1px, transparent 1px),
          linear-gradient(90deg, rgba(157, 176, 204, 0.08) 1px, transparent 1px);
        background-size: 42px 42px;
        mask-image: radial-gradient(circle at center, black, transparent 80%);
        pointer-events: none;
      }
      .shell { width: min(1240px, calc(100vw - 28px)); margin: 18px auto; position: relative; z-index: 1; }
      .hero, .panel {
        border: 1px solid var(--line);
        border-radius: 28px;
        background: var(--panel);
        box-shadow: 0 24px 60px rgba(0,0,0,.28);
        backdrop-filter: blur(18px);
      }
      .hero { padding: 26px; }
      .topbar { display: flex; justify-content: space-between; gap: 16px; align-items: center; flex-wrap: wrap; }
      .eyebrow {
        display: inline-flex;
        gap: 8px;
        align-items: center;
        padding: 8px 12px;
        border-radius: 999px;
        border: 1px solid rgba(45, 212, 191, 0.24);
        background: rgba(45, 212, 191, 0.08);
        color: #b8fff6;
        font-size: .85rem;
      }
      h1 { margin: 16px 0 10px; font-size: clamp(2.4rem, 7vw, 4.8rem); line-height: .94; max-width: 11ch; }
      .lead { max-width: 64ch; color: var(--muted); }
      .cards, .ideas { display: grid; gap: 14px; }
      .cards { grid-template-columns: repeat(5, 1fr); margin-top: 20px; }
      .card, .idea { padding: 18px; border-radius: 20px; background: rgba(15,23,42,.72); border: 1px solid rgba(148,163,184,.12); }
      .idea span { color: var(--accent); font-weight: 800; margin-right: 8px; }
      .kicker { color: var(--muted); font-size: .82rem; text-transform: uppercase; letter-spacing: .08em; }
      .metric { margin-top: 8px; font-size: 1.45rem; font-weight: 700; }
      .grid { display: grid; grid-template-columns: 1.15fr .85fr; gap: 18px; margin-top: 18px; }
      .panel-body { padding: 22px; }
      .stack { display: grid; gap: 16px; }
      label { display: grid; gap: 8px; font-weight: 600; }
      input {
        width: 100%;
        padding: 14px 16px;
        border-radius: 16px;
        border: 1px solid rgba(148,163,184,.2);
        background: rgba(7,13,24,.88);
        color: var(--text);
      }
      .actions { display: flex; gap: 12px; flex-wrap: wrap; }
      button {
        border: 0;
        border-radius: 16px;
        padding: 14px 18px;
        font-weight: 800;
        cursor: pointer;
      }
      .primary { color: #071017; background: linear-gradient(135deg, var(--accent), #7dd3fc); }
      .secondary { color: var(--text); background: rgba(17,24,39,.9); border: 1px solid rgba(148,163,184,.18); }
      .danger { color: #fff; background: rgba(248,113,113,.16); border: 1px solid rgba(248,113,113,.28); }
      .output {
        min-height: 180px;
        padding: 18px;
        border-radius: 18px;
        background: rgba(6,10,18,.92);
        border: 1px solid rgba(148,163,184,.12);
        font-family: Consolas, "Courier New", monospace;
        white-space: pre-wrap;
      }
      .subbot-list, .ideas { grid-template-columns: 1fr; }
      .subbot {
        padding: 16px;
        border-radius: 18px;
        border: 1px solid rgba(148,163,184,.14);
        background: rgba(9,15,27,.82);
      }
      .subbot-top { display: flex; justify-content: space-between; gap: 10px; align-items: center; }
      .badge {
        display: inline-flex;
        align-items: center;
        padding: 6px 10px;
        border-radius: 999px;
        border: 1px solid rgba(148,163,184,.16);
        background: rgba(17,24,39,.85);
        font-size: .82rem;
      }
      .code {
        display: inline-block;
        margin-top: 12px;
        padding: 12px 14px;
        border-radius: 14px;
        background: rgba(45, 212, 191, 0.12);
        border: 1px solid rgba(45, 212, 191, 0.25);
        color: #b8fff6;
        font-size: 1.6rem;
        letter-spacing: .15em;
        font-weight: 800;
      }
      .note { margin-top: 12px; color: var(--muted); font-size: .92rem; }
      @media (max-width: 1100px) {
        .cards { grid-template-columns: repeat(3, 1fr); }
        .grid { grid-template-columns: 1fr; }
      }
      @media (max-width: 640px) {
        .shell { width: min(100vw - 16px, 1240px); margin: 8px auto 18px; }
        .hero, .panel-body { padding: 18px; }
        .cards { grid-template-columns: 1fr 1fr; }
        .actions { flex-direction: column; }
        button { width: 100%; }
      }
    </style>
  </head>
  <body>
    <div class="shell">
      <section class="hero">
        <div class="topbar">
          <div class="eyebrow">Ghost Bot Admin • Panel protegido</div>
          <button class="danger" id="logoutBtn">Cerrar sesión</button>
        </div>
        <h1>Panel de control del bot.</h1>
        <p class="lead">Estado en vivo, emparejamiento de subbots y base para un panel admin más grande sin depender del chat.</p>
        <div class="cards" id="cards"></div>
      </section>
      <section class="grid">
        <article class="panel">
          <div class="panel-body stack">
            <div>
              <h2>Crear subbot</h2>
              <p class="lead">Generá el código de emparejamiento desde la web. Si el backend falla, ahora el panel muestra el texto real del error en vez de romper con JSON vacío.</p>
            </div>
            <label>Número de WhatsApp<input id="phone" placeholder="549112345678" autocomplete="off" /></label>
            <div class="actions">
              <button class="primary" id="startBtn">Generar código</button>
              <button class="secondary" id="refreshBtn">Actualizar panel</button>
            </div>
            <div class="output" id="output">Esperando acción...</div>
          </div>
        </article>
        <article class="panel">
          <div class="panel-body stack">
            <div>
              <h2>Subbots activos</h2>
              <p class="lead">Sesiones creadas desde WhatsApp y desde la web.</p>
            </div>
            <div class="subbot-list" id="subbots"></div>
          </div>
        </article>
      </section>
      <section class="panel" style="margin-top: 18px;">
        <div class="panel-body stack">
          <div>
            <h2>20 funciones para seguir creciendo</h2>
            <p class="lead">Esto ya te deja una hoja de ruta concreta para convertirlo en un panel admin más completo.</p>
          </div>
          <div class="ideas">${ideasMarkup}</div>
        </div>
      </section>
    </div>
    <script>
      const cardsEl = document.getElementById("cards");
      const subbotsEl = document.getElementById("subbots");
      const outputEl = document.getElementById("output");
      const startBtn = document.getElementById("startBtn");
      const refreshBtn = document.getElementById("refreshBtn");
      const phoneEl = document.getElementById("phone");
      const logoutBtn = document.getElementById("logoutBtn");

      function escapeHtml(text) {
        return String(text)
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;")
          .replace(/'/g, "&#39;");
      }

      async function safeJson(res) {
        const text = await res.text();
        if (!text) {
          return { error: "El servidor devolvió una respuesta vacía." };
        }
        try {
          return JSON.parse(text);
        } catch {
          return { error: text };
        }
      }

      async function api(path, options = {}) {
        const res = await fetch(path, options);
        const json = await safeJson(res);
        if (!res.ok) {
          throw new Error(json.error || "Solicitud fallida.");
        }
        return json;
      }

      function renderCards(state) {
        const items = [
          ["Bot", state.bot.botName || "Ghost-Bot"],
          ["Estado", state.bot.status || "starting"],
          ["Comandos", String(state.bot.commands || 0)],
          ["Uptime", state.uptime || "0h 0m 0s"],
          ["Subbots", String((state.subbots || []).length)]
        ];

        cardsEl.innerHTML = items.map(([label, value]) => \`
          <div class="card">
            <div class="kicker">\${escapeHtml(label)}</div>
            <div class="metric">\${escapeHtml(value)}</div>
          </div>
        \`).join("");
      }

      function renderSubbots(items) {
        if (!items.length) {
          subbotsEl.innerHTML = '<div class="subbot">Todavía no hay subbots activos.</div>';
          return;
        }

        subbotsEl.innerHTML = items.map((item) => \`
          <div class="subbot">
            <div class="subbot-top">
              <strong>\${escapeHtml(item.phone)}</strong>
              <span class="badge">\${escapeHtml(item.status)}</span>
            </div>
            \${item.pairingCode ? \`<div class="code">\${escapeHtml(item.pairingCode)}</div>\` : ""}
            \${item.error ? \`<div class="note">Error: \${escapeHtml(item.error)}</div>\` : ""}
            <div class="note">Actualizado: \${new Date(item.updatedAt).toLocaleString()}</div>
            <div class="actions" style="margin-top: 12px;">
              <button class="secondary" data-stop="\${escapeHtml(item.phone)}">Apagar subbot</button>
            </div>
          </div>
        \`).join("");

        document.querySelectorAll("[data-stop]").forEach((button) => {
          button.addEventListener("click", async () => {
            const phone = button.getAttribute("data-stop");
            button.disabled = true;
            outputEl.textContent = "Apagando subbot...";
            try {
              const json = await api("/api/subbot/stop", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ phone })
              });
              outputEl.textContent = json.message;
              await refreshStatus();
            } catch (error) {
              outputEl.textContent = "Error: " + error.message;
            } finally {
              button.disabled = false;
            }
          });
        });
      }

      async function refreshStatus() {
        const data = await api("/api/status");
        renderCards(data);
        renderSubbots(data.subbots || []);
      }

      startBtn.addEventListener("click", async () => {
        const phone = phoneEl.value.trim();
        if (!phone) {
          outputEl.textContent = "Ingresá un número primero.";
          return;
        }

        startBtn.disabled = true;
        outputEl.textContent = "Generando subbot y esperando código de emparejamiento...";

        try {
          const json = await api("/api/subbot/start", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ phone })
          });

          outputEl.textContent =
            "Subbot creado correctamente.\\n\\n" +
            "Número: " + json.phone + "\\n\\n" +
            "Código:\\n" +
            json.pairingCode;

          phoneEl.value = "";
          await refreshStatus();
        } catch (error) {
          outputEl.textContent = "Error: " + error.message;
        } finally {
          startBtn.disabled = false;
        }
      });

      refreshBtn.addEventListener("click", refreshStatus);
      logoutBtn.addEventListener("click", async () => {
        try {
          await api("/api/logout", { method: "POST" });
        } catch {}
        window.location.reload();
      });

      refreshStatus().catch((error) => {
        outputEl.textContent = "Error inicial: " + error.message;
      });
      setInterval(() => {
        refreshStatus().catch(() => {});
      }, 12000);
    </script>
  </body>
</html>`;
}

export function startWebServer({ port, host, getBotContext, config }) {
  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

      if (req.method === "GET" && url.pathname === "/") {
        if (!isAuthenticated(req)) {
          return sendHtml(res, renderLoginPage());
        }
        return sendHtml(res, renderDashboard());
      }

      if (req.method === "POST" && url.pathname === "/api/login") {
        const body = await readBody(req);
        if (body.user !== config.adminUser || body.pass !== config.adminPass) {
          return sendJson(res, 401, { error: "Credenciales inválidas." });
        }

        const token = createSession();
        return sendJson(
          res,
          200,
          { ok: true },
          {
            "Set-Cookie": `ghost_admin_session=${token}; HttpOnly; Path=/; Max-Age=${60 * 60 * 12}; SameSite=Lax`
          }
        );
      }

      if (req.method === "POST" && url.pathname === "/api/logout") {
        clearSession(req, res);
        return sendJson(res, 200, { ok: true });
      }

      if (req.method === "GET" && url.pathname === "/health") {
        return sendJson(res, 200, { ok: true });
      }

      if (url.pathname.startsWith("/api/") && !requireAuth(req, res)) {
        return;
      }

      if (req.method === "GET" && url.pathname === "/api/status") {
        const state = getAppState();
        return sendJson(res, 200, {
          ...state,
          uptime: formatUptime(state.startedAt),
          subbots: listSubbots(),
          adminIdeas
        });
      }

      if (req.method === "POST" && url.pathname === "/api/subbot/start") {
        const body = await readBody(req);
        const context = getBotContext?.();

        if (!context?.client) {
          return sendJson(res, 503, {
            error: "El bot principal todavía no está listo."
          });
        }

        const result = await startSubbot({
          phone: body.phone || "",
          mainClient: context.client,
          config: context.config,
          MessageMedia: context.MessageMedia,
          fs: context.fs,
          path: context.path,
          cacheDir: context.cacheDir,
          ownerChat: "",
          notifyOwner: false
        });

        return sendJson(res, 200, {
          ok: true,
          phone: result.phone,
          pairingCode: result.pairingCode
        });
      }

      if (req.method === "POST" && url.pathname === "/api/subbot/stop") {
        const body = await readBody(req);
        await stopSubbot(body.phone || "");
        return sendJson(res, 200, {
          ok: true,
          message: "Subbot apagado correctamente."
        });
      }

      sendJson(res, 404, { error: "Ruta no encontrada." });
    } catch (error) {
      sendJson(res, 500, {
        error: error?.message || "Error interno del panel."
      });
    }
  });

  server.listen(port, host, () => {
    patchWebState({
      status: "ready",
      url: `http://${host === "0.0.0.0" ? "localhost" : host}:${port}`
    });
  });

  server.on("error", () => {
    patchWebState({ status: "error" });
  });

  return server;
}
