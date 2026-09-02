import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { spawn } from "node:child_process";

const preferredPort = Number(process.env.TRAVEL_CARD_PORT || 4173);
const root = resolve(process.cwd(), "dist");
const types = { ".css": "text/css; charset=utf-8", ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8", ".png": "image/png", ".svg": "image/svg+xml", ".webmanifest": "application/manifest+json" };

function cors(response) {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
  response.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
}

function decodeHtml(value = "") {
  return value.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
}

function metaContent(html, key, value) {
  const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = [
    new RegExp(`<meta[^>]+${key}=["']${escaped}["'][^>]+content=["']([^"']+)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+${key}=["']${escaped}["']`, "i"),
  ];
  for (const pattern of patterns) {
    const found = html.match(pattern)?.[1];
    if (found) return decodeHtml(found);
  }
  return "";
}

async function musicMetadata(request, response) {
  cors(response);
  if (request.method === "OPTIONS") return response.writeHead(204).end();
  if (request.method !== "GET") return response.writeHead(405).end("Method Not Allowed");
  try {
    const incoming = new URL(request.url || "/", "http://localhost").searchParams.get("url") || "";
    const target = new URL(incoming);
    const allowed = new Set(["music.youtube.com", "youtube.com", "www.youtube.com", "youtu.be"]);
    if (target.protocol !== "https:" || !allowed.has(target.hostname)) throw new Error("Unsupported music URL");
    const upstream = await fetch(target, { headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/126 Safari/537.36", "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8" }, redirect: "follow", signal: AbortSignal.timeout(12_000) });
    if (!upstream.ok) throw new Error(`YouTube returned ${upstream.status}`);
    const html = await upstream.text();
    const coverUrl = metaContent(html, "property", "og:image") || metaContent(html, "name", "twitter:image");
    const title = metaContent(html, "property", "og:title") || metaContent(html, "name", "title");
    response.writeHead(200, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
    response.end(JSON.stringify({ coverUrl, title }));
  } catch (error) {
    response.writeHead(422, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
    response.end(JSON.stringify({ error: error instanceof Error ? error.message : "Music metadata failed" }));
  }
}

async function proxyDeepSeek(request, response) {
  cors(response);
  if (request.method === "OPTIONS") return response.writeHead(204).end();
  if (request.method !== "POST" && request.method !== "GET") return response.writeHead(405).end("Method Not Allowed");
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 5 * 1024 * 1024) return response.writeHead(413).end("Request Too Large");
    chunks.push(chunk);
  }
  try {
    const path = (request.url || "").replace(/^\/api\/deepseek/, "") || "/chat/completions";
    const startedAt = Date.now();
    const upstream = await fetch(`https://api.deepseek.com${path}`, {
      method: request.method,
      headers: { "Content-Type": "application/json", Authorization: request.headers.authorization || "" },
      body: request.method === "POST" ? Buffer.concat(chunks) : undefined,
    });
    console.log(`${request.method} ${path} → ${upstream.status} · ${Date.now() - startedAt}ms`);
    response.writeHead(upstream.status, { "Content-Type": upstream.headers.get("content-type") || "application/json; charset=utf-8" });
    response.end(Buffer.from(await upstream.arrayBuffer()));
  } catch {
    response.writeHead(502, { "Content-Type": "application/json; charset=utf-8" });
    response.end(JSON.stringify({ error: { message: "DeepSeek connection failed" } }));
  }
}

async function serveFile(request, response) {
  const url = new URL(request.url || "/", "http://localhost");
  const relative = decodeURIComponent(url.pathname).replace(/^\/+/, "") || "index.html";
  let path = resolve(root, relative);
  if (!path.startsWith(`${root}${sep}`) && path !== root) return response.writeHead(403).end("Forbidden");
  try {
    if ((await stat(path)).isDirectory()) path = resolve(path, "index.html");
    const data = await readFile(path);
    response.writeHead(200, { "Content-Type": types[extname(path)] || "application/octet-stream", "Cache-Control": "no-cache" });
    response.end(data);
  } catch {
    const data = await readFile(resolve(root, "index.html"));
    response.writeHead(200, { "Content-Type": types[".html"], "Cache-Control": "no-cache" });
    response.end(data);
  }
}

function createTravelServer() {
  return createServer((request, response) => {
  if ((request.url || "").startsWith("/api/deepseek")) void proxyDeepSeek(request, response);
  else if ((request.url || "").startsWith("/api/music-metadata")) void musicMetadata(request, response);
  else void serveFile(request, response);
  });
}

function listen(port, attempts = 0) {
  const server = createTravelServer();
  server.once("error", (error) => {
    if ((error.code === "EADDRINUSE" || error.code === "EACCES" || error.code === "EPERM") && attempts < 8) return listen(port + 1, attempts + 1);
    console.error(`本地连接启动失败：${error.message}`);
    console.error("请在系统设置中允许 Terminal 接受传入连接，然后重新双击“启动旅卡”。");
    process.exitCode = 1;
  });
  server.listen(port, "127.0.0.1", () => {
    const url = `http://127.0.0.1:${port}`;
    console.log(`旅卡排版室已打开：${url}`);
    if (process.platform === "darwin" && !process.argv.includes("--no-open")) spawn("open", [url], { stdio: "ignore", detached: true }).unref();
  });
}

listen(preferredPort);
