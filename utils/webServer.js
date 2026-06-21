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
    <title>Ghost Bot Panel</title>
    <style>
      :root {
        --bg: #0c111b;
        --bg-soft: #111827;
        --panel: rgba(14, 23, 40, 0.78);
        --panel-strong: rgba(10, 17, 31, 0.92);
        --line: rgba(148, 163, 184, 0.2);
        --text: #e5eefc;
        --muted: #9db0cc;
        --accent: #2dd4bf;
        --accent-2: #60a5fa;
        --danger: #f87171;
        --warning: #fbbf24;
        --shadow: 0 20px 60px rgba(0, 0, 0, 0.35);
      }

      * {
        box-sizing: border-box;
      }

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

      .shell {
        width: min(1180px, calc(100vw - 32px));
        margin: 24px auto;
        position: relative;
        z-index: 1;
      }

      .hero {
        padding: 28px;
        border: 1px solid var(--line);
        border-radius: 28px;
        background: linear-gradient(180deg, rgba(17, 24, 39, 0.85), rgba(8, 16, 29, 0.85));
        box-shadow: var(--shadow);
        overflow: hidden;
        position: relative;
      }

      .hero::after {
        content: "";
        position: absolute;
        inset: auto -80px -80px auto;
        width: 240px;
        height: 240px;
        border-radius: 999px;
        background: radial-gradient(circle, rgba(45, 212, 191, 0.4), transparent 68%);
        filter: blur(10px);
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
        margin: 18px 0 10px;
        font-size: clamp(2.4rem, 8vw, 4.6rem);
        line-height: 0.95;
        max-width: 10ch;
      }

      .lead {
        max-width: 62ch;
        color: var(--muted);
        font-size: 1.05rem;
      }

      .grid {
        display: grid;
        grid-template-columns: 1.2fr 0.8fr;
        gap: 20px;
        margin-top: 20px;
      }

      .panel {
        border: 1px solid var(--line);
        border-radius: 24px;
        background: var(--panel);
        box-shadow: var(--shadow);
        backdrop-filter: blur(18px);
      }

      .panel-body {
        padding: 22px;
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
        background: rgba(15, 23, 42, 0.7);
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
        font-size: 1.55rem;
        font-weight: 700;
      }

      .form-title,
      .section-title {
        margin: 0 0 8px;
        font-size: 1.3rem;
      }

      .section-copy {
        margin: 0;
        color: var(--muted);
      }

      .stack {
        display: grid;
        gap: 16px;
      }

      label {
        display: grid;
        gap: 8px;
        color: #d7e6ff;
        font-weight: 600;
      }

      input {
        width: 100%;
        padding: 14px 16px;
        border-radius: 16px;
        border: 1px solid rgba(148, 163, 184, 0.2);
        background: rgba(7, 13, 24, 0.85);
        color: var(--text);
        outline: none;
      }

      input:focus {
        border-color: rgba(45, 212, 191, 0.7);
        box-shadow: 0 0 0 4px rgba(45, 212, 191, 0.12);
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
        font-weight: 700;
        cursor: pointer;
        transition: transform 0.18s ease, opacity 0.18s ease;
      }

      button:hover {
        transform: translateY(-1px);
      }

      button:disabled {
        opacity: 0.55;
        cursor: not-allowed;
      }

      .primary {
        color: #061017;
        background: linear-gradient(135deg, var(--accent), #7dd3fc);
      }

      .secondary {
        color: var(--text);
        background: rgba(17, 24, 39, 0.9);
        border: 1px solid rgba(148, 163, 184, 0.18);
      }

      .output {
        min-height: 152px;
        padding: 18px;
        border-radius: 18px;
        background: rgba(6, 10, 18, 0.92);
        border: 1px solid rgba(148, 163, 184, 0.12);
        font-family: Consolas, "Courier New", monospace;
        white-space: pre-wrap;
      }

      .code {
        display: inline-block;
        margin-top: 12px;
        padding: 12px 14px;
        border-radius: 14px;
        background: rgba(45, 212, 191, 0.12);
        border: 1px solid rgba(45, 212, 191, 0.25);
        color: #b8fff6;
        font-size: 1.7rem;
        letter-spacing: 0.15em;
        font-weight: 800;
      }

      .list {
        display: grid;
        gap: 12px;
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
        gap: 12px;
        align-items: center;
      }

      .badge {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 6px 10px;
        border-radius: 999px;
        font-size: 0.82rem;
        border: 1px solid rgba(148, 163, 184, 0.16);
        background: rgba(17, 24, 39, 0.85);
      }

      .footer-note {
        margin-top: 12px;
        color: var(--muted);
        font-size: 0.92rem;
      }

      @media (max-width: 980px) {
        .grid {
          grid-template-columns: 1fr;
        }

        .cards {
          grid-template-columns: repeat(2, 1fr);
        }
      }

      @media (max-width: 640px) {
        .shell {
          width: min(100vw - 20px, 1180px);
          margin: 10px auto 18px;
        }

        .hero,
        .panel-body {
          padding: 18px;
        }

        .cards {
          grid-template-columns: 1fr;
        }

        .actions {
          flex-direction: column;
        }

        button {
          width: 100%;
        }
      }
    </style>
  </head>
  <body>
    <div class="shell">
      <section class="hero">
        <div class="eyebrow">Ghost Bot Panel • Render Ready</div>
        <h1>Conectá subbots desde la web.</h1>
        <p class="lead">
          Pedí el código de emparejamiento, mirá el estado del bot y administrá sesiones sin depender del chat.
        </p>
        <div class="cards" id="cards"></div>
      </section>

      <section class="grid">
        <article class="panel">
          <div class="panel-body stack">
            <div>
              <h2 class="form-title">Crear subbot</h2>
              <p class="section-copy">
                Ingresá un número con código de país. El panel va a generar el código de emparejamiento para vincularlo desde WhatsApp.
              </p>
            </div>

            <label>
              Número de WhatsApp
              <input id="phone" placeholder="549112345678" autocomplete="off" />
            </label>

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
              <h2 class="section-title">Subbots activos</h2>
              <p class="section-copy">Las sesiones generadas desde WhatsApp y desde la web aparecen acá.</p>
            </div>
            <div class="list" id="subbots"></div>
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

      function renderCards(state) {
        const items = [
          ["Bot", state.bot.botName || "Ghost-Bot"],
          ["Estado", state.bot.status || "starting"],
          ["Comandos", String(state.bot.commands || 0)],
          ["Uptime", state.uptime || "0h 0m 0s"]
        ];

        cardsEl.innerHTML = items
          .map(([label, value]) => \`
            <div class="card">
              <div class="kicker">\${escapeHtml(label)}</div>
              <div class="metric">\${escapeHtml(value)}</div>
            </div>
          \`)
          .join("");
      }

      function renderSubbots(items) {
        if (!items.length) {
          subbotsEl.innerHTML = '<div class="subbot">Todavía no hay subbots activos.</div>';
          return;
        }

        subbotsEl.innerHTML = items
          .map((item) => \`
            <div class="subbot">
              <div class="subbot-top">
                <strong>\${escapeHtml(item.phone)}</strong>
                <span class="badge">\${escapeHtml(item.status)}</span>
              </div>
              \${item.pairingCode ? \`<div class="code">\${escapeHtml(item.pairingCode)}</div>\` : ""}
              \${item.error ? \`<div class="footer-note">Error: \${escapeHtml(item.error)}</div>\` : ""}
              <div class="footer-note">Actualizado: \${new Date(item.updatedAt).toLocaleString()}</div>
              <div class="actions" style="margin-top: 12px;">
                <button class="secondary" data-stop="\${escapeHtml(item.phone)}">Apagar subbot</button>
              </div>
            </div>
          \`)
          .join("");

        document.querySelectorAll("[data-stop]").forEach((button) => {
          button.addEventListener("click", async () => {
            const phone = button.getAttribute("data-stop");
            button.disabled = true;
            outputEl.textContent = "Apagando subbot...";
            try {
              const res = await fetch("/api/subbot/stop", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ phone })
              });
              const json = await res.json();
              if (!res.ok) throw new Error(json.error || "No se pudo apagar.");
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
        const res = await fetch("/api/status");
        const data = await res.json();
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
          const res = await fetch("/api/subbot/start", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ phone })
          });
          const json = await res.json();
          if (!res.ok) throw new Error(json.error || "No se pudo generar el código.");

          outputEl.innerHTML =
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
      refreshStatus();
      setInterval(refreshStatus, 12000);
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

      if (req.method === "GET" && url.pathname === "/health") {
        return sendJson(res, 200, { ok: true });
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
