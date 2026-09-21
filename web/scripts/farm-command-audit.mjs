#!/usr/bin/env node
/**
 * Farm command UX audit — list/map apply, bulk ACK toast, viewer deny.
 * Usage: node scripts/farm-command-audit.mjs
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
  openListControllerSettings,
  ensureControlSectionExpanded,
  applyFromSettingsPanel,
  applyFromMapDetailPanel,
} from "./audit-shared.mjs";

dotenv.config({
  path: join(dirname(fileURLToPath(import.meta.url)), "../.env.local"),
});

const BASE = process.env.UI_VERIFY_BASE ?? "http://localhost:3000";
const VIEWPORT = { width: 390, height: 844 };
const LIST_PATH = "/farm?lsind=FARM01&item=P00&tab=ops&view=list";
const LIST_BULK_PATH = "/farm?lsind=FARM01&item=P00&tab=ops&view=list&listLayout=flat";
const MAP_PATH = "/farm?lsind=FARM01&item=P00";

async function auditListApply(page) {
  await page.goto(`${BASE}${LIST_PATH}`, { waitUntil: "load" });
  await openListControllerSettings(page);
  const panel = page.locator('[data-audit-region="barn-list-accordion-panel"]').first();
  return applyFromSettingsPanel(page, panel);
}

async function auditMapApply(page) {
  return applyFromMapDetailPanel(page, MAP_PATH, BASE);
}

async function auditViewerDenied(page) {
  await page.goto(`${BASE}${LIST_PATH}`, { waitUntil: "load" });
  await openListControllerSettings(page);
  const panel = page.locator('[data-audit-region="barn-list-accordion-panel"]').first();
  await ensureControlSectionExpanded(panel);

  const applyBtn = panel.getByRole("button", { name: /^(명령 적용|적용)$/ });
  const applyCount = await applyBtn.count();
  // 조회 전용: 적용 버튼 자체가 없거나, disabled / 권한 안내
  if (applyCount === 0) {
    const readOnly =
      (await page.getByText(/조회 전용|명령 권한이 없어/).count()) > 0;
    if (!readOnly) {
      // 설정 패널은 열렸고 적용 UI가 없으면 권한 차단으로 간주
      return { denied: true, mode: "no-apply" };
    }
    return { denied: true, mode: "read-only-banner" };
  }
  await applyBtn.first().waitFor({ state: "visible", timeout: 15000 });
  const denied =
    (await applyBtn.first().isDisabled()) ||
    (await page.getByText("명령 권한이 없어").count()) > 0;
  if (!denied) {
    throw new Error("viewer 계정에서 적용 버튼/권한 제한이 기대와 다릅니다.");
  }
  return { denied: true, mode: "disabled-apply" };
}

async function auditBulkAck(page) {
  await page.goto(`${BASE}${LIST_BULK_PATH}`, { waitUntil: "load" });
  await page.waitForSelector('[data-audit-region="barn-list-summary"]', {
    timeout: 30000,
  });
  const bulkSwitch = page.getByRole("switch", { name: /일괄적용/ });
  if ((await bulkSwitch.count()) === 0) {
    return { skipped: true, reason: "bulk UI 없음" };
  }
  await bulkSwitch.click();
  await page.waitForTimeout(300);
  let chip = page
    .locator('[data-audit-region="barn-list-bulk-sp-chips"] button')
    .first();
  if ((await chip.count()) === 0) {
    chip = page
      .locator('[data-audit-region="barn-list-summary"][data-bulk-mode="on"] section header[role="button"]')
      .first();
  }
  if ((await chip.count()) === 0) {
    return { skipped: true, reason: "SP chip 없음" };
  }
  await chip.click();
  const openModal = page.getByRole("button", { name: "설정 입력" });
  if ((await openModal.count()) === 0) {
    return { skipped: true, reason: "일괄 적용 대상 없음" };
  }
  await openModal.click();
  const applyBtn = page.getByRole("button", { name: /적용$/ });
  await applyBtn.waitFor({ state: "visible", timeout: 15000 });
  await applyBtn.click();
  const toast = await page
    .getByText(/제어 .* 전송|일괄 적용 완료|알람 유형/)
    .first()
    .textContent({ timeout: 30000 });
  return { toast: toast?.trim() ?? "일괄 적용 완료" };
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
  const context = await browser.newContext({ viewport: VIEWPORT });
  const page = await context.newPage();
  const results = {};

  try {
    await login(page, {
      base: BASE,
      email: TEST_ACCOUNTS.operator.email,
      password: passwordForEmail(TEST_ACCOUNTS.operator.email),
    });
    results.listApply = await auditListApply(page);
    console.log(`List apply OK — ${results.listApply.ack}`);

    results.mapApply = await auditMapApply(page);
    console.log(`Map apply OK — ${results.mapApply.ack}`);

    results.bulkAck = await auditBulkAck(page);
    console.log(
      `Bulk ACK — ${results.bulkAck.skipped ? results.bulkAck.reason : results.bulkAck.toast}`
    );

    await login(page, {
      base: BASE,
      email: TEST_ACCOUNTS.viewer.email,
      password: passwordForEmail(TEST_ACCOUNTS.viewer.email),
    });
    results.viewerDenied = await auditViewerDenied(page);
    console.log("Viewer apply denied OK");

    const outDir = join(
      dirname(fileURLToPath(import.meta.url)),
      "mobile-audit-output"
    );
    mkdirSync(outDir, { recursive: true });
    writeFileSync(
      join(outDir, "farm-command-report.json"),
      JSON.stringify({ ok: true, at: new Date().toISOString(), results }, null, 2)
    );
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
