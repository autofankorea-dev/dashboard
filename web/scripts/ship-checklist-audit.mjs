#!/usr/bin/env node
/**
 * 출고 스모크 (SHIP_CHECKLIST) — admin / operator / viewer 핵심 경로.
 * Usage: npm run audit:ship-checklist  (dev 서버 실행 중)
 */
import dotenv from "dotenv";
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { writeFileSync, mkdirSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import {
  ensureTestPasswords,
  passwordForEmail,
  TEST_ACCOUNTS,
} from "./test-accounts.mjs";
import {
  login,
  openFieldControllerSettings,
  applyFromSettingsPanel,
} from "./audit-shared.mjs";

dotenv.config({
  path: join(dirname(fileURLToPath(import.meta.url)), "../.env.local"),
});

const BASE = process.env.UI_VERIFY_BASE ?? "http://localhost:3000";
const FARM_FIELD = "/farm?lsind=FARM01&item=P00";
const FARM_FIELD_SETTINGS = `${FARM_FIELD}&listMode=settings`;
const VIEWPORT = { width: 1280, height: 900 };

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function bodyText(page) {
  return page.locator("body").innerText();
}

async function hasLiveBarns(page) {
  const t = await bodyText(page);
  return /임신사/.test(t) && /분만사/.test(t) && /자돈사/.test(t);
}

async function smokeAdmin(page) {
  await login(page, {
    base: BASE,
    email: TEST_ACCOUNTS.admin.email,
    password: passwordForEmail(TEST_ACCOUNTS.admin.email),
  });
  await page.goto(`${BASE}/farm?lsind=FARM01&item=P00`, {
    waitUntil: "load",
  });
  await page.waitForTimeout(2500);
  assert(await hasLiveBarns(page), "admin /farm: LIVE 축사(임신/분만/자돈) 없음");

  // 헤더 도구는 상시 아이콘 — 운영은 펼침 없이 노출
  const tools = page.locator('[data-tour-id="header-tools"]').first();
  assert(await tools.isVisible().catch(() => false), "admin: 헤더 도구 없음");
  const opsBtn = page.locator('[data-tour-id="header-ops"]').first();
  assert(
    await opsBtn.isVisible().catch(() => false),
    "admin: 헤더 운영 진입점 없음",
  );

  await page.goto(`${BASE}/admin/ops`, { waitUntil: "load" });
  await page.waitForTimeout(1500);
  const opsText = await bodyText(page);
  assert(
    /시스템|디렉터리|사용자/.test(opsText),
    "admin /admin/ops: 시스템·디렉터리 UI 없음",
  );

  return { role: "admin", ok: true };
}

async function smokeOperator(page) {
  await login(page, {
    base: BASE,
    email: TEST_ACCOUNTS.operator.email,
    password: passwordForEmail(TEST_ACCOUNTS.operator.email),
  });

  await page.goto(`${BASE}${FARM_FIELD}`, { waitUntil: "load" });
  await page.waitForTimeout(2500);
  assert(await hasLiveBarns(page), "operator map: LIVE 축사 없음");

  const bulk = page.getByRole("switch", { name: /일괄적용/ });
  assert(await bulk.isVisible().catch(() => false), "operator: 일괄적용 스위치 없음");

  await page.goto(`${BASE}${FARM_FIELD_SETTINGS}`, { waitUntil: "load" });
  await page.waitForTimeout(1500);
  const panel = await openFieldControllerSettings(page);
  const apply = await applyFromSettingsPanel(page, panel);
  assert(Boolean(apply.ack), "operator: Apply ACK 문구 없음");

  await page.goto(`${BASE}/admin/ops`, { waitUntil: "load" });
  await page.waitForTimeout(1500);
  assert(
    !page.url().includes("/admin/ops"),
    "operator: /admin/ops 차단 실패",
  );

  return { role: "operator", ok: true, ack: apply.ack, setpoint: apply.setpoint };
}

async function smokeViewer(page) {
  await login(page, {
    base: BASE,
    email: TEST_ACCOUNTS.viewer.email,
    password: passwordForEmail(TEST_ACCOUNTS.viewer.email),
  });
  await page.goto(`${BASE}${FARM_FIELD_SETTINGS}`, { waitUntil: "load" });
  await page.waitForTimeout(2500);
  assert(await hasLiveBarns(page), "viewer field: LIVE 축사 없음");

  const bulk = page.getByRole("switch", { name: /일괄적용/ });
  assert(
    !(await bulk.isVisible().catch(() => false)),
    "viewer: 일괄적용이 보이면 안 됨",
  );

  const opsNav = page.getByRole("link", { name: /^운영$/ });
  assert(
    !(await opsNav.isVisible().catch(() => false)),
    "viewer: 운영 링크가 보이면 안 됨",
  );
  assert(
    !(await page.locator('[data-tour-id="header-ops"]').isVisible().catch(() => false)),
    "viewer: 헤더 운영 진입점이 보이면 안 됨",
  );

  const panel = await openFieldControllerSettings(page);
  const panelText = await panel.innerText();
  assert(/조회\s*전용/.test(panelText), "viewer: 조회 전용 배너 없음");
  assert(
    !(await panel.getByRole("button", { name: /^(명령 적용|적용)$/ }).isVisible().catch(() => false)),
    "viewer: 적용 버튼이 보이면 안 됨",
  );

  await page.goto(`${BASE}/admin/ops`, { waitUntil: "load" });
  await page.waitForTimeout(1500);
  assert(
    !page.url().includes("/admin/ops"),
    "viewer: /admin/ops 차단 실패",
  );

  return { role: "viewer", ok: true };
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 필요");
    process.exit(1);
  }

  const admin = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  await ensureTestPasswords(admin);

  const browser = await chromium.launch({ headless: true });
  const results = [];

  try {
    for (const smoke of [smokeAdmin, smokeOperator, smokeViewer]) {
      const context = await browser.newContext({ viewport: VIEWPORT });
      const page = await context.newPage();
      try {
        const r = await smoke(page);
        results.push(r);
        console.log(`PASS ${r.role}${r.ack ? ` — ${r.ack}` : ""}`);
      } catch (err) {
        results.push({
          role: smoke.name.replace("smoke", "").toLowerCase(),
          ok: false,
          error: String(err?.message ?? err),
        });
        console.error(`FAIL ${smoke.name}:`, err?.message ?? err);
        await browser.close();
        process.exit(1);
      } finally {
        await context.close();
      }
    }
  } finally {
    await browser.close();
  }

  const outDir = join(
    dirname(fileURLToPath(import.meta.url)),
    "mobile-audit-output",
  );
  mkdirSync(outDir, { recursive: true });
  const report = {
    ok: true,
    at: new Date().toISOString(),
    base: BASE,
    results,
  };
  writeFileSync(
    join(outDir, "ship-checklist-report.json"),
    JSON.stringify(report, null, 2),
  );
  console.log("Ship checklist audit passed —", join(outDir, "ship-checklist-report.json"));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
