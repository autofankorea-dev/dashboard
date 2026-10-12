#!/usr/bin/env node
/**
 * 허브 본체 P0 게이트 — URL·keep-alive 유닛만 (브라우저/서버 불필요).
 * Usage: npm run verify:hub
 */
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { spawnSync } from "child_process";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const vitestBin = join(root, "node_modules/.bin/vitest");

const files = [
  "src/lib/farm/farm-hub-url-smoke.test.ts",
  "src/lib/farm/farm-hub-keepalive.test.ts",
];

const r = spawnSync(vitestBin, ["run", ...files], {
  cwd: root,
  stdio: "inherit",
  env: process.env,
});
if (r.status !== 0) {
  console.error(`\nverify:hub: failed (exit ${r.status ?? "?"})`);
  process.exit(r.status ?? 1);
}
console.log(`\nverify:hub: ok (${files.length} files)`);
