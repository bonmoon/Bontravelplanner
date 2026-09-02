import { readdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { build } from "vite";

await build();

const root = process.cwd();
const assetDirectory = resolve(root, "dist/assets");
const serviceWorkerPath = resolve(root, "dist/sw.js");
const assets = (await readdir(assetDirectory)).map((name) => `./assets/${name}`).sort();
const shell = ["./", "./index.html", "./manifest.webmanifest", "./icons/app-icon.svg", ...assets];
const serviceWorker = await readFile(serviceWorkerPath, "utf8");
const injected = serviceWorker.replace(/const SHELL = \[[^;]+\];/, `const SHELL = ${JSON.stringify(shell)};`);
await writeFile(serviceWorkerPath, injected);

const builtIndexPath = resolve(root, "dist/index.html");
const builtIndex = await readFile(builtIndexPath, "utf8");
const cssMatch = builtIndex.match(/<link rel="stylesheet"[^>]+href="([^"]+)"[^>]*>/);
const scriptMatch = builtIndex.match(/<script type="module"[^>]+src="([^"]+)"[^>]*><\/script>/);
if (!cssMatch || !scriptMatch) throw new Error("The built page is missing its stylesheet or script");
const cssPath = resolve(root, "dist", cssMatch[1].replace(/^\.\//, ""));
const scriptPath = resolve(root, "dist", scriptMatch[1].replace(/^\.\//, ""));
const [css, script] = await Promise.all([readFile(cssPath, "utf8"), readFile(scriptPath, "utf8")]);
const safeScript = script.replace(/<\/script/gi, "<\\/script");
const standalone = builtIndex
  .replace(/<script id="file-launcher">[\s\S]*?<\/script>/, "")
  .replace(cssMatch[0], () => `<style>${css}</style>`)
  .replace(scriptMatch[0], () => `<script type="module">${safeScript}</script>`)
  .replace(/<link rel="manifest"[^>]*>/, "")
  .replace(/<link rel="icon"[^>]*>/, "");
await writeFile(resolve(root, "旅卡排版室-双击预览.html"), standalone);
