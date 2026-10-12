# 운영

배포 경로, push 전 게이트, CI, 스크립트, 장애 런북. 2026-09-17 RS 재발 방지 체크는 런북의 「미결 — 2026-09-17」절이다.


---

## 배포

## Dashboard 배포 — RS-DB-C (Vercel)

> **EC2 Cloud Agent 범위 밖** — 이 앱은 Vercel이 배포한다.  
> EC2(RS+C): Git으로 관리하지 않음. SSH 접속과 에이전트로 `rsd-rs` · `rsd-c`를 다룬다.  
> 게이트 상세: [`OPS.md`](#preview-게이트)  
> 문서 허브: [`README.md`](./README.md)

---

### 배포 기준 (정본)

**기본 경로 — Git만으로 Production 반영**

```
commit → push → main 적용 → Vercel 자동 배포
```

| 단계 | 내용 |
|------|------|
| 1. commit | 의도한 산출물 **전부** 커밋 (로컬 dirty ≠ 배포) |
| 2. push | 원격에 반영 (`feature/…` 또는 승인된 `main`) |
| 3. main 적용 | `main`에 머지·push (Production 트리거) |
| 4. Vercel | `main` 감지 → `web/` Root로 build·배포 |

- Production 도메인 예: `https://smart.autofankorea.com`
- **배포본 = Git 커밋만**. 미추적·미푸시 파일은 Vercel에 없다.
- push 전: clean tree `npm test` · `npm run verify:design` · `npm run build` (가능하면).
- **TTFB:** Production·Preview에서도 페이지 TTFB p95 **&lt; 1.5 s** 유지 ([`QA_RECORD.md`](./QA_RECORD.md) · [`OPS.md`](#preview-게이트)).

#### 특수 케이스 — Vercel CLI

장애 복구·핫픽스 검증·대시보드에서 Git 연동이 막혔을 때만 CLI를 쓴다.  
**일상 배포의 기본이 아니다.**

```bash
# 예: 프로젝트 링크·상태 확인 (로컬에서)
cd dashboard/web
npx vercel whoami
npx vercel ls
# Production 강제 redeploy 등은 사용자 승인 후
```

CLI로 Production을 건드리면 **이후 기준 커밋과 어긋날 수 있음** → 가능하면 같은 변경을 Git `main`에 되맞춰 둔다.

---

### RS-DB-C에서 dashboard 역할

| Before | After |
|--------|-------|
| `iot_room_state_decoded` (D.py INSERT) | `v_iot_raw_live` → TS decode |
| burst merge | `iot-raw-live.ts` — controllerKey별 최신 row |

EC2는 `RS.py`만 raw INSERT. decode·LIVE UI는 **이 앱** (`web/src/lib/data/*`).

---

### Supabase migration (1회, 별도 승인)

```
web/supabase/migrations/20260614000000_rs_live_views.sql
```

```sql
SELECT count(*) FROM public.v_iot_raw_live;
```

---

### Vercel 프로젝트 설정

| 설정 | 값 |
|------|-----|
| Repo | `github.com/autofankorea-dev/dashboard` |
| Vercel team / project | `autofankorea-dev` / `dashboard` |
| Operating Supabase | `fkkrjljeqxpbmazfnync` (구 `iot-cloud`/`ompufmezugftzoergdbn` **폐기**) |
| Branch (Production) | `main` |
| Root Directory | `web` |
| Functions | `icn1` (서울). 브이월드·카카오 서버 조회. 기본 `iad1`이면 지적 구획이 비어 보임 |

`main` push → 자동 build. 대시보드 **Redeploy** / CLI는 특수 케이스.

로컬 검증:

```bash
cd web
npm ci
npm test
npm run verify:design
npm run build
npm run lint
```

---

### 변경 이력

| 날짜 | 내용 |
|------|------|
| 2026-08-21 | 모델 구획: Vercel Functions `icn1`(서울). `web/vercel.json` |
| 2026-06-14 | RS-DB-C raw LIVE 조회 |
| 2026-06-14 | Cloud Agent 지침 제거 (EC2 전용으로 분리) |


---

## Preview 게이트

## Vercel Preview 게이트 (Git→배포 검증)

> **배포 실행:** 단일 에이전트 (`SI1/.cursor/rules/single-agent.mdc`).  
> **배포 기준 정본:** [`OPS.md`](#배포) — `commit → push → main → Vercel 자동배포`  
> 허브 URL: [`farm-hub-url.md`](./farm-hub-url.md) · 운영 메모: [`QA_RECORD.md`](./QA_RECORD.md)

Git에 push되면 Vercel이 **그 커밋만** 빌드·배포한다.  
로컬 dirty / 미추적 파일은 배포본에 **없다**.

### 전제

| 항목 | 요구 |
|------|------|
| 기본 경로 | commit → push → **main** → Production 자동 배포 |
| 특수 | Vercel CLI / Redeploy — 장애·핫픽스만 (`OPS.md`) |
| 반영 범위 | 의도한 산출물이 커밋에 **전부** 포함 (stub·반쪽 import 금지) |
| 브랜치 | 가능하면 `feature/…` → Preview → main (긴급 hotfix는 clean build 후 main) |
| Supabase | Vercel env = 로컬 `.env.local`과 **동일 프로젝트** (테스트 계정) |
| 빌드 | **clean tree**에서 `npm test` · `verify:design` · `build`. `tsconfig` `scripts` exclude |
| migration | SQL은 커밋에 넣되 **DB 적용은 별도 승인** |

### 완전 반영 체크 (push 전)

1. import 대상 파일이 같은 커밋/브랜치에 있는가 (`Module not found` 방지)  
2. 새 토큰·CSS·`motionClass`·env example이 같이 가는가  
3. UI가 stub/플레이스홀더로 남아 “작동안 함”처럼 보이지 않는가  
4. clean worktree `npm test` · `npm run verify:design` · `npm run build` PASS  
4b. 허브 URL/셸 변경 시 `npm run verify:hub` PASS ([`farm-hub-url.md`](./farm-hub-url.md#허브-본체-안정화--p0-관측·재현-게이트))  
4c. **TTFB:** Preview/Production에서도 페이지 TTFB p95 **&lt; 1.5 s** 유지 ([`QA_RECORD.md`](./QA_RECORD.md)). 허브·LIVE 경로 변경 시 `measure:hub-ttfb` / 브라우저 샘플 권장  
5. 보고에 포함 산출물(허브/디자인/ARIA/…)을 명시  

### 절차

1. feature(또는 hotfix)에 **완전 세트** 커밋  
2. push → (feature면 Preview) → **main 적용** → Production  
3. 스모크 예:

```bash
cd dashboard/web
UI_VERIFY_BASE=https://<preview-or-prod>.vercel.app node scripts/farm-hub-url-manual-smoke.mjs
```

4. Production 도메인 예: `https://smart.autofankorea.com`

### 스모크

`scripts/farm-hub-url-manual-smoke.mjs` — 탭·URL·soft home.  
로컬: `UI_VERIFY_BASE=http://localhost:3000`

### 이슈 메모 (단일 에이전트가 이어서 처리)

| 이슈 | 비고 |
|------|------|
| 기간 변경 줌 리셋 UX | 디자인/차트 |
| `listMode=channel`→`graph` URL 정규화 | 허브 URL · dirty 분리 커밋 권장 |
| 델린 뱃지 | 제거됨. [`farm-hub-url.md`](./farm-hub-url.md#환경-상태-정책) |


---

## CI

## GitLab CI

`.gitlab-ci.yml`은 `dashboard/` 저장소 루트에 있으며 `web/` Next.js 앱을 검증한다.

### Jobs

| Job | 용도 | 실패 시 |
| --- | --- | --- |
| `web:install` | `npm ci` | 파이프라인 중단 |
| `web:lint` | ESLint | 파이프라인 중단 |
| `web:typecheck` | `tsc --noEmit` | 파이프라인 중단 |
| `web:test` | `npm test` — vitest, `src/**/*.test.ts` · `supabase/functions/**/*.test.ts` | 파이프라인 중단 |
| `web:verify-design` | `npm run verify:design` (motion + map density) | 파이프라인 중단 |
| `web:knip` | dead files · deps · duplicates | 파이프라인 중단 |
| `web:build` | `next build --webpack` (더미 Supabase env) | 파이프라인 중단 |
| `web:audit` | Playwright UI audit (선택) | `allow_failure: true` |

### Knip

- 설정: `knip.config.ts` — `src/app`·`src/**/*.test.ts`·`scripts/*`·`scripts/fixtures/*.tsx`(스모크가 앱으로 복사하는 페이지)를 entry로 둔다. ignore: 미연결 디자인 헬퍼. `buffer`는 webpack 폴리필이라 `ignoreDependencies`.
- CI: `npm run knip` — files/dependencies/duplicates만 게이트
- 로컬 점진 정리: `npm run knip:exports` — unused export 전체 목록

### Playwright audit (`web:audit`)

로그인·LIVE 데이터가 필요하므로 **더미 env만으로는 실패**한다.  
GitLab **CI/CD Variables** (masked)에 아래를 설정한 뒤, 변수 `CI_PLAYWRIGHT_AUDIT=true` 일 때만 job이 실행된다.

| Variable | 용도 |
| --- | --- |
| `CI_PLAYWRIGHT_AUDIT` | `true` — audit job 활성화 |
| `NEXT_PUBLIC_SUPABASE_URL` | 테스트 Supabase URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role (audit 계정 비밀번호 동기화) |

테스트 계정: `scripts/test-accounts.mjs` 참고 (`admin@test.com`, `farmer@test.com`, `viewer@test.com`).

로컬과 동일하게 dev 서버 기동 후 audit 스크립트를 실행한다:

```bash
cd web
npm run dev
# 다른 터미널
npm run audit:operator-apply
npm run audit:farm-command
npm run audit:health-drilldown
```

### GitHub

원격이 GitHub(`autofankorea-dev/dashboard`)인 경우 [`../../.github/workflows/web-verify.yml`](../../.github/workflows/web-verify.yml)이  
`lint` · `typecheck` · `test` · `knip` · `verify:design` · `build`를 push/PR에서 실행한다 (GitLab job 구성과 동일).  
GitHub → Vercel이 실제 배포 경로이므로 이 workflow가 **배포 전 게이트 정본**이다.

### GitHub mirror (구 메모)

`.gitlab-ci.yml`은 GitLab 파이프라인 전용이다. GitHub Actions는 위 workflow를 사용한다.


---

## 스크립트

## scripts/ — 스크립트 분류

> 앱 문서 진입점: [`README.md`](./README.md) · 배포: [`OPS.md`](#배포)

실행 위치: 항상 `dashboard/web/` (`npm run …` 또는 `npx tsx scripts/…`).

분류: **A** CI/npm 게이트 · **B** assert·공유 · **C** 로컬 스모크·도구

---

### A — CI · package.json 게이트

| npm / 파일 | 용도 |
|------------|------|
| `npm run check` | `lint` → `typecheck` → `test` → `knip` 묶음. push 전 1회 실행 권장 |
| `npm run lint` | ESLint (Next core-web-vitals + TS + 모션/색 토큰 `no-restricted-syntax`) |
| `npm run typecheck` | `tsc --noEmit` (strict) |
| `npm run knip` | 미사용 파일·의존성·중복 export 게이트 ([`OPS.md`](#ci) § Knip) |
| `npm test` / `test:unit` → `vitest run` | `src/**/*.test.ts` · `supabase/functions/**/*.test.ts`. `test:watch`는 저장 시 재실행, `test:coverage`는 v8 줄 커버리지 |
| `verify:hub` → `verify-hub.mjs` | 허브 URL·keep-alive 유닛 ([`farm-hub-url.md`](./farm-hub-url.md#허브-본체-안정화--p0-관측·재현-게이트)) |
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

GitLab(`.gitlab-ci.yml`)과 GitHub(`.github/workflows/web-verify.yml`) 모두 `lint` · `typecheck` · `test` · `knip` · `verify:design` · `build`를 동일하게 돌린다 (2026-10 정렬).

---

### B — assert (로컬 · 선택적으로 `npm test`에 흡수 가능)

| 파일 | 용도 |
|------|------|
| `assert-channel-fan-band.ts` | 채널 팬 밴드 |
| `assert-command-pipeline-id-ttl.ts` | 명령 파이프라인 ID/TTL |
| `assert-scoped-panel-hydrate.ts` | 스코프 패널 hydrate |

---

### C — 로컬 스모크 · 도구 (CI 비포함)

| 파일 | 용도 |
|------|------|
| `e2e-farm-hub-boot-smoke.mjs` (`npm run smoke:boot`) | 부트 스모크 — 미인증 `/farm`→`/login` 가드·로그인 렌더 (**시크릿 불필요·CI 친화**) |
| `chart-controller-comparison-smoke.mjs` (`npm run smoke:chart-comparison`) | 가상 데이터로 미니그래프 3단계·개별/비교·URL 복원·공통 확대·모바일 검증. PC·모바일 확장 애니메이션의 매 프레임 dot 크기와 최종 원형 크기도 검사. 로컬 Next 서버와 임시 `/auth` fixture를 생성하고 종료 때 제거. Chrome 필요 (`CHART_SMOKE_BROWSER_PATH`로 Chromium 경로 지정 가능). 운영 계정·DB 불필요 |
| `chart-markup-snapshot.mjs` (`npm run snapshot:chart-markup [-- --baseline <dir>]`) | **TrendChart characterization** — 가상 데이터 fixture로 계층(batch)·개별·호버·비교 4상태의 SVG/오버레이 markup을 `tmp/chart-markup/`에 고정 캡처(`useId` 기반 id 정규화). 리팩터링 전 베이스라인을 만들고 `--baseline`으로 비교해 **diff 0**을 확인한다. 이미 `npm run dev`가 떠 있으면 그 서버를 재사용. Chrome 필요(`CHART_SMOKE_BROWSER_PATH`). 출력 경로 `CHART_SNAPSHOT_OUTPUT` |
| `controller-state-smoke.mjs` (`npm run smoke:controller-state`) | 가상 명령 상태로 이전 LIVE 수신 중 제출값 유지·실패 후 재시도·채널 독립·패널 재진입·LIVE 일치와 덮개의 환경/통신 문구를 PC·모바일에서 검증. 실제 명령은 전송하지 않음. 임시 `/auth` fixture와 로컬 서버는 종료 때 제거 |
| `farm-hub-url-manual-smoke.mjs` (`npm run smoke:hub-url`) | 허브 URL·탭·soft home + 404 폴백 — [`OPS.md`](#preview-게이트) · [`farm-hub-url.md`](./farm-hub-url.md#허브-본체-안정화--p0-관측·재현-게이트) (test-accounts 필요) |
| `test:e2e` (npm) | 위 둘 묶음 — 부트(미인증)→인증 핵심 플로 E2E 게이트. 서버 기동 + `.env.local`(Supabase) 필요 |
| `verify-channel-bulk-commands.mjs` | 채널 일괄 명령 |
| `set-test-passwords.mjs` / `test-accounts.mjs` | 로컬 테스트 계정 (비밀값 커밋 금지) |
| `ship-gate-ce-smoke.mjs` | 목록 LIVE 표본 · 옛 `view=aria` 에 DELIN 배지 없음 |

---

### gitignore · 커밋 금지

| 경로 | 비고 |
|------|------|
| `mobile-audit-output/` | audit·스모크 산출 |
| `tmp/` · `../tmp/` | 임시 |
| `post-push-ui-verify.log` | 로컬 로그 |


---

## 장애·런북

## 운영 Runbook — 장애 · 배포 · 모니터링

> **상위:** [`SYSTEM_APP.md`](./SYSTEM_APP.md#시스템-총론) §3 · **계층별 상세:** [`SYSTEM_INSTANCE.md`](./SYSTEM_INSTANCE.md) · [`SYSTEM_DB.md`](./SYSTEM_DB.md) · [`SYSTEM_APP.md`](./SYSTEM_APP.md#nextjs)

---

### 1. 설계 전제 (runbook이 RS-DB-C 순서를 따르는 이유)

장애는 **아래에서 위로** 좁힌다 — 상위(UI)부터 보면 raw/decode 원인을 놓친다.

| 순서 | 계층 | 이유 |
|------|------|------|
| 1 | **영향 범위** | LIVE 전체 vs 농장 vs 명령만 — 병렬 triage 방지 |
| 2 | **R Instance** | uplink·downlink **원천** — DB/UI 정상이어도 raw 공백 가능 |
| 3 | **S DB decode** | raw 있음·decoded 없음 = Edge/cursor/sparse |
| 4 | **S DB read** | decoded 있음·view empty = 2h hot · RLS |
| 5 | **C Next.js** | DB OK·UI만 깨짐 = tier · env · 배포 SHA |
| 6 | **기록** | incident md · 복구 커밋 · 미결은 §8 |

---

### 2. 배포·게이트

#### 2.1 Vercel (대시보드)

| 단계 | 절차 | 문서 |
|------|------|------|
| 로컬 | `npm ci` · `npm test` · `verify:design` · `build` · `lint` | [`OPS.md`](#스크립트) |
| Git | feature → (Preview) → **main** push | [`OPS.md`](#배포) |
| Production | Vercel auto · `smart.autofankorea.com` | [`OPS.md`](#preview-게이트) |
| Preview 스모크 | `UI_VERIFY_BASE=... npm run smoke:hub-url` | |
| 특수 redeploy | 장애/핫픽스만 — **이후 Git main 맞출 것** | |

| 항목 | 값 |
|------|-----|
| Repo | `github.com/SIJackLee/dashboard` |
| Root | `web` |
| Functions | `icn1` |

#### 2.2 DB migration

| 규칙 | 내용 |
|------|------|
| 정본 | `web/supabase/migrations/` |
| 적용 | **사용자 명시 승인 후만** |
| 롤백 | forward migration만 — DROP COLUMN 복구 불가 |
| retention cron | dry-run → trend 스모크 → `active=false` ([`IOT_RETENTION_OPTIONS.md`](./IOT_RETENTION_OPTIONS.md)) |

#### 2.3 EC2 (Instance)

| 작업 | 절차 |
|------|------|
| RS 롤백 | `cp wire_decode.py.bak.phase3 wire_decode.py && sudo systemctl restart rsd-rs` |
| systemd·env | SSH·에이전트 — **승인 후** |
| 키 로테 | Supabase + EC2 동시 — 문서에 값 기록 금지 |

---

### 3. 모니터링 신호

#### 3.1 통합 표

| 신호 | 어디서 | warn | critical / 의미 |
|------|--------|------|-----------------|
| LIVE empty | `v_iot_decoded_latest` / list | 2h 0건 | uplink 또는 decode/read |
| 카드 caution | `live-status.ts` | 수신 OK + 측정 60m+ 정체 | replay·장비 시계 |
| Instance stale | `instance_health_current.checked_at` | 10m | 30m unknown |
| decode backlog | `iot_decode_cursor` lag | 100 rows | 500 rows |
| decode fail | `iot_room_state_decode_failed` | row 증가 | INVALID_STALL_TY |
| sent stuck | `ctrl_thermo_command` + Health C | TTL 300s+ | C.py / ACK |
| mem/disk | instance_health | mem <200MB · disk >85% | RS 노드 |
| insert rate | raw buckets (admin) | 3×5min drop | D11 hints |
| 용량 | Supabase metrics | trend ↑ | retention cron |
| 배포 drift | Vercel SHA | ≠ main | dirty local |

#### 3.2 admin `/admin/ops` DAG

- **Instance:** mqtt/rs/c · mem · disk · raw_last_received
- **Command:** 24h sent/applied · checkpoint
- **Decode:** cursor lag · failed count
- **Raw:** insert buckets

접근: admin role + `SUPABASE_SERVICE_ROLE_KEY` (server only).

---

### 4. 장애 시나리오별 runbook

#### 4.1 LIVE 전체 empty

```text
[1] 사용자 영향 — 모든 농장 vs 특정 farm
[2] instance_health — mqtt/rs · raw_last_received_at
[3] SQL — max(received_at) FROM iot_room_state_raw (전체/ farm)
[4] raw 없음 → Instance triage (§4.2)
[5] raw 있음 · decoded 없음 → decode (§4.3)
[6] decoded 있음 · view 0 → read (§4.4)
[7] DB OK · UI empty → app (§4.5)
```

#### 4.2 Uplink 중단 (raw 공백)

| 확인 | 명령/위치 |
|------|-----------|
| EC2 헬스 | `/admin/ops` · `instance_health_current` |
| MQTT | `mqtt_listen`, `mqtt_roundtrip` |
| 현장 | 통신모듈 전원 · RS-485 |
| RS | `sudo systemctl status rsd-rs` (SSH) |
| 재시작 | wire_decode 롤백 + `restart rsd-rs` |

참고: [`COMMANDS.md`](./COMMANDS.md#부록--farm02-ack)

#### 4.3 Decode 실패 / backlog

| 확인 | 명령/위치 |
|------|-----------|
| cursor lag | `iot_decode_cursor` vs max raw id |
| failed | `iot_room_state_decode_failed` 최근 |
| Edge log | Supabase Functions `decode-batch` |
| sparse | 값 무변화 skip — **정상일 수 있음** |
| clock | `clock_kst_farm_keys` FARM02/03 |
| partition | `ensure_iot_decoded_month_partitions` cron |

#### 4.4 Read path (데이터 있음 · 카드 empty)

| 확인 | 내용 |
|------|------|
| 2h hot | `received_at > now()-2h` — replay는 창 밖 |
| tier | `NEXT_PUBLIC_LIVE_READ_TIER` list vs latest |
| RLS | `user_access` · farm key |
| session | 로그인 farm scope |

검증: `SELECT count(*) FROM v_iot_dashboard_list;` (service_role)

#### 4.5 버퍼 replay (오늘 수신 · 과거 측정)

| 관찰 | 해석 |
|------|------|
| `received_at` 오늘 | EC2/MQTT 수신 OK |
| `mesure_at` 8/30·8/31 | 장비 버퍼 재전송 |
| 카드 caution | 측정 60m+ 정체 — **정상 표시** |
| 차트 | `mesure_at` 축 — received 아님 |

clock_kst −9h 적용 후에도 과거 mesure는 **replay**.

#### 4.6 명령 미반영

| 확인 | 내용 |
|------|------|
| DB row | `status` pending/sent/applied |
| C.py | Health C · `command_last_sent_at` |
| ACK | LIVE thermo vs command payload |
| TTL | 300s — stale sent |
| UI | **applied 환각 없음** — DB만 |

FARM02 사례: sent만 · applied 0 — 장비/펌웨어 triage.

#### 4.7 Production만 깨짐

1. Vercel deployment commit = `origin/main` HEAD?
2. Production env vs Preview diff
3. `NEXT_PUBLIC_*` tier/flag
4. 최근 migration **적용 여부** (승인 없이 적용됐는지)

#### 4.8 RLS / 권한 (데이터 있음 · operator 빈 화면)

1. `user_access` farm row
2. admin impersonation vs operator session
3. Supabase advisor — partition child RLS

#### 4.9 FARM01 30일 차트 시각 재배치 (C안, 2026-09-17)

시뮬 수신이 8월 28일에 멈춰 30일 1시간 칸이 비던 것을, **값·키는 유지**하고 측정·수신 시각만 최근 30일로 폈다. clock_kst 목록에는 넣지 않음.

| 백업 | 내용 |
|------|------|
| `_bak_farm01_c_decoded_20260917` | decoded 118,840행 |
| `_bak_farm01_c_raw_20260917` | raw 122,780행 |
| `_bak_farm01_c_last_20260917` | last_value 13대 |
| `_farm01_c_map_20260917` | id → 신·구 시각 |

롤백: 백업으로 되돌릴 때는 파티션 키(`mesure_at`) 이동이 다시 일어난다.

---

### 5. incident 기록

| 필드 | 내용 |
|------|------|
| 시작/종료 | KST |
| 영향 | farm · LIVE/명령/차트 |
| 계층 | R / S / C |
| 근본 원인 | 1줄 |
| 복구 | commit · restart · config |
| 후속 | migration · rsd · 문서 |

저장: `docs/incidents/YYYYMMDD-*.md` (승인 후). 열린 체크는 이 런북에 둔다. [`QA_RECORD.md`](./QA_RECORD.md)는 스냅샷만.

---

### 6. 변경 금지 (승인 필수)

- 운영 DB migration · RLS 삭제 · retention DELETE
- Production env · `service_role` 노출
- EC2 force · main force push
- UI/UX H1–H5 — [`UI_*`](./UI.md#면) 별도 게이트

---

### 7. 빠른 참조 — 계층 문서

| 증상 1차 | 문서 |
|----------|------|
| MQTT·raw | [`SYSTEM_INSTANCE.md`](./SYSTEM_INSTANCE.md) §3 |
| decode·view·RLS | [`SYSTEM_DB.md`](./SYSTEM_DB.md) §3 |
| tier·Actions·hub URL | [`SYSTEM_APP.md`](./SYSTEM_APP.md#nextjs) §D |
| 출고 QA | [`QA_SHIP_GATE.md`](./QA_SHIP_GATE.md) |

---

### 8. 미결 — 2026-09-17 RS 수집 공백 재발 방지

서비스는 복구됐다. `17:14~18:49 KST` 약 95분 raw는 복구하지 못한다. 원인·흐름은 [`SYSTEM_INSTANCE.md`](./SYSTEM_INSTANCE.md#6-2026-09-17-rs-수집-공백).

목표 흐름:

```text
MQTT → RS 수신 → SQLite Outbox commit → MQTT ACK
                                  ↓
                         DB worker → Supabase
```

#### P0 — RS durable Outbox

- [ ] EC2에서 도는 `RS.py`의 MQTT callback·DB flush 구조 확인
- [ ] MQTT callback에서 SQLite WAL Outbox에 먼저 commit
- [ ] Outbox와 Supabase 전송 worker 분리
- [ ] DB 실패 시 exponential backoff와 circuit breaker 적용
- [ ] RS 재시작 후 미전송 행을 오래된 순서로 자동 전송
- [ ] Outbox를 72시간 및 2~5GB 중 먼저 도달한 상한으로 제한
- [ ] 디스크 여유 20% 이하, Outbox oldest age·row count 경보
- [ ] Supabase 성공이 불명확한 timeout 재시도에 대비한 idempotency 설계

#### P1 — MQTT·DB 방어선

- [ ] RS 고정 `client_id`와 persistent session 적용 검토
- [ ] Mosquitto `persistence true`·queued message 상한·디스크 경보 검증
- [ ] raw `ingest_key` unique 제약 필요성 검토
- [ ] 운영 MCP/SQL 역할에 `statement_timeout`·`lock_timeout` 적용 검토
- [ ] 대형 SQL은 실행 전 `EXPLAIN`, 범위·예상 비용·운영 영향 확인
- [ ] 무거운 분석 쿼리는 read replica 또는 별도 분석 경로로 분리 검토

DB migration, Mosquitto 설정, EC2 systemd 변경과 운영 재시작은 각각 영향도를 확인하고 별도 승인 후 적용한다.

#### 완료 조건

1. Supabase 연결을 30분 차단한 동안 MQTT payload가 Outbox에 보존된다.
2. DB 장애 중 `rsd-rs`를 재시작해도 Outbox 행이 유지된다.
3. DB 복구 후 모든 행이 자동 저장되며 누락과 중복이 없다.
4. Outbox 상한과 디스크 경보가 동작한다.
5. `raw_last_received_at`과 Outbox oldest age가 운영 화면 또는 알림에 노출된다.

#### 롤백

- 기존 `RS.py`와 systemd unit을 보존하고 문제 발생 시 이전 버전으로 복원한다.
- 롤백 시에도 SQLite Outbox 파일은 삭제하지 않는다.
- DB schema 변경이 포함되면 forward migration 방식으로 별도 롤백 계획을 작성한다.

---

### 변경 이력

| 날짜 | 내용 |
|------|------|
| 2026-10-12 | 2026-09-17 RS 공백 재발 방지 체크를 §8로 모음 |
| 2026-09-17 | FARM01 C안 시각 재배치 · 백업 테이블 §4.9 |
| 2026-09-01 | 초안 — 배포·모니터링·시나리오 runbook (Canvas §3 승인 반영) |
