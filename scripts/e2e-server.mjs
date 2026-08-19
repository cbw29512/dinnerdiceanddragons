import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";

const HOST = "127.0.0.1";
const PORT = Number.parseInt(process.env.PORT || "4173", 10);
const ROOT = process.cwd();
const ROOT_PREFIX = `${resolve(ROOT)}${sep}`;

const MIME_TYPES = Object.freeze({
  ".css": "text/css; charset=utf-8",
  ".gif": "image/gif",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".xml": "application/xml; charset=utf-8"
});

function sendJson(response, status, payload) {
  const body = JSON.stringify(payload);
  response.writeHead(status, {
    "Cache-Control": "no-store",
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body)
  });
  response.end(body);
}

function safePath(pathname) {
  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  const relative = decoded.replace(/^\/+/, "") || "index.html";
  const candidate = resolve(ROOT, relative);
  if (candidate !== resolve(ROOT) && !candidate.startsWith(ROOT_PREFIX)) return null;
  return candidate;
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url || "/", `http://${request.headers.host || `${HOST}:${PORT}`}`);

  // Netlify Identity is server-backed in production. Browser tests need the
  // same clean anonymous-session contract instead of a Python static-server 404.
  if (url.pathname === "/api/v1/auth/session" && request.method === "GET") {
    sendJson(response, 200, { authenticated: false });
    return;
  }

  if (url.pathname.startsWith("/api/")) {
    sendJson(response, 404, { detail: "No browser-test API fixture is installed for this route." });
    return;
  }

  let filePath = safePath(url.pathname);
  if (!filePath) {
    response.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Bad request");
    return;
  }

  try {
    const details = await stat(filePath);
    if (details.isDirectory()) filePath = resolve(filePath, "index.html");
    const body = await readFile(filePath);
    response.writeHead(200, {
      "Cache-Control": "no-store",
      "Content-Type": MIME_TYPES[extname(filePath).toLowerCase()] || "application/octet-stream",
      "Content-Length": body.length
    });
    if (request.method === "HEAD") response.end();
    else response.end(body);
  } catch {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
  }
});

server.listen(PORT, HOST, () => {
  console.log(`DDD browser-test server listening on http://${HOST}:${PORT}`);
});
