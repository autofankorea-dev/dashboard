# scripts/ — 스크립트 분류

> 앱 문서 진입점: [`README.md`](./README.md) · 배포: [`CLOUD_DEPLOY.md`](./CLOUD_DEPLOY.md)

실행 위치: 항상 `dashboard/web/` (`npm run …` 또는 `npx tsx scripts/…`).

분류: **A** CI/npm 게이트 · **B** assert·공유 · **C** 로컬 스모크·도구 · **D** archive(일회성)

---

## A — CI · package.json 게이트

| npm / 파일 | 용도 |
|------------|------|
| `npm test` / `test:unit` → `run-unit-tests.mjs` | `src/**/*.test.ts` · `supabase/functions/**/*.test.ts` |
| `verify:hub` → `verify-hub.mjs` | 허브 URL·keep-alive 유닛 ([`HUB_STABILITY_P0.md`](./HUB_STABILITY_P0.md)) |
| `verify:design` | `verify-motion-classes` + `verify-ui-density` + `verify-ui-affordance` |
| `verify:motion-css` / `verify:motion-tokens` / `verify:motion-classes` | 모션 |
| `verify:ui-colors` / `verify:ui-density` / `verify:ui-elevation` / `verify:ui-affordance` | UI 토큰·밀도·어포던스 (colors/elevation은 Production 팔레트와 충돌 가능. affordance는 `verify:design`에 포함) |
| `audit:ship-checklist` → `ship-checklist-audit.mjs` | 출고 체크리스트 |
| `audit:operator-apply` → `operator-apply-audit.mjs` | 적용 감사 |
| `audit:farm-command` → `farm-command-audit.mjs` | 명령 파이프라인 |
| `audit:health-drilldown` → `health-drilldown-audit.mjs` | 헬스 드릴다운 |
| `audit:mobile-*` / `audit:motion-reduced` / `audit:touch-mobile-layout` | 모바일·모션 감사 |
| `measure:live` → `measure-live-read.ts` | LIVE 읽기 |
| `measure:hub-ttfb` → `measure-hub-ttfb.mjs` | 허브 TTFB |
| `audit-shared.mjs` | 감사 공통 (직접 실행 아님) |

GitLab `web:test` / `web:verify-design`, GitHub `.github/workflows/web-verify.yml`이 A 일부를 돌린다.

---

## B — assert (로컬 · 선택적으로 `npm test`에 흡수 가능)

| 파일 | 용도 |
|------|------|
| `assert-channel-fan-band.ts` | 채널 팬 밴드 |
| `assert-command-pipeline-id-ttl.ts` | 명령 파이프라인 ID/TTL |
| `assert-scoped-panel-hydrate.ts` | 스코프 패널 hydrate |

---

## C — 로컬 스모크 · 도구 (CI 비포함)

| 파일 | 용도 |
|------|------|
| `e2e-farm-hub-boot-smoke.mjs` (`npm run smoke:boot`) | 부트 스모크 — 미인증 `/farm`→`/login` 가드·로그인 렌더 (**시크릿 불필요·CI 친화**) |
| `chart-controller-comparison-smoke.mjs` (`npm run smoke:chart-comparison`) | 가상 데이터로 미니그래프 3단계·개별/비교·URL 복원·공통 확대·모바일 검증. PC·모바일 확장 애니메이션의 매 프레임 dot 크기와 최종 원형 크기도 검사. 로컬 Next 서버와 임시 `/auth` fixture를 생성하고 종료 때 제거. Chrome 필요 (`CHART_SMOKE_BROWSER_PATH`로 Chromium 경로 지정 가능). 운영 계정·DB 불필요 |
| `farm-hub-url-manual-smoke.mjs` (`npm run smoke:hub-url`) | 허브 URL·탭·soft home + 404 폴백 — [`VERCEL_PREVIEW_GATE.md`](./VERCEL_PREVIEW_GATE.md) · [`HUB_STABILITY_P0.md`](./HUB_STABILITY_P0.md) (test-accounts 필요) |
| `test:e2e` (npm) | 위 둘 묶음 — 부트(미인증)→인증 핵심 플로 E2E 게이트. 서버 기동 + `.env.local`(Supabase) 필요 |
| `verify-channel-bulk-commands.mjs` | 채널 일괄 명령 |
| `set-test-passwords.mjs` / `test-accounts.mjs` | 로컬 테스트 계정 (비밀값 커밋 금지) |

---

## D — archive (일회성 · 재실행 시만)

경로: `scripts/archive/` — 설명은 [`scripts/archive/README.md`](../scripts/archive/README.md).

| 파일 | 당시 용도 |
|------|-----------|
| `ship-p0-gate-smoke.mjs` | P0 hydration·테마·적용·LIVE |
| `ship-p0-visibility-poll-smoke.mjs` | 탭 숨김·대량 LIVE 폴링 |
| `manual-scenarios-13562-smoke.mjs` | 수동 시나리오 자동화 |
| `diag-tab-hidden-poll.mjs` | 탭 숨김 폴링 진단 |
| `detailed-reverify.mjs` | 상세 재검증 |
| `graph-mode-card-collapse-smoke.mjs` | 그래프 모드 카드 접힘 |
| `daily-report-qa-a.mts` | 일보 QA |
| `daily-report-payload-smoke.mts` | 일보 payload 스모크 |

과거 PASS 기록은 [`SHIP_CHECKLIST.md`](./SHIP_CHECKLIST.md)에 남김. 경로만 `scripts/archive/…`로 갱신.

---

## gitignore · 커밋 금지

| 경로 | 비고 |
|------|------|
| `mobile-audit-output/` | audit·스모크 산출 |
| `tmp/` · `../tmp/` | 임시 |
| `post-push-ui-verify.log` | 로컬 로그 |
