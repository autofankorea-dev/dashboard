import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { resolve, join } from "node:path";
import { chromium } from "playwright";

const base = process.env.UI_VERIFY_BASE ?? "http://localhost:3000";
const output = resolve(process.env.ERROR_BINARY_OUTPUT ?? "tmp/error-binary");
mkdirSync(output, { recursive: true });
const browser = await chromium.launch({ channel: "chrome" });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errors = [];
page.on("pageerror", error => errors.push(error.message));
try {
  const response = await page.goto(`${base}/auth/error-binary-debug`, { timeout: 120000 });
  assert.equal(response.status(), 200);
  const debug = page.locator("[data-controller-error-binary]");
  const select = page.getByLabel("테스트 경보", { exact: true });
  await page.waitForFunction(() => document.querySelector("[data-controller-error-binary]")?.textContent.includes("00010001"));
  for (const [value, binary] of [[17,"00010001"],[18,"00010010"],[33,"00100001"],[34,"00100010"],
    [49,"00110001"],[50,"00110010"],[65,"01000001"],[254,"11111110"]]) {
    await select.selectOption(String(value));
    await page.waitForFunction(binary => document.querySelector("[data-controller-error-binary] code")?.textContent === binary, binary);
  }
  await select.selectOption("multiple");
  await page.waitForFunction(() => document.querySelectorAll("[data-controller-error-binary] code").length === 2);
  assert.deepEqual(await debug.locator("code").allTextContents(), ["00010001", "01000001"]);
  await page.screenshot({ path: join(output, "error-binary-desktop.png"), fullPage: true });
  for (const scenario of ["none", "other"]) {
    await select.selectOption(scenario);
    await page.waitForFunction(() => document.querySelectorAll("[data-controller-error-binary] code").length === 0);
    assert.match(await debug.innerText(), /—/);
    assert.doesNotMatch(await debug.innerText(), /00000000/);
  }
  await select.selectOption("legacy");
  await page.waitForFunction(() => document.querySelector("[data-controller-error-binary]")?.textContent.includes("모듈 00010001"));
  await select.selectOption("17");
  await page.waitForFunction(() => document.querySelector("[data-controller-error-binary] code")?.textContent === "00010001");
  for (const width of [1280, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    const judgement = await page.locator("[data-controller-status-judgement]").boundingBox();
    const binary = await debug.boundingBox();
    assert.ok(binary.x >= judgement.x + judgement.width, `Binary must be right of status at ${width}px`);
    assert.ok(Math.abs(binary.y - judgement.y) < 12, `Binary stays on status row at ${width}px`);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `No overflow at ${width}px`);
  }
  await page.screenshot({ path: join(output, "error-binary-mobile.png"), fullPage: true });
  assert.deepEqual(errors, []);
  console.log("PASS: 8 wire codes, separate simultaneous errors, empty, legacy module scope, module isolation, right-of-status layout at 1280/390/320px; no page errors.");
} finally {
  await browser.close();
}
