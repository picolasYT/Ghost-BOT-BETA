import http from "http";

export function startWebServer(port) {
  const server = http.createServer((req, res) => {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Hello world</title>
    <style>
      :root {
        color-scheme: light;
      }

      * {
        box-sizing: border-box;
      }

      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        background:
          radial-gradient(circle at top, #8ec5fc 0%, transparent 40%),
          linear-gradient(135deg, #f6f9fc 0%, #d7e1ec 100%);
        font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif;
        color: #183153;
      }

      main {
        padding: 40px 48px;
        border-radius: 24px;
        background: rgba(255, 255, 255, 0.85);
        box-shadow: 0 18px 40px rgba(24, 49, 83, 0.12);
        text-align: center;
      }

      h1 {
        margin: 0 0 12px;
        font-size: clamp(2rem, 6vw, 3.5rem);
      }

      p {
        margin: 0;
        font-size: 1.05rem;
      }
    </style>
  </head>
  <body>
    <main>
      <h1>Hello world (:</h1>
      <p>Ghost-Bot web local encendida.</p>
    </main>
  </body>
</html>`);
  });

  server.listen(port, "127.0.0.1");
  return server;
}
