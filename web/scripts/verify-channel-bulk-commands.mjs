#!/usr/bin/env node
/**
 * #5 channels bulk — toast + ctrl_thermo_command row 검증
 * Usage: node scripts/verify-channel-bulk-commands.mjs
 */
import dotenv from "dotenv";
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import {
  ensureTestPasswords,
  passwordForEmail,
  TEST_ACCOUNTS,
} from "./test-accounts.mjs";
import { login } from "./audit-shared.mjs";

dotenv.config({
  path: join(dirname(fileURLToPath(import.meta.url)), "../.env.local"),
});

const BASE = process.env.UI_VERIFY_BASE ?? "http://localhost:3000";
const LIST =
  "/farm?lsind=FARM01&item=P00&view=list&listLayout=flat";

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function selectChannel(page, slot) {
  const dialog = page.getByRole("dialog");
  const tab = dialog.getByRole("tab", { name: new RegExp(`^${slot}`) });
  await tab.click();
}

async function bumpSetpoint(page) {
  const input = page.getByRole("dialog").getByRole("textbox", { name: "설정온도" });
  await input.click();
  const cur = Number(await input.inputValue()) || 25;
  await input.fill(String(Math.min(30, Math.round((cur + 0.1) * 10) / 10)));
  await input.press("Tab");
}

async function setSection(page, re, on) {
  const label = page
    .getByRole("dialog")
    .locator("label")
    .filter({ hasText: re })
    .first();
  const box = label.locator('input[type="checkbox"]');
  for (let i = 0; i < 5; i++) {
    if ((await box.isChecked()) === on) return;
    await label.click({ force: true });
    await page.waitForTimeout(150);
  }
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  assert(url && key, "Supabase env 필요");

  const admin = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  await ensureTestPasswords(admin);

  const t0 = new Date().toISOString();
  console.log("t0", t0);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 1280, height: 900 },
  });

  try {
    await login(page, {
      base: BASE,
      email: TEST_ACCOUNTS.operator.email,
      password: passwordForEmail(TEST_ACCOUNTS.operator.email),
    });

    // cache bust
    await page.goto(`${BASE}${LIST}&_=${Date.now()}`, { waitUntil: "load" });
    await page.waitForSelector('[data-audit-region="barn-list-summary"]', {
      timeout: 45000,
    });
    await page.waitForTimeout(1500);

    const sw = page.getByRole("switch", { name: /일괄적용/ });
    if ((await sw.getAttribute("aria-checked")) !== "true") await sw.click();
    await page.waitForTimeout(500);
    await page.getByRole("button", { name: /설정\s*입력/ }).click();
    const dialog = page.getByRole("dialog");
    await dialog.waitFor({ state: "visible", timeout: 15000 });

    await setSection(page, /설정온도/, true);
    await setSection(page, /환기/, false);
    await setSection(page, /알람/, false);

    await selectChannel(page, "B");
    await bumpSetpoint(page);

    const preview = await dialog
      .locator('[aria-label^="제어 명령"]')
      .getAttribute("aria-label");
    console.log("preview", preview);
    assert(preview, "preview 명령 aria 없음 — channels[] 미반영 가능");
    const previewN = Number(preview.match(/(\d+)/)?.[1] ?? 0);
    assert(previewN > 0 && previewN < 13, `B-only preview 기대 1~12, 실제 ${previewN}`);

    await dialog.getByRole("button", { name: /적용$/ }).click();

    const mismatch = page.getByText(/채널 미매칭\s*\d+대/);
    await mismatch.first().waitFor({ state: "visible", timeout: 45000 });
    const toast = (await mismatch.first().innerText()).trim();
    console.log("toast", toast);
    const skipN = Number(toast.match(/채널 미매칭\s*(\d+)대/)?.[1] ?? 0);
    assert(skipN > 0, "미매칭 건수 0");

    await page.waitForTimeout(2000);
  } finally {
    await browser.close();
  }

  const { data: rows, error } = await admin
    .from("ctrl_thermo_command")
    .select(
      "created_at, action, status, stall_ty_code, stall_no, eqpmn_no, channel, eqpmn_code, setpoint_temp",
    )
    .eq("lsind_regist_no", "FARM01")
    .eq("item_code", "P00")
    .gte("created_at", t0)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  console.log("DB rows since t0:", rows?.length ?? 0);
  console.log(JSON.stringify(rows, null, 2));

  assert((rows?.length ?? 0) > 0, "적용 후 ctrl_thermo_command insert 없음");

  const badCtrl = rows.filter((r) => r.action === "SET_CTRL_THERMO");
  assert(
    badCtrl.length === 0,
    `레거시 CTRL이 ${badCtrl.length}건 섞임 — channels bulk 미반영`,
  );

  const channelRows = rows.filter((r) => r.action === "SET_CHANNEL_THERMO");
  assert(channelRows.length > 0, "SET_CHANNEL_THERMO 없음");

  for (const r of channelRows) {
    assert(r.channel === "B", `channel=${r.channel} (기대 B)`);
    assert(r.eqpmn_code === "EC02", `eqpmn_code=${r.eqpmn_code} (기대 EC02)`);
    assert(
      r.stall_ty_code !== "SP02" || r.channel === "A",
      "임신사(SP02)에 B 명령이 나가면 안 됨",
    );
  }

  const sp02B = channelRows.filter(
    (r) => r.stall_ty_code === "SP02" && r.channel === "B",
  );
  assert(sp02B.length === 0, "SP02+B 명령이 존재하면 안 됨");

  console.log(
    `PASS verify-channel-bulk — SET_CHANNEL_THERMO ${channelRows.length}건 · all B/EC02 · toast skip ok`,
  );
}

main().catch((err) => {
  console.error("FAIL", err?.message ?? err);
  process.exit(1);
});
