/**
 * Pull production ops secrets from the linked Vercel project into web/.env.local.
 * Prints key names only. Does not overwrite NEXT_PUBLIC_SITE_URL.
 *
 * Requires `vercel` on PATH and `vercel link` for autofankorea-dev/dashboard.
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const envPath = join(root, "..", ".env.local");
const ALLOW = ["SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SECRET_KEY"];

function parseEnv(text) {
  const out = new Map();
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    if (!line || line.trim().startsWith("#") || !line.includes("=")) continue;
    const i = line.indexOf("=");
    const key = line.slice(0, i).trim();
    let value = line.slice(i + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out.set(key, value);
  }
  return out;
}

function redact(text) {
  return text
    .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, "[redacted-jwt]")
    .replace(/sb_(secret|publishable)_[A-Za-z0-9_-]+/g, "[redacted-key]");
}

const vercel = spawnSync("vercel", ["--version"], { encoding: "utf8" });
if (vercel.error || vercel.status !== 0) {
  console.error("vercel CLI is not available. Install it and run `vercel link` in web/.");
  process.exit(1);
}

const dir = mkdtempSync(join(tmpdir(), "ops-env-"));
const pulledPath = join(dir, ".env.production");
const pull = spawnSync(
  "vercel",
  ["env", "pull", pulledPath, "--environment", "production", "--yes"],
  { cwd: join(root, ".."), encoding: "utf8" },
);

if (pull.status !== 0 || !existsSync(pulledPath)) {
  const detail = redact(`${pull.stdout ?? ""}\n${pull.stderr ?? ""}`).trim();
  console.error(detail || "vercel env pull failed");
  rmSync(dir, { recursive: true, force: true });
  process.exit(1);
}

const pulled = parseEnv(readFileSync(pulledPath, "utf8"));
rmSync(dir, { recursive: true, force: true });

const found = ALLOW.filter((key) => pulled.get(key));
if (found.length === 0) {
  console.error(
    `Production env has neither ${ALLOW.join(" nor ")}. Check the Vercel project env.`,
  );
  process.exit(1);
}

const currentText = existsSync(envPath) ? readFileSync(envPath, "utf8") : "";
const current = parseEnv(currentText);
let next = currentText;
if (next.length > 0 && !next.endsWith("\n")) next += "\n";

for (const key of found) {
  const value = pulled.get(key);
  if (current.get(key) === value) {
    console.log(`${key}: unchanged`);
    continue;
  }
  const escaped = /[\s#"'\\]/.test(value) ? JSON.stringify(value) : value;
  const line = `${key}=${escaped}`;
  const pattern = new RegExp(`^${key}=.*$`, "m");
  if (pattern.test(next)) next = next.replace(pattern, line);
  else next += `${line}\n`;
  console.log(`${key}: written`);
}

writeFileSync(envPath, next, { mode: 0o600 });
console.log("web/.env.local updated. Restart the Next dev server so ops picks up the key.");
