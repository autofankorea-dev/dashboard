/**
 * npm run smoke:controller-state
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
const fixtureDir = join(root, "src/app/auth/controller-state-smoke");
const port = Number(process.env.CONTROLLER_SMOKE_PORT ?? 3012);
const base = `http://localhost:${port}/auth/controller-state-smoke`;
const output = resolve(
  process.env.CONTROLLER_SMOKE_OUTPUT ?? join(root, "tmp/controller-state"),
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
    join(root, "scripts/fixtures/controller-state-page.tsx"),
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
  const value = page.locator('[data-panel-value]');
  const dirty = page.locator('[data-panel-dirty]');
  const check = async (locator, expected) => {
    await page.waitForFunction(({selector,expected}) => document.querySelector(selector)?.textContent === expected,
      {selector: await locator.getAttribute('data-panel-value') != null ? '[data-panel-value]' : '[data-panel-dirty]',expected});
  };
  await check(value, '24');
  assert.equal(await page.locator('[data-all-channel-settings] section').count(),3);
  const channelB = page.getByRole('region',{name:'B채널',exact:true});
  await channelB.getByRole('button',{name:'설정 ℃ 올리기',exact:true}).click();
  await page.waitForFunction(() => document.querySelector('[data-panel-channel-b]')?.textContent === '24.1');
  await check(value,'24');
  await page.getByRole('button',{name:'패널 재진입',exact:true}).click();

  await page.getByRole('button',{name:'pending',exact:true}).click();
  await check(value,'26'); await check(dirty,'false');
  assert.equal(await page.locator('[data-controller-panel-feedback]').count(),0, 'Only the channel stages show progress');
  assert.equal(await page.locator('[data-feedback-layer="overlay"]').count(),0, 'Command progress never covers the screen');
  await page.getByRole('button',{name:/A채널.*접수/}).waitFor();
  assert.equal(await page.locator('[data-panel-current]').textContent(),'24');
  await page.getByRole('button',{name:'채널 전환',exact:true}).click();
  await check(value,'24');
  await page.getByRole('button',{name:'입력 28',exact:true}).click();
  await check(value,'28');
  await page.getByRole('button',{name:'채널 전환',exact:true}).click();
  await check(value,'26');
  await page.getByRole('button',{name:'failed',exact:true}).click();
  await check(value,'26'); await check(dirty,'true');
  assert.equal(await page.locator('[data-controller-panel-feedback][role="alert"]').count(),1, 'Failure is shown inside the panel');
  assert.equal(await page.locator('[data-panel-channel-b]').textContent(),'28');
  await page.getByRole('button',{name:'pending',exact:true}).click();
  await page.getByRole('button',{name:'패널 재진입',exact:true}).click();
  await check(value,'26'); await check(dirty,'false');
  await page.getByRole('button',{name:'applied',exact:true}).click();
  await check(value,'26'); await check(dirty,'false');
  await page.waitForFunction(() => document.querySelector('[data-panel-current]')?.textContent === '26');
  assert.equal(await page.locator('[data-controller-panel-feedback][role="status"]').count(),1);
  assert.equal(await page.locator('[data-feedback-layer="overlay"]').count(),0);
  for (const [id,env,comm] of [['normal','환경 정상','통신 정상'],['alarm','환경 경고','통신 정상'],['env-caution','환경 주의','통신 정상'],['stale-alarm','환경 확인 필요','통신 주의'],['caution','환경 확인 필요','통신 주의'],['offline','환경 확인 필요','통신 경고'],['empty','환경 확인 필요','통신 정상'],['missing-alarm','환경 확인 필요','통신 정상']]) {
    const cover=page.locator(`[data-fixture-cover="${id}"]`);
    assert.equal(await cover.locator('[data-cover-environment-status]').textContent(),env);
    assert.equal(await cover.locator('[data-cover-communication-status]').textContent(),comm);
    assert.ok((await cover.locator('button').getAttribute('aria-label')).includes(env));
    if(id==='stale-alarm') assert.equal(await cover.locator('button').getAttribute('data-cover-status-level'),'warn');
    if(id==='caution'||id==='offline') assert.ok((await cover.innerText()).includes('마지막 수신'));
  }
  const alarm = page.locator('[data-alarm-probe]');
  await alarm.getByRole('spinbutton',{name:'저온 경보',exact:true}).fill('12');
  await alarm.getByRole('spinbutton',{name:'고온 경보',exact:true}).fill('40');
  await alarm.getByRole('button',{name:'경보 적용 테스트',exact:true}).click();
  await alarm.getByText('접수 · 1/3',{exact:true}).waitFor();
  assert.equal(await alarm.getByRole('spinbutton',{name:'고온 경보',exact:true}).inputValue(),'40');
  assert.ok((await alarm.innerText()).includes('현재 저온 10℃ / 고온 35℃'));
  await alarm.getByRole('button',{name:'경보 재진입 테스트',exact:true}).click();
  await alarm.getByText('접수 · 1/3',{exact:true}).waitFor();
  assert.equal(await alarm.getByRole('spinbutton',{name:'고온 경보',exact:true}).inputValue(),'40');
  await alarm.getByRole('button',{name:'경보 전송 테스트',exact:true}).click();
  await alarm.getByText('전송 · 2/3 · 장비 응답 대기',{exact:true}).waitFor();
  await alarm.getByRole('button',{name:'경보 실패 테스트',exact:true}).click();
  await alarm.getByText('전송 실패 · 입력값을 확인 후 다시 적용하세요.',{exact:true}).waitFor();
  assert.equal(await alarm.getByRole('spinbutton',{name:'저온 경보',exact:true}).inputValue(),'12');
  await page.screenshot({path:join(output,'controller-states-desktop.png')});
  await page.setViewportSize({width:390,height:844});
  await delay(300);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  for(const node of await page.locator('[data-cover-communication-status]').all()) assert.ok(await node.isVisible());
  await page.screenshot({path:join(output,'controller-states-mobile.png'),fullPage:true});
  assert.deepEqual(errors,[], 'No browser errors');
  console.log('controller-state-smoke: PASS (pending old LIVE, failed retry, channel isolation, remount, LIVE confirmation, environment/communication labels, mobile)');
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
      resolve(root, "src/app/auth/controller-state-smoke"),
    );
    rmSync(fixtureDir, { recursive: true });
    // Remove dev-generated references to the temporary route before a build.
    const generatedTypes = join(root, ".next/dev/types");
    for (const relativePath of ["app/auth/controller-state-smoke/page.ts", "validator.ts"]) {
      const generated = join(generatedTypes, relativePath);
      if (existsSync(generated) && readFileSync(generated, "utf8").includes("controller-state-smoke")) rmSync(generated);
    }
  }
}



