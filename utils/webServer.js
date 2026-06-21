import http from "http";
import { getAppState, patchWebState } from "./appState.js";
import { listSubbots, startSubbot, stopSubbot } from "./subbotManager.js";

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(body);
}

function sendHtml(res, html) {
  res.writeHead(200, {
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(html);
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

function renderPage() {
  return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Ghost Bot Pairing</title>
    <style>
      :root {
        --bg: #08101d;
        --panel: rgba(12, 20, 35, 0.84);
        --panel-soft: rgba(15, 23, 42, 0.72);
        --line: rgba(148, 163, 184, 0.18);
        --text: #e7eefc;
        --muted: #9ab0cd;
        --accent: #2dd4bf;
        --accent2: #7dd3fc;
      }

      * { box-sizing: border-box; }

      body {
        margin: 0;
        min-height: 100vh;
        font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif;
        color: var(--text);
        background:
          radial-gradient(circle at top left, rgba(45, 212, 191, 0.22), transparent 30%),
          radial-gradient(circle at bottom right, rgba(125, 211, 252, 0.18), transparent 24%),
          linear-gradient(160deg, #06101d 0%, #0a1220 46%, #111827 100%);
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

      .shell {
        width: min(1080px, calc(100vw - 24px));
        margin: 18px auto;
        position: relative;
        z-index: 1;
      }

      .hero,
      .panel {
        border: 1px solid var(--line);
        border-radius: 28px;
        background: var(--panel);
        box-shadow: 0 24px 60px rgba(0, 0, 0, 0.3);
        backdrop-filter: blur(18px);
      }

      .hero {
        padding: 26px;
      }

      .eyebrow {
        display: inline-flex;
        gap: 8px;
        align-items: center;
        padding: 8px 12px;
        border-radius: 999px;
        border: 1px solid rgba(45, 212, 191, 0.22);
        background: rgba(45, 212, 191, 0.08);
        color: #b8fff6;
        font-size: 0.85rem;
      }

      h1 {
        margin: 16px 0 10px;
        font-size: clamp(2.2rem, 7vw, 4.6rem);
        line-height: 0.95;
        max-width: 11ch;
      }

      .lead {
        max-width: 62ch;
        color: var(--muted);
        font-size: 1.04rem;
      }

      .cards {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 14px;
        margin-top: 20px;
      }

      .card {
        padding: 18px;
        border-radius: 20px;
        background: var(--panel-soft);
        border: 1px solid rgba(148, 163, 184, 0.12);
      }

      .kicker {
        color: var(--muted);
        font-size: 0.82rem;
        text-transform: uppercase;
        letter-spacing: 0.08em;
      }

      .metric {
        margin-top: 8px;
        font-size: 1.45rem;
        font-weight: 700;
      }

      .grid {
        display: grid;
        grid-template-columns: 1.05fr 0.95fr;
        gap: 18px;
        margin-top: 18px;
      }

      .panel-body {
        padding: 22px;
      }

      .stack {
        display: grid;
        gap: 16px;
      }

      label {
        display: grid;
        gap: 8px;
        font-weight: 600;
      }

      input {
        width: 100%;
        padding: 14px 16px;
        border-radius: 16px;
        border: 1px solid rgba(148, 163, 184, 0.2);
        background: rgba(7, 13, 24, 0.88);
        color: var(--text);
      }

      .actions {
        display: flex;
        gap: 12px;
        flex-wrap: wrap;
      }

      button {
        border: 0;
        border-radius: 16px;
        padding: 14px 18px;
        font-weight: 800;
        cursor: pointer;
      }

      .primary {
        color: #071017;
        background: linear-gradient(135deg, var(--accent), var(--accent2));
      }

      .secondary {
        color: var(--text);
        background: rgba(17, 24, 39, 0.9);
        border: 1px solid rgba(148, 163, 184, 0.18);
      }

      .output {
        min-height: 190px;
        padding: 18px;
        border-radius: 18px;
        background: rgba(6, 10, 18, 0.92);
        border: 1px solid rgba(148, 163, 184, 0.12);
        font-family: Consolas, "Courier New", monospace;
        white-space: pre-wrap;
      }

      .subbot {
        padding: 16px;
        border-radius: 18px;
        border: 1px solid rgba(148, 163, 184, 0.14);
        background: rgba(9, 15, 27, 0.82);
      }

      .subbot-top {
        display: flex;
        justify-content: space-between;
        gap: 10px;
        align-items: center;
      }

      .badge {
        display: inline-flex;
        align-items: center;
        padding: 6px 10px;
        border-radius: 999px;
        border: 1px solid rgba(148, 163, 184, 0.16);
        background: rgba(17, 24, 39, 0.85);
        font-size: 0.82rem;
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
        letter-spacing: 0.15em;
        font-weight: 800;
      }

      .note {
        margin-top: 12px;
        color: var(--muted);
        font-size: 0.92rem;
      }

      @media (max-width: 980px) {
        .grid { grid-template-columns: 1fr; }
        .cards { grid-template-columns: repeat(2, 1fr); }
      }

      @media (max-width: 640px) {
        .shell { width: min(100vw - 16px, 1080px); margin: 8px auto 18px; }
        .hero, .panel-body { padding: 18px; }
        .cards { grid-template-columns: 1fr; }
        .actions { flex-direction: column; }
        button { width: 100%; }
      }
    </style>
  </head>
  <body>
    <div class="shell">
      <section class="hero">
        <div class="eyebrow">Ghost Bot • Pairing Web</div>
        <h1>Emparejá tu subbot desde la web.</h1>
        <p class="lead">
          Poné tu número con código de país y generá el código de vinculación sin usar el chat.
          Si algo falla, esta página te muestra el error real.
        </p>
        <div class="cards" id="cards"></div>
      </section>

      <section class="grid">
        <article class="panel">
          <div class="panel-body stack">
            <div>
              <h2>Vincular número</h2>
              <p class="lead">Ejemplo: <code>549112345678</code>. Sin <code>+</code>, sin espacios y sin guiones.</p>
            </div>
            <label>Número de WhatsApp<input id="phone" placeholder="549112345678" autocomplete="off" /></label>
            <div class="actions">
              <button class="primary" id="startBtn">Generar código</button>
              <button class="secondary" id="refreshBtn">Actualizar estado</button>
            </div>
            <div class="output" id="output">Esperando acción...</div>
          </div>
        </article>

        <article class="panel">
          <div class="panel-body stack">
            <div>
              <h2>Sesiones activas</h2>
              <p class="lead">Acá ves los subbots iniciados desde web o desde WhatsApp.</p>
            </div>
            <div id="subbots"></div>
          </div>
        </article>
      </section>
    </div>

    <script>
      const cardsEl = document.getElementById("cards");
      const subbotsEl = document.getElementById("subbots");
      const outputEl = document.getElementById("output");
      const startBtn = document.getElementById("startBtn");
      const refreshBtn = document.getElementById("refreshBtn");
      const phoneEl = document.getElementById("phone");

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
          ["Uptime", state.uptime || "0h 0m 0s"]
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

export function startWebServer({ port, host, getBotContext }) {
  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

      if (req.method === "GET" && url.pathname === "/") {
        return sendHtml(res, renderPage());
      }

      if (req.method === "GET" && url.pathname === "/health") {
        return sendJson(res, 200, { ok: true });
      }

      if (req.method === "GET" && url.pathname === "/api/status") {
        const state = getAppState();
        return sendJson(res, 200, {
          ...state,
          uptime: formatUptime(state.startedAt),
          subbots: listSubbots()
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
