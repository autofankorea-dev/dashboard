import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { resolve, join } from "node:path";
import { chromium } from "playwright";

const base = process.env.UI_VERIFY_BASE ?? "http://localhost:3013";
const output = resolve(process.env.ERROR_BINARY_OUTPUT ?? "tmp/error-hex");
mkdirSync(output, { recursive: true });
const browser = await chromium.launch({ channel: "chrome" });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errors = [];
page.on("pageerror", error => errors.push(error.message));
try {
  const response = await page.goto(`${base}/auth/error-binary-debug`, { timeout: 120000 });
  assert.equal(response.status(), 200);
  const debug = page.locator("[data-controller-error-hex]");
  const select = page.getByLabel("네 번째 센서 원시값", { exact: true });
  await page.waitForFunction(() => document.querySelector("[data-controller-error-hex] code")?.textContent === "0x01FF");
  for (const [value, hex] of [[0,"0x0000"],[1,"0x0001"],[17,"0x0011"],[511,"0x01FF"],
    [4660,"0x1234"],[43981,"0xABCD"],[65535,"0xFFFF"],["missing","—"]]) {
    await select.selectOption(String(value));
    await page.waitForFunction(hex => document.querySelector("[data-controller-error-hex] code")?.textContent === hex, hex);
  }
  await select.selectOption("511");
  await page.waitForFunction(() => document.querySelector("[data-controller-error-hex] code")?.textContent === "0x01FF");
  await page.screenshot({ path: join(output, "error-hex-desktop.png"), fullPage: true });
  for (const width of [1280, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    const judgement = await page.locator("[data-controller-status-judgement]").boundingBox();
    const hex = await debug.boundingBox();
    assert.ok(hex.x >= judgement.x + judgement.width, `HEX must be right of status at ${width}px`);
    assert.ok(Math.abs(hex.y - judgement.y) < 12);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  }
  await page.screenshot({ path: join(output, "error-hex-mobile.png"), fullPage: true });
  assert.deepEqual(errors, []);
  console.log("PASS: raw fourth-sensor uint16 HEX, zero/FFFF retained, missing value, 1280/390/320px layouts; no page errors.");
} finally {
  await browser.close();
}
