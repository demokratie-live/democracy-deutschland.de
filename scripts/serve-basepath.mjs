/**
 * Serves out/ below a basePath like GitHub Pages serves the project site
 * (https://demokratie-live.github.io/democracy-deutschland.de/).
 * Usage: node scripts/serve-basepath.mjs [port] [basePath]
 */
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";

const port = Number(process.argv[2] ?? 3101);
const basePath = process.argv[3] ?? "/democracy-deutschland.de";
const root = path.resolve("out");

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".ttf": "font/ttf",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".eot": "application/vnd.ms-fontobject",
  ".mp4": "video/mp4",
  ".txt": "text/plain",
};

async function isFile(file) {
  try {
    return (await stat(file)).isFile();
  } catch {
    return false;
  }
}

function send(res, status, file) {
  res.writeHead(status, {
    "Content-Type": TYPES[path.extname(file)] ?? "application/octet-stream",
  });
  createReadStream(file).pipe(res);
}

createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost");
  const pathname = decodeURIComponent(url.pathname);
  if (pathname !== basePath && !pathname.startsWith(`${basePath}/`)) {
    res.writeHead(404).end("outside basePath");
    return;
  }
  const rel = pathname.slice(basePath.length) || "/";
  const file = path.join(root, rel);
  if (!file.startsWith(root)) {
    res.writeHead(403).end();
    return;
  }
  if (rel.endsWith("/") && (await isFile(path.join(file, "index.html")))) {
    return send(res, 200, path.join(file, "index.html"));
  }
  if (await isFile(file)) return send(res, 200, file);
  if (await isFile(path.join(file, "index.html"))) {
    res.writeHead(301, { Location: `${pathname}/${url.search}` }).end();
    return;
  }
  send(res, 404, path.join(root, "404.html"));
}).listen(port, () => console.log(`http://localhost:${port}${basePath}/`));
