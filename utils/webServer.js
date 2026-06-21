import http from "http";
import { getAppState } from "./appState.js";

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(JSON.stringify(payload));
}

function sendHtml(res, html) {
  res.writeHead(200, {
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(html);
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
    <title>Ghost Bot Status</title>
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

      .hero, .panel {
        border: 1px solid var(--line);
        border-radius: 28px;
        background: var(--panel);
        box-shadow: 0 24px 60px rgba(0, 0, 0, 0.3);
        backdrop-filter: blur(18px);
      }

      .hero { padding: 26px; }

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
        max-width: 10ch;
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

      .card, .detail {
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

      .panel {
        margin-top: 18px;
      }

      .panel-body {
        padding: 22px;
      }

      .details {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 14px;
      }

      .detail-label {
        color: var(--muted);
        font-size: 0.86rem;
      }

      .detail-value {
        margin-top: 8px;
        word-break: break-word;
        font-weight: 600;
      }

      @media (max-width: 980px) {
        .cards, .details { grid-template-columns: repeat(2, 1fr); }
      }

      @media (max-width: 640px) {
        .shell { width: min(100vw - 16px, 1080px); margin: 8px auto 18px; }
        .hero, .panel-body { padding: 18px; }
        .cards, .details { grid-template-columns: 1fr; }
      }
    </style>
  </head>
  <body>
    <div class="shell">
      <section class="hero">
        <div class="eyebrow">Ghost Bot • Status Web</div>
        <h1>Estado del bot en vivo.</h1>
        <p class="lead">Una pagina simple para ver si el bot esta levantado, cuanto tiempo lleva activo y algunos detalles tecnicos utiles.</p>
        <div class="cards" id="cards"></div>
      </section>

      <section class="panel">
        <div class="panel-body">
          <div class="details" id="details"></div>
        </div>
      </section>
    </div>

    <script>
      const cardsEl = document.getElementById("cards");
      const detailsEl = document.getElementById("details");

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
        if (!text) return { error: "Respuesta vacia." };
        try {
          return JSON.parse(text);
        } catch {
          return { error: text };
        }
      }

      async function refreshStatus() {
        const res = await fetch("/api/status");
        const data = await safeJson(res);
        if (!res.ok) throw new Error(data.error || "No se pudo leer el estado.");

        const items = [
          ["Bot", data.bot.botName || "Ghost-Bot"],
          ["Estado", data.bot.status || "starting"],
          ["Comandos", String(data.bot.commands || 0)],
          ["Uptime", data.uptime || "0h 0m 0s"]
        ];

        cardsEl.innerHTML = items.map(([label, value]) => \`
          <div class="card">
            <div class="kicker">\${escapeHtml(label)}</div>
            <div class="metric">\${escapeHtml(value)}</div>
          </div>
        \`).join("");

        const details = [
          ["Provider", data.bot.provider || "-"],
          ["Owner", data.bot.ownerName || "-"],
          ["Node", data.bot.node || "-"],
          ["Plataforma", data.bot.platform || "-"],
          ["Auth", data.bot.authPath || "-"],
          ["Inicio", new Date(data.startedAt).toLocaleString()]
        ];

        detailsEl.innerHTML = details.map(([label, value]) => \`
          <div class="detail">
            <div class="detail-label">\${escapeHtml(label)}</div>
            <div class="detail-value">\${escapeHtml(value)}</div>
          </div>
        \`).join("");
      }

      refreshStatus().catch(() => {});
      setInterval(() => {
        refreshStatus().catch(() => {});
      }, 10000);
    </script>
  </body>
</html>`;
}

export function startWebServer({ port, host }) {
  const server = http.createServer((req, res) => {
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
        uptime: formatUptime(state.startedAt)
      });
    }

    return sendJson(res, 404, { error: "Ruta no encontrada." });
  });

  server.listen(port, host);
  return server;
}
