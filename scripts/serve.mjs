import http from "node:http";
import { loadPublicConfiguration, loadOperations, configureDocument } from "./configuration.mjs";
import { readFile, stat } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
const root = resolve(process.argv.includes("--dist") ? "dist" : ".");
const port = Number(process.env.PORT || 4173);
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
};
const server = http.createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(
      new URL(req.url, "http://localhost").pathname
    );
    if (
      pathname
        .split("/")
        .some(
          (p) =>
            p.startsWith(".") ||
            ["appednix", "api", "tests", "scripts", "docs", "config"].includes(
              p
            )
        )
    ) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    const relative =
      pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
    let target = resolve(root, relative);
    if (!process.argv.includes("--dist") && relative === "src/pdf-export.js")
      target = resolve(".local/frontend/pdf-export.js");
    if (!target.startsWith(root + sep)) {
      res.writeHead(403);
      res.end("Forbidden");
      return;
    }
    try {
      await stat(target);
    } catch {
      target = resolve(root, "public", relative);
    }
    let body = await readFile(target);
    if (!process.argv.includes("--dist") && relative === "index.html")
      body = Buffer.from(
        configureDocument(body.toString(), await loadOperations())
          .replace(
            "</head>",
            `<script type="application/json" id="site-config">${JSON.stringify(
              await loadPublicConfiguration()
            ).replaceAll("<", "\\u003c")}</script></head>`
          )
      );
    if (!process.argv.includes("--dist") && relative === "site-config.json")
      body = Buffer.from(JSON.stringify(await loadPublicConfiguration()));
    res.writeHead(200, {
      "Content-Type": types[extname(target)] || "application/octet-stream",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "strict-origin-when-cross-origin",
    });
    res.end(body);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Not found");
  }
});
server.listen(port, "127.0.0.1", () =>
  console.log(`SAP Service preview: http://127.0.0.1:${port}`)
);
