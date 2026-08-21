import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { deploymentMetadata } from "./deploy-metadata.mjs";

const ROOT = process.cwd();
const OUT = path.join(ROOT, "dist");
const OLD_API_ORIGIN = "https://dinnerdiceanddragons.vercel.app";
const OLD_SITE_ORIGIN = "https://cbw29512.github.io/dinnerdiceanddragons";
const SOURCE_AUTH_ROUTE = "/api/v1/auth/";
const DEPLOYED_AUTH_ROUTE = "/auth-api/v1/auth/";
const SUPABASE_MARKERS = ["supabase.co", "sb_publishable_", "SUPABASE_SECRET_KEY"];
const DEMO_GAME_MARKERS = ["Shadows Over Florence", "The Lighthouse at Blackwater", "Trouble Below the Old Road"];
const LEGACY_ONBOARDING_LINKS = ["join.html#player", "join.html#gm", "venues.html#signup"];
const REQUIRED_FILES = [
  "index.html", "play.html", "dm.html", "host.html", "signin.html", "my-ddd.html",
  "notifications.html", "opportunity.html", "create-game.html", "create-game.js", "game-hub.html",
  "player-start.js", "player-start-profile.js", "dm-start.js", "dm-start-profile.js",
  "host-start.js", "host-start-account.js", "host-managed-venues.js",
  "signin.js", "my-ddd.js", "my-ddd-games.js", "my-ddd-reminders.js",
  "auth-confirm.js", "venue-window-payloads.js",
  "availability-calendar-init.mjs", "availability-presets.mjs", "calendar-state.mjs", "calendar-ui.mjs",
  "production-config.js", "production-api-client.js", "production-auth.js",
  "deploy-meta.json", "sitemap.xml"
];
const EXCLUDED_DIRS = new Set([
  ".git", ".github", ".venv", "apps-script", "backend", "dist", "docs", "e2e", "games",
  "netlify", "node_modules", "playwright-report", "scripts", "supabase", "test-results", "tests"
]);
const EXCLUDED_FILES = new Set([
  "dashboard-prototype.html", "dashboard.js", "shared-games.js", "form-series.html", "discovery.js",
  "series-commitments.html", "recurring-match.html", "find-venue.html", "table-lifecycle.html",
  "package.json", "package-lock.json", "playwright.config.js", "location-matching-notes.txt"
]);
const PUBLIC_EXTENSIONS = new Set([
  ".html", ".css", ".js", ".mjs", ".json", ".xml", ".svg", ".png", ".jpg", ".jpeg",
  ".webp", ".gif", ".avif", ".ico", ".woff", ".woff2", ".webmanifest"
]);
const TEXT_EXTENSIONS = new Set([".html", ".css", ".js", ".mjs", ".json", ".xml", ".svg", ".webmanifest"]);

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
  if (relativePath === "production-auth.js") output = output.replaceAll(SOURCE_AUTH_ROUTE, DEPLOYED_AUTH_ROUTE);
  return output;
}

async function copyPublicFiles(currentDir = ROOT, relativeDir = "", deployUrl = "") {
  let copied = 0;
  for (const entry of await readdir(currentDir, { withFileTypes: true })) {
    if (entry.name.startsWith(".")) continue;
    const relativePath = path.posix.join(relativeDir.replaceAll("\\", "/"), entry.name);
    const sourcePath = path.join(currentDir, entry.name);
    if (entry.isDirectory()) {
      if (!EXCLUDED_DIRS.has(entry.name)) copied += await copyPublicFiles(sourcePath, relativePath, deployUrl);
      continue;
    }
    if (!entry.isFile() || EXCLUDED_FILES.has(relativePath) || EXCLUDED_FILES.has(entry.name)) continue;
    const extension = path.extname(entry.name).toLowerCase();
    if (!PUBLIC_EXTENSIONS.has(extension)) continue;
    const destination = path.join(OUT, relativePath);
    await mkdir(path.dirname(destination), { recursive: true });
    if (TEXT_EXTENSIONS.has(extension)) {
      await writeFile(destination, transformText(relativePath, await readFile(sourcePath, "utf8"), deployUrl), "utf8");
    } else {
      await writeFile(destination, await readFile(sourcePath));
    }
    copied += 1;
  }
  return copied;
}

async function assertProductionArtifact(deployUrl) {
  for (const required of REQUIRED_FILES) await readFile(path.join(OUT, required));
  const config = await readFile(path.join(OUT, "production-config.js"), "utf8");
  if (!config.includes("apiBaseUrl: window.location.origin")) throw new Error("Netlify production config is not using same-origin /api routing.");
  const auth = await readFile(path.join(OUT, "production-auth.js"), "utf8");
  if (!auth.includes(DEPLOYED_AUTH_ROUTE) || auth.includes(SOURCE_AUTH_ROUTE)) throw new Error("Netlify production auth client is not using the dedicated auth route.");
  const apiClient = await readFile(path.join(OUT, "production-api-client.js"), "utf8");
  if (apiClient.includes("getHubMessages") || apiClient.includes("postHubMessage") || apiClient.includes('/messages"')) throw new Error("Direct Game Hub messaging client code remains in the production artifact.");
  const gameHub = await readFile(path.join(OUT, "game-hub.html"), "utf8");
  if (gameHub.includes("game-hub-messages.js") || gameHub.includes("message-channel-grid") || gameHub.includes("venue-question-form")) throw new Error("Direct Game Hub communication controls remain in the production artifact.");
  const oldJoin = await readFile(path.join(OUT, "join.html"), "utf8").catch(() => "");
  if (oldJoin.includes("id=\"player-form\"") || oldJoin.includes("id=\"gm-form\"")) throw new Error("Legacy giant onboarding forms remain in the production artifact.");
  const hostHtml = await readFile(path.join(OUT, "host.html"), "utf8");
  const hostScript = await readFile(path.join(OUT, "host-start.js"), "utf8");
  if (hostHtml.includes("private_residence") || hostScript.includes("private_residence")) throw new Error("Private-residence hosting leaked into production.");
  const forbiddenNames = [
    "backend", ".github", "e2e", "games", "tests", "supabase", "apps-script", "dashboard-prototype.html",
    "dashboard.js", "shared-games.js", "form-series.html", "discovery.js", "series-commitments.html",
    "recurring-match.html", "find-venue.html", "table-lifecycle.html", "game-hub-messages.js"
  ];
  const topLevel = new Set(await readdir(OUT));
  for (const name of forbiddenNames) if (topLevel.has(name)) throw new Error(`Forbidden deployment content found in dist: ${name}`);

  async function scan(dir) {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const filePath = path.join(dir, entry.name);
      if (entry.isDirectory()) { await scan(filePath); continue; }
      if (!TEXT_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) continue;
      const text = await readFile(filePath, "utf8");
      const relative = path.relative(OUT, filePath);
      if (text.includes(OLD_API_ORIGIN)) throw new Error(`Legacy Vercel origin remains in ${relative}`);
      for (const marker of SUPABASE_MARKERS) if (text.includes(marker)) throw new Error(`Supabase production dependency remains in ${relative}`);
      for (const marker of DEMO_GAME_MARKERS) if (text.includes(marker)) throw new Error(`Demo game content remains in production artifact: ${marker} in ${relative}`);
      for (const legacyLink of LEGACY_ONBOARDING_LINKS) if (text.includes(legacyLink)) throw new Error(`Legacy onboarding link remains in ${relative}: ${legacyLink}`);
      if (deployUrl && text.includes(OLD_SITE_ORIGIN)) throw new Error(`Legacy GitHub Pages origin remains in ${relative}`);
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
await writeFile(path.join(OUT, "deploy-meta.json"), `${JSON.stringify(deploymentMetadata())}\n`, "utf8");
await assertProductionArtifact(deployUrl);
console.log(`Netlify production artifact ready: ${copied} public files + robots.txt + deploy-meta.json.`);