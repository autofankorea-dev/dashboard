/**
 * npm run smoke:chart-comparison
 * Starts a local Next dev server with synthetic data; no real farm or account required.
 * The temporary /auth fixture is removed even on failure and is never deployed.
 * CHART_SMOKE_BROWSER_PATH may point to a Chromium executable (default: installed Chrome).
 */
import assert from "node:assert/strict";
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { chromium } from "playwright";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const fixtureDir = join(root, "src/app/auth/chart-comparison-smoke");
const port = Number(process.env.CHART_SMOKE_PORT ?? 3011);
const base = `http://localhost:${port}/auth/chart-comparison-smoke`;
const output = resolve(
  process.env.CHART_SMOKE_OUTPUT ?? join(root, "tmp/chart-comparison"),
);
const nextCli = join(root, "node_modules/next/dist/bin/next");
const delay = (ms) => new Promise((done) => setTimeout(done, ms));
let server;
let browser;
let page;
let ownedFixture = false;
const errors = [];
try {
  assert.ok(
    !existsSync(fixtureDir),
    "Refusing to overwrite an existing fixture route",
  );
  mkdirSync(fixtureDir, { recursive: true });
  ownedFixture = true;
  copyFileSync(
    join(root, "scripts/fixtures/chart-controller-comparison-page.tsx"),
    join(fixtureDir, "page.tsx"),
  );
  mkdirSync(output, { recursive: true });
  server = spawn(
    process.execPath,
    [nextCli, "dev", "--webpack", "--port", String(port)],
    {
      cwd: root,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
      env: {
        ...process.env,
        NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "ci-anon-key",
        SUPABASE_SERVICE_ROLE_KEY: "ci-service-role-key",
      },
    },
  );
  let serverOutput = "";
  server.stdout.on("data", (data) => {
    serverOutput += data;
  });
  server.stderr.on("data", (data) => {
    serverOutput += data;
  });
  for (let i = 0; i < 120; i++) {
    if (serverOutput.includes("Ready in")) break;
    if (server.exitCode != null) throw new Error(serverOutput);
    await delay(500);
  }
  assert.match(serverOutput, /Ready in/);
  browser = await chromium.launch(
    process.env.CHART_SMOKE_BROWSER_PATH
      ? { executablePath: process.env.CHART_SMOKE_BROWSER_PATH }
      : { channel: "chrome" },
  );
  page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
    reducedMotion: "reduce",
  });
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.setDefaultTimeout(20000);
  await page.goto(base, { timeout: 120000 });
  await page.locator('[data-fixture-ready="true"]').waitFor();
  const lab = page.locator("[data-farm-chart-lab]");
  const mode = async (value) => {
    await page.waitForFunction(
      (expected) =>
        document
          .querySelector("[data-farm-chart-lab]")
          ?.getAttribute("data-chart-lab-mode") === expected,
      value,
    );
  };
  const controllerTile = (key) =>
    page.locator(`[data-chart-controller-key="${key}"]`);
  const graph = (key) =>
    controllerTile(key).locator('svg[aria-label="추이 차트"]');
  const checkbox = (key) => controllerTile(key).getByRole("checkbox");
  const markerChecks = [];
  const verifyExpandedDots = async (key, radiusPx, label) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.mouse.move(0, 0);
    // Record animation frames, not just the settled chart: a stale, scaled
    // viewBox previously inflated dots to 35x43px during expansion.
    await page.evaluate(({ radiusPx }) => {
      window.__chartDotSamples = [];
      const start = performance.now();
      const tick = () => {
        const svg = document.querySelector('[data-chart-comparison-panels] svg[aria-label="추이 차트"]');
        const dot = svg && [...svg.querySelectorAll("ellipse")].find(
          (node) => node.getAttribute("fill") !== "none" &&
            Math.abs(Number(node.getAttribute("rx")) - radiusPx) < 0.0001,
        );
        if (dot) {
          const rect = dot.getBoundingClientRect();
          window.__chartDotSamples.push({ width: rect.width, height: rect.height });
        }
        if (performance.now() - start < 1800) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }, { radiusPx });
    await controllerTile(key).getByRole("button", { name: /개별 그래프 보기/ }).click();
    await mode("single");
    await page.mouse.move(0, 0);
    await delay(1900);
    const samples = await page.evaluate(() => window.__chartDotSamples);
    assert.ok(samples.length >= 3, `${label}: sampled visible dots`);
    const diameter = radiusPx * 2;
    const maxWidth = Math.max(...samples.map((sample) => sample.width));
    const maxHeight = Math.max(...samples.map((sample) => sample.height));
    assert.ok(maxWidth <= diameter + 0.4 && maxHeight <= diameter + 0.4,
      `${label}: dots must not inflate during expansion (${maxWidth}x${maxHeight})`);
    const last = samples.at(-1);
    assert.ok(Math.abs(last.width - diameter) < 0.15 && Math.abs(last.height - diameter) < 0.15,
      `${label}: settled dots must be circular at ${diameter}px`);
    markerChecks.push({ label, frames: samples.length, maxWidth, maxHeight, settled: last });
    await page.screenshot({ path: join(output, `expanded-${label}.png`) });
    await page.emulateMedia({ reducedMotion: "reduce" });
  };
  await mode("batch");
  assert.equal(
    await page.locator("[data-farm-chart-lab-batch-stalls]").count(),
    0,
  );
  await page
    .getByRole("button", { name: "분만사의 축사 보기", exact: true })
    .click();
  await page.locator("[data-farm-chart-lab-batch-stalls]").waitFor();
  assert.equal(
    await page
      .locator("[data-farm-chart-lab-batch-stalls] [data-farm-chart-tile]")
      .count(),
    2,
  );
  await page
    .getByRole("button", {
      name: "분만사 · 1번 축사의 컨트롤러 보기",
      exact: true,
    })
    .click();
  await page.locator("[data-farm-chart-lab-batch-controllers]").waitFor();
  assert.equal(
    await page
      .locator("[data-farm-chart-lab-batch-controllers] [data-farm-chart-tile]")
      .count(),
    2,
  );
  await graph("SP03:1:1").waitFor();
  await page.screenshot({ path: join(output, "hierarchy-desktop.png") });
  await verifyExpandedDots("SP03:1:2", 1.6, "desktop");
  await mode("single");
  assert.equal(
    await page
      .locator("[data-chart-comparison-panels] [data-farm-chart-tile]")
      .count(),
    1,
  );
  assert.equal(await controllerTile("SP03:1:2").count(), 1);
  assert.match(page.url(), /chartW1=SP03/);
  await page.reload();
  await mode("single");
  await page
    .getByRole("button", { name: "비교 대상 고르기", exact: true })
    .click();
  await mode("batch");
  assert.equal(await checkbox("SP03:1:2").isChecked(), true);
  await checkbox("SP03:1:1").check();
  await page.getByRole("button", { name: "비교하기", exact: true }).click();
  await mode("compare");
  assert.equal(
    await page
      .locator("[data-chart-comparison-panels] [data-farm-chart-tile]")
      .count(),
    2,
  );
  await graph("SP03:1:1").waitFor();
  await graph("SP03:1:2").waitFor();
  await page.screenshot({ path: join(output, "comparison-desktop.png") });
  const left = await graph("SP03:1:2").boundingBox();
  const right = await graph("SP03:1:1").boundingBox();
  assert.ok(
    Math.abs(left.y - right.y) < 2 && Math.abs(left.x - right.x) > 100,
    "Desktop comparison must be side by side",
  );
  const beforeWheel = await controllerTile("SP03:1:2").getAttribute(
    "data-chart-lookback-hours",
  );
  await graph("SP03:1:2").hover();
  await page.mouse.wheel(0, 100);
  await page.waitForFunction(
    (old) =>
      document
        .querySelector('[data-chart-controller-key="SP03:1:2"]')
        ?.getAttribute("data-chart-lookback-hours") !== old,
    beforeWheel,
  );
  const boxes = await graph("SP03:1:2").boundingBox();
  await page.mouse.move(
    boxes.x + boxes.width * 0.25,
    boxes.y + boxes.height * 0.2,
  );
  await page.mouse.down();
  await page.mouse.move(
    boxes.x + boxes.width * 0.7,
    boxes.y + boxes.height * 0.6,
    { steps: 8 },
  );
  await page.mouse.up();
  await page.waitForFunction(
    () =>
      document.querySelectorAll('button[aria-label="스코프 해제"]').length ===
      2,
  );
  const chips = await page
    .getByRole("button", { name: "스코프 해제", exact: true })
    .evaluateAll((nodes) =>
      nodes.map((node) => node.parentElement.textContent),
    );
  assert.equal(
    chips[0],
    chips[1],
    "Zoom must select the same time range in both charts",
  );
  await page
    .getByRole("button", { name: "스코프 해제", exact: true })
    .first()
    .click();
  await page.waitForFunction(
    () =>
      document.querySelectorAll('button[aria-label="스코프 해제"]').length ===
      0,
  );
  await page
    .getByRole("button", { name: "테스트 기간 변경", exact: true })
    .click();
  await page.reload();
  await mode("compare");
  await page
    .getByRole("button", { name: "비교 대상 변경", exact: true })
    .click();
  await mode("batch");
  await checkbox("SP03:1:1").uncheck();
  await page
    .getByRole("button", {
      name: "분만사 · 2번 축사의 컨트롤러 보기",
      exact: true,
    })
    .click();
  await checkbox("SP03:2:1").check();
  await page
    .getByRole("button", {
      name: "분만사 · 1번 축사의 컨트롤러 보기",
      exact: true,
    })
    .click();
  assert.equal(
    await checkbox("SP03:1:1").isDisabled(),
    true,
    "A third comparison selection must be disabled",
  );
  await page.getByRole("button", { name: "비교하기", exact: true }).click();
  await mode("compare");
  assert.equal(await controllerTile("SP03:2:1").count(), 1);
  await page.getByRole("button", { name: /2번 축사.*차트 끄기/ }).click();
  await mode("single");
  assert.equal(await controllerTile("SP03:1:2").count(), 1);
  await page
    .getByRole("button", { name: "비교 대상 고르기", exact: true })
    .click();
  await mode("batch");
  await page
    .getByRole("button", { name: "베이비하우스의 축사 보기", exact: true })
    .click();
  await page
    .getByRole("button", {
      name: "베이비하우스 · 1번 축사의 컨트롤러 보기",
      exact: true,
    })
    .click();
  await checkbox("SP04:1:1").check();
  await page.getByRole("button", { name: "비교하기", exact: true }).click();
  await mode("compare");
  const humidity = page.getByRole("button", { name: /^습도 기본보기/ });
  await humidity.waitFor();
  assert.equal(
    await humidity.getAttribute("aria-pressed"),
    "true",
    "Humidity from either controller must remain available",
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await delay(500);
  const mobilePanels = await page
    .locator("[data-chart-comparison-panels] > div")
    .evaluateAll((nodes) =>
      nodes.map((node) => {
        const rect = node.getBoundingClientRect();
        return { x: rect.x, y: rect.y, width: rect.width };
      }),
    );
  assert.ok(
    Math.abs(mobilePanels[0].x - mobilePanels[1].x) < 2 &&
      mobilePanels[1].y > mobilePanels[0].y + 200,
    "Mobile comparison must stack vertically",
  );
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1,
    ),
    "No horizontal page overflow on mobile",
  );
  await page.screenshot({ path: join(output, "comparison-mobile.png") });
  await page
    .getByRole("button", { name: "미니그래프 목록", exact: true })
    .click();
  await mode("batch");
  await page.getByRole("region", { name: "베이비하우스 1번 축사 컨트롤러 미니그래프", exact: true }).waitFor();
  await page.screenshot({ path: join(output, "hierarchy-mobile.png") });
  await verifyExpandedDots("SP04:1:1", 1.4, "mobile");
  await page.getByRole("button", { name: "미니그래프 목록", exact: true }).click();
  await mode("batch");
  await page
    .getByRole("button", { name: "테스트 빈 농장", exact: true })
    .click();
  await page.getByText("컨트롤러가 없습니다.", { exact: true }).waitFor();
  assert.equal(
    await lab.getByRole("button", { name: "비교하기", exact: true }).count(),
    0,
  );
  assert.deepEqual(errors, [], "No browser errors");
  writeFileSync(join(output, "expanded-marker-checks.json"), JSON.stringify(markerChecks, null, 2));
  console.log("Expanded marker checks:", JSON.stringify(markerChecks));
  console.log(
    "chart-controller-comparison-smoke: PASS (hierarchy, isolated controller, same/cross-barn and cross-type comparison, URL reload, shared lookback/zoom/reset, removal, mobile, empty farm)",
  );
  console.log(`Screenshots: ${output}`);
} catch (error) {
  console.error("Browser errors:", errors);
  if (page) {
    await page
      .screenshot({ path: join(output, "failure.png") })
      .catch(() => {});
    console.error(
      (
        await page
          .locator("body")
          .innerText()
          .catch(() => "")
      ).slice(0, 2500),
    );
  }
  throw error;
} finally {
  await browser?.close();
  if (server && server.exitCode == null) {
    if (process.platform === "win32") {
      await new Promise((done) => {
        const stop = spawn(
          "taskkill",
          ["/pid", String(server.pid), "/t", "/f"],
          { windowsHide: true, stdio: "ignore" },
        );
        stop.on("close", done);
      });
    } else server.kill("SIGTERM");
  }
  if (ownedFixture) {
    assert.equal(
      fixtureDir,
      resolve(root, "src/app/auth/chart-comparison-smoke"),
    );
    rmSync(fixtureDir, { recursive: true });
    // Remove dev-generated references to the temporary route before a build.
    const generatedTypes = join(root, ".next/dev/types");
    for (const relativePath of ["app/auth/chart-comparison-smoke/page.ts", "validator.ts"]) {
      const generated = join(generatedTypes, relativePath);
      if (existsSync(generated) && readFileSync(generated, "utf8").includes("chart-comparison-smoke")) rmSync(generated);
    }
  }
}
