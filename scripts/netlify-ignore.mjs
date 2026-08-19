import { execFileSync } from "node:child_process";
import path from "node:path";

const before = String(process.env.CACHED_COMMIT_REF || "").trim();
const after = String(process.env.COMMIT_REF || "").trim();
if (!before || !after) process.exit(1);

let changed;
try {
  changed = execFileSync("git", ["diff", "--name-only", before, after], { encoding: "utf8" })
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
} catch {
  process.exit(1);
}

const publicExtensions = new Set([
  ".html", ".css", ".js", ".json", ".xml", ".svg", ".png", ".jpg", ".jpeg",
  ".webp", ".gif", ".avif", ".ico", ".woff", ".woff2", ".webmanifest"
]);
const alwaysBuild = new Set([
  "netlify.toml",
  "package.json",
  "package-lock.json",
  "scripts/build-netlify.mjs",
  "scripts/netlify-ignore.mjs"
]);
const ignoredRootFiles = new Set(["dashboard-prototype.html", "playwright.config.js"]);

const affectsNetlify = changed.some((file) => {
  const normalized = file.replaceAll("\\", "/");
  if (alwaysBuild.has(normalized)) return true;
  if (normalized.startsWith("netlify/")) return true;
  if (normalized.includes("/")) {
    const top = normalized.split("/", 1)[0];
    if (["backend", "docs", "e2e", "tests", "supabase", "apps-script", ".github"].includes(top)) return false;
    return publicExtensions.has(path.extname(normalized).toLowerCase());
  }
  if (ignoredRootFiles.has(normalized)) return false;
  return publicExtensions.has(path.extname(normalized).toLowerCase());
});

// Netlify: exit 1 means build; exit 0 means skip.
process.exit(affectsNetlify ? 1 : 0);
