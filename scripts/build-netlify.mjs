import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const OUT = path.join(ROOT, "dist");
const OLD_API_ORIGIN = "https://dinnerdiceanddragons.vercel.app";
const OLD_SITE_ORIGIN = "https://cbw29512.github.io/dinnerdiceanddragons";
const SOURCE_AUTH_ROUTE = "/.netlify/functions/api/v1/auth/";
const DEPLOYED_AUTH_ROUTE = "/auth-api/v1/auth/";
const SUPABASE_MARKERS = ["supabase.co", "sb_publishable_", "SUPABASE_SECRET_KEY"];
const DEMO_GAME_MARKERS = ["Shadows Over Florence", "The Lighthouse at Blackwater", "Trouble Below the Old Road"];
const REQUIRED_FILES = [
  "index.html",
  "join.html",
  "venues.html",
  "production-config.js",
  "production-api-client.js",
  "sitemap.xml"
];
const EXCLUDED_DIRS = new Set([
  ".git",
  ".github",
  ".venv",
  "apps-script",
  "backend",
  "dist",
  "docs",
  "e2e",
  "games",
  "netlify",
  "node_modules",
  "playwright-report",
  "scripts",
  "supabase",
  "test-results",
  "tests"
]);
const EXCLUDED_FILES = new Set([
  "dashboard-prototype.html",
  "package.json",
  "package-lock.json",
  "playwright.config.js",
  "location-matching-notes.txt"
]);
const PUBLIC_EXTENSIONS = new Set([
  ".html", ".css", ".js", ".json", ".xml", ".svg", ".png", ".jpg", ".jpeg",
  ".webp", ".gif", ".avif", ".ico", ".woff", ".woff2", ".webmanifest"
]);
const TEXT_EXTENSIONS = new Set([".html", ".css", ".js", ".json", ".xml", ".svg", ".webmanifest"]);

function normalizedDeployUrl() {
  const raw = String(process.env.URL || "").trim();
  if (!raw) return "";
  const url = new URL(raw);
  if (url.protocol !== "https:") throw new Error("Netlify URL must use HTTPS.");
  return url.origin;
}

function transformText(relativePath, text, deployUrl) {
  let output = text.replaceAll(` ${OLD_API_ORIGIN}`, "");
  if (deployUrl) output = output.replaceAll(OLD_SITE_ORIGIN, deployUrl);
  if (relativePath === "production-auth.js") {
    output = output.replaceAll(SOURCE_AUTH_ROUTE, DEPLOYED_AUTH_ROUTE);
  }
  return output;
}

async function copyPublicFiles(currentDir = ROOT, relativeDir = "", deployUrl = "") {
  let copied = 0;
  const entries = await readdir(currentDir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    const relativePath = path.posix.join(relativeDir.replaceAll("\\", "/"), entry.name);
    const sourcePath = path.join(currentDir, entry.name);

    if (entry.isDirectory()) {
      if (EXCLUDED_DIRS.has(entry.name)) continue;
      copied += await copyPublicFiles(sourcePath, relativePath, deployUrl);
      continue;
    }
    if (!entry.isFile()) continue;
    if (EXCLUDED_FILES.has(relativePath) || EXCLUDED_FILES.has(entry.name)) continue;

    const extension = path.extname(entry.name).toLowerCase();
    if (!PUBLIC_EXTENSIONS.has(extension)) continue;

    const destination = path.join(OUT, relativePath);
    await mkdir(path.dirname(destination), { recursive: true });
    if (TEXT_EXTENSIONS.has(extension)) {
      const text = await readFile(sourcePath, "utf8");
      await writeFile(destination, transformText(relativePath, text, deployUrl), "utf8");
    } else {
      const bytes = await readFile(sourcePath);
      await writeFile(destination, bytes);
    }
    copied += 1;
  }
  return copied;
}

async function assertProductionArtifact(deployUrl) {
  for (const required of REQUIRED_FILES) await readFile(path.join(OUT, required));

  const config = await readFile(path.join(OUT, "production-config.js"), "utf8");
  if (!config.includes("apiBaseUrl: window.location.origin")) {
    throw new Error("Netlify production config is not using same-origin /api routing.");
  }

  const auth = await readFile(path.join(OUT, "production-auth.js"), "utf8");
  if (!auth.includes(DEPLOYED_AUTH_ROUTE) || auth.includes(SOURCE_AUTH_ROUTE)) {
    throw new Error("Netlify production auth route was not rewritten to the dedicated alias.");
  }

  const forbiddenNames = ["backend", ".github", "e2e", "games", "tests", "supabase", "apps-script", "dashboard-prototype.html"];
  const topLevel = new Set(await readdir(OUT));
  for (const name of forbiddenNames) {
    if (topLevel.has(name)) throw new Error(`Forbidden deployment content found in dist: ${name}`);
  }

  async function scan(dir) {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const filePath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await scan(filePath);
        continue;
      }
      if (!TEXT_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) continue;
      const text = await readFile(filePath, "utf8");
      if (text.includes(OLD_API_ORIGIN)) throw new Error(`Legacy Vercel origin remains in ${path.relative(OUT, filePath)}`);
      for (const marker of SUPABASE_MARKERS) {
        if (text.includes(marker)) throw new Error(`Supabase production dependency remains in ${path.relative(OUT, filePath)}`);
      }
      for (const marker of DEMO_GAME_MARKERS) {
        if (text.includes(marker)) throw new Error(`Demo game content remains in production artifact: ${marker} in ${path.relative(OUT, filePath)}`);
      }
      if (deployUrl && text.includes(OLD_SITE_ORIGIN)) {
        throw new Error(`Legacy GitHub Pages origin remains in ${path.relative(OUT, filePath)}`);
      }
    }
  }
  await scan(OUT);
}

await rm(OUT, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });
const deployUrl = normalizedDeployUrl();
const copied = await copyPublicFiles(ROOT, "", deployUrl);
const robots = ["User-agent: *", "Allow: /"];
if (deployUrl) robots.push(`Sitemap: ${deployUrl}/sitemap.xml`);
await writeFile(path.join(OUT, "robots.txt"), `${robots.join("\n")}\n`, "utf8");
await assertProductionArtifact(deployUrl);
console.log(`Netlify production artifact ready: ${copied} public files + robots.txt.`);
