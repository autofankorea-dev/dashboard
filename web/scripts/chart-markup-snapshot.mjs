/**
 * npm run snapshot:chart-markup [-- --baseline <dir>]
 *
 * TrendChart 렌더 결과(SVG·오버레이 markup)를 가상 데이터로 고정 캡처한다.
 * 리팩터링 전 한 번 생성해 두고, 변경 후 --baseline 으로 비교해 diff 0 을 확인하는
 * characterization 용도. 실제 농장·계정·DB 불필요. Chrome 필요
 * (CHART_SMOKE_BROWSER_PATH 로 Chromium 경로 지정 가능).
 *
 * 출력: CHART_SNAPSHOT_OUTPUT (기본 tmp/chart-markup/) 에 <state>.html + summary.json
 * 비교: --baseline <dir> 또는 CHART_SNAPSHOT_BASELINE — 파일별 라인 diff, 다르면 exit 1
 */
import assert from "node:assert/strict";
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { chromium } from "playwright";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const fixtureDir = join(root, "src/app/auth/chart-markup-snapshot");
const port = Number(process.env.CHART_SNAPSHOT_PORT ?? 3012);
let base = `http://localhost:${port}/auth/chart-markup-snapshot`;
const output = resolve(process.env.CHART_SNAPSHOT_OUTPUT ?? join(root, "tmp/chart-markup"));
const baselineArgIdx = process.argv.indexOf("--baseline");
const baseline =
  baselineArgIdx >= 0
    ? resolve(process.argv[baselineArgIdx + 1])
    : process.env.CHART_SNAPSHOT_BASELINE
      ? resolve(process.env.CHART_SNAPSHOT_BASELINE)
      : null;
const nextCli = join(root, "node_modules/next/dist/bin/next");
const delay = (ms) => new Promise((done) => setTimeout(done, ms));

const CHART_SVG = 'svg[aria-label="추이 차트"]';
const CHART_ROOT = "[data-trend-chart-root]";

/** 렌더마다 달라지는 값만 치환 — React useId 기반 filter id, 공백 정규화 */
function normalize(html) {
  return html
    .replace(/tc-glow-[A-Za-z0-9_-]+/g, "tc-glow-ID")
    .replace(/\s+/g, " ")
    .replace(/> </g, "><")
    .replace(/></g, ">\n<")
    .trim();
}

function summarize(html) {
  const count = (re) => (html.match(re) ?? []).length;
  return {
    bytes: html.length,
    lines: html.split("\n").length,
    path: count(/<path\b/g),
    ellipse: count(/<ellipse\b/g),
    circle: count(/<circle\b/g),
    rect: count(/<rect\b/g),
    line: count(/<line\b/g),
    text: count(/<text\b/g),
    g: count(/<g\b/g),
    button: count(/<button\b/g),
    dataTourId: count(/data-tour-id=/g),
  };
}

function lineDiff(a, b, limit = 12) {
  const al = a.split("\n");
  const bl = b.split("\n");
  const out = [];
  const n = Math.max(al.length, bl.length);
  for (let i = 0; i < n && out.length < limit; i++) {
    if (al[i] !== bl[i]) {
      out.push(`  @${i + 1}\n  - ${(al[i] ?? "<EOF>").slice(0, 160)}\n  + ${(bl[i] ?? "<EOF>").slice(0, 160)}`);
    }
  }
  return out.join("\n");
}

let server;
let browser;
let ownedFixture = false;
const errors = [];
const summary = {};

try {
  assert.ok(!existsSync(fixtureDir), "Refusing to overwrite an existing fixture route");
  mkdirSync(fixtureDir, { recursive: true });
  ownedFixture = true;
  copyFileSync(
    join(root, "scripts/fixtures/chart-controller-comparison-page.tsx"),
    join(fixtureDir, "page.tsx"),
  );
  mkdirSync(output, { recursive: true });

  server = spawn(process.execPath, [nextCli, "dev", "--webpack", "--port", String(port)], {
    cwd: root,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
    env: {
      ...process.env,
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "ci-anon-key",
      SUPABASE_SERVICE_ROLE_KEY: "ci-service-role-key",
    },
  });
  let serverOutput = "";
  server.stdout.on("data", (d) => (serverOutput += d));
  server.stderr.on("data", (d) => (serverOutput += d));
  for (let i = 0; i < 120; i++) {
    if (serverOutput.includes("Ready in")) break;
    if (server.exitCode != null) break;
    await delay(500);
  }
  // "Ready in" 직후에 단일 인스턴스 거부 메시지가 뒤따라 올 수 있다 — 잠시 더 수집
  for (let i = 0; i < 6 && server.exitCode == null && !/Another next dev server/.test(serverOutput); i++) {
    await delay(500);
  }
  // Next 16은 같은 프로젝트에서 dev 서버를 하나만 허용한다. 이미 떠 있으면(로컬 `npm run dev`)
  // 그 서버를 재사용한다 — fixture 라우트는 파일 기반이라 실행 중인 서버가 바로 서빙한다.
  const existing = serverOutput.match(
    /Another next dev server is already running[\s\S]*?Local:\s+(http:\/\/localhost:\d+)/,
  );
  if (existing) {
    base = `${existing[1]}/auth/chart-markup-snapshot`;
    console.log(`chart-markup-snapshot: reusing running dev server at ${existing[1]}`);
    server = null;
    await delay(1500);
  } else {
    assert.match(serverOutput, /Ready in/, serverOutput);
  }

  browser = await chromium.launch(
    process.env.CHART_SMOKE_BROWSER_PATH
      ? { executablePath: process.env.CHART_SMOKE_BROWSER_PATH }
      : { channel: "chrome" },
  );
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
    reducedMotion: "reduce",
    deviceScaleFactor: 1,
  });
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.setDefaultTimeout(30000);
  await page.goto(base, { timeout: 120000 });
  await page.locator('[data-fixture-ready="true"]').waitFor();
  await delay(1500);

  const capture = async (name, selector) => {
    const html = await page.evaluate(
      (sel) => [...document.querySelectorAll(sel)].map((n) => n.outerHTML).join("\n<!-- NEXT -->\n"),
      selector,
    );
    const normalized = normalize(html);
    assert.ok(normalized.length > 0, `${name}: no markup for ${selector}`);
    writeFileSync(join(output, `${name}.html`), normalized + "\n");
    summary[name] = { selector, ...summarize(normalized) };
  };

  const modeIs = (value) =>
    page.waitForFunction(
      (expected) =>
        document.querySelector("[data-farm-chart-lab]")?.getAttribute("data-chart-lab-mode") === expected,
      value,
    );

  const tile = (key) => page.locator(`[data-chart-controller-key="${key}"]`);

  // 1) 계층(batch) — 축사유형 → 축사 → 컨트롤러 미니 차트 (smoke:chart-comparison 와 같은 경로)
  await modeIs("batch");
  await page.getByRole("button", { name: "분만사의 축사 보기", exact: true }).click();
  await page.locator("[data-farm-chart-lab-batch-stalls]").waitFor();
  await page
    .getByRole("button", { name: "분만사 · 1번 축사의 컨트롤러 보기", exact: true })
    .click();
  await page.locator("[data-farm-chart-lab-batch-controllers]").waitFor();
  await tile("SP03:1:1").locator(CHART_SVG).waitFor();
  await page.mouse.move(0, 0);
  await delay(1500);
  await capture("batch-controller-svgs", `[data-farm-chart-lab-batch-controllers] ${CHART_SVG}`);

  // 2) 개별(확대) — SP03:1:2. TrendChart 전체(범례·축·라벨 포함)
  await tile("SP03:1:2").getByRole("button", { name: /개별 그래프 보기/ }).click();
  await modeIs("single");
  await page.mouse.move(0, 0);
  await delay(2000);
  await capture("single-chart-root", `[data-farm-chart-lab] ${CHART_ROOT}`);

  // 3) 플롯 중앙 호버 — 십자선·호버 카드. 뷰포트 고정이라 좌표는 재현 가능
  const svgBox = await tile("SP03:1:2").locator(CHART_SVG).boundingBox();
  assert.ok(svgBox, "single chart svg has no bounding box");
  await page.mouse.move(svgBox.x + svgBox.width * 0.5, svgBox.y + svgBox.height * 0.45);
  await delay(800);
  await capture("single-hover-root", `[data-farm-chart-lab] ${CHART_ROOT}`);
  await page.mouse.move(0, 0);

  // 4) 비교 — SP03:1:1 + SP03:1:2
  await page.getByRole("button", { name: "비교 대상 고르기", exact: true }).click();
  await modeIs("batch");
  await tile("SP03:1:1").getByRole("checkbox").check();
  await page.getByRole("button", { name: "비교하기", exact: true }).click();
  await modeIs("compare");
  await tile("SP03:1:1").locator(CHART_SVG).waitFor();
  await tile("SP03:1:2").locator(CHART_SVG).waitFor();
  await page.mouse.move(0, 0);
  await delay(2000);
  await capture("compare-chart-roots", `[data-chart-comparison-panels] ${CHART_ROOT}`);

  writeFileSync(join(output, "summary.json"), JSON.stringify(summary, null, 2) + "\n");
  assert.deepEqual(errors, [], `page errors: ${errors.join(" | ")}`);

  console.log(`chart-markup-snapshot: wrote ${Object.keys(summary).length} states → ${output}`);
  for (const [name, s] of Object.entries(summary)) {
    console.log(`  ${name}: ${s.lines} lines · path ${s.path} · ellipse ${s.ellipse} · text ${s.text}`);
  }

  if (baseline) {
    let diffs = 0;
    for (const name of Object.keys(summary)) {
      const file = `${name}.html`;
      const basePath = join(baseline, file);
      if (!existsSync(basePath)) {
        diffs += 1;
        console.error(`  MISSING in baseline: ${file}`);
        continue;
      }
      const a = readFileSync(basePath, "utf8");
      const b = readFileSync(join(output, file), "utf8");
      if (a !== b) {
        diffs += 1;
        console.error(`  DIFF ${file}\n${lineDiff(a, b)}`);
      } else {
        console.log(`  same ${file}`);
      }
    }
    if (diffs) {
      console.error(`chart-markup-snapshot: ${diffs} file(s) differ from baseline ${baseline}`);
      process.exitCode = 1;
    } else {
      console.log(`chart-markup-snapshot: identical to baseline ${baseline}`);
    }
  }
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await browser?.close().catch(() => {});
  if (server && server.exitCode == null) {
    server.kill("SIGTERM");
    await Promise.race([new Promise((r) => server.once("exit", r)), delay(5000)]);
    if (server.exitCode == null) server.kill("SIGKILL");
  }
  if (ownedFixture) {
    rmSync(fixtureDir, { recursive: true, force: true });
    // dev 서버가 fixture 라우트용으로 생성한 타입 스텁 — 남으면 `tsc --noEmit`이 깨진다
    rmSync(join(root, ".next/dev/types/app/auth/chart-markup-snapshot"), {
      recursive: true,
      force: true,
    });
  }
}
