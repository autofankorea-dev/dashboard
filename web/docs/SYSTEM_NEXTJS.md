# Next.js — Backend · Frontend

> **상위:** [`SYSTEM.md`](./SYSTEM.md) §2.3–2.4 · **배포:** [`CLOUD_DEPLOY.md`](./CLOUD_DEPLOY.md)  
> **UI 토큰:** [`UI_SURFACES.md`](./UI_SURFACES.md) 등 — 본 문서는 **시스템 경로·데이터 binding**만.

---

## Part A — Backend (Server)

### A.1 설계 이유

| 결정 | 설계 이유 | 하지 않은 것 | 근거 |
|------|-----------|--------------|------|
| **decode는 Next가 안 함** | wire decode·sparse·clock = Edge+DB. Vercel timeout·raw scan 부적합 | API decode proxy · RSC raw loop | [`CLOUD_DEPLOY.md`](./CLOUD_DEPLOY.md) |
| **명령 Server Action→DB** | 브라우저 MQTT 불가 · RLS·감사 · C.py만 downlink | 클라 MQTT · API→EC2 HTTP | [`controllers/actions.ts`](../src/app/(dashboard)/controllers/actions.ts) |
| **LIVE read tier env** | list(경량) vs latest(channels). farm 규모·Functions 한도 | 항상 latest · 클라 only Supabase | [`iot-live-fetch.ts`](../src/lib/data/iot-live-fetch.ts) |
| **admin health service_role** | 전국 `instance_health` RLS 밖 · `server-only` | anon 헬스 · EC2 SSH | [`fetch-snapshot.ts`](../src/lib/admin/health/fetch-snapshot.ts) |
| **Vercel icn1 + webpack** | 국내 latency · Next16 webpack 정본 build | EC2 UI 호스팅 | `web/vercel.json` |

### A.2 런타임·배포

| 항목 | 값 |
|------|-----|
| Framework | Next.js 16 App Router |
| Build | **webpack** (`npm run build`) |
| Hosting | Vercel · root `web` |
| Functions region | `icn1` (서울) |
| Production | `https://smart.autofankorea.com` |

### A.3 진입점 (Server)

| 유형 | 경로 | 역할 |
|------|------|------|
| Middleware | [`src/proxy.ts`](../src/proxy.ts) | 세션 · `/login` 리다이렉트 |
| Auth | [`lib/auth/get-current-user.ts`](../src/lib/auth/get-current-user.ts) | profile + access |
| Admin gate | [`lib/auth/require-admin.ts`](../src/lib/auth/require-admin.ts) | `/admin/*` |
| Supabase RLS | [`lib/supabase/server.ts`](../src/lib/supabase/server.ts) | cookie session |
| Supabase admin | [`lib/supabase/admin.ts`](../src/lib/supabase/admin.ts) | service_role · `server-only` |

### A.4 LIVE read path

**진입:** [`lib/data/iot.ts`](../src/lib/data/iot.ts) → [`iot-live-fetch.ts`](../src/lib/data/iot-live-fetch.ts)

| tier | view / fallback | when |
|------|-----------------|------|
| **list** | `v_iot_dashboard_list` | `slim:true` OR (`tier=list` AND NOT farm-scoped) |
| **latest** | `v_iot_decoded_latest` | farm-scoped panel · `channels[]` 필요 |
| **fallback** | `iot_room_state_decoded` last-known | 2h hot 0건 · farm-scoped만 |
| **overview** | `v_iot_farm_overview` | admin hub batch |

설정: [`live-config.ts`](../src/lib/data/live-config.ts) · env `NEXT_PUBLIC_LIVE_READ_TIER`  
SELECT 계약: [`live-read-select.ts`](../src/lib/data/live-read-select.ts)  
신선도: [`live-status.ts`](../src/lib/data/live-status.ts) — received+mesure → caution

| limit / cache | 값 |
|---------------|-----|
| `LIVE_FARM_ROW_LIMIT` | 500 |
| `GLOBAL_LIVE_ROW_LIMIT` | 1500 |
| `LIVE_CACHE_REVALIDATE_SECONDS` | 300 |
| cache tag | `live:{farmScope}` |

### A.5 Server Actions — farm

파일: [`app/(dashboard)/farm/actions.ts`](../src/app/(dashboard)/farm/actions.ts)

| Action | 역할 |
|--------|------|
| `fetchFarmScopedLiveDataAction` | soft refresh LIVE |
| `fetchFarmScopedPanelDataAction` | full panel |
| `fetchFarmTrend*Action` | 추이 · coverage RPC |
| `fetchFarmControllerTrend30dDayAction` | 허브 30일 1시간 축의 하루 조각 (클라 최대 3개 병렬, 화면은 최신→과거) |
| `fetchActiveModuleAlarmsAction` / `ack*` | 모듈 경보 |
| `fetchDailyReportPayloadAction` | PDF payload |
| `revalidateFarmLiveAction` | LIVE cache 무효화 |
| `saveBarnGridsAction` / `persistBarnLayoutsAction` | 지도 레이아웃 |

차트 명령 레인 이력은 `loadFarmScopedPanelData` / `/farm` SSR에서 **해당 농장 · 30일 · pending/sent/applied · limit 500**. 전역 최근 100건만 가져오면 당일 대량이 이전 날짜 점을 밀어낸다.

### A.6 Server Actions — 명령

파일: [`app/(dashboard)/controllers/actions.ts`](../src/app/(dashboard)/controllers/actions.ts)

| Action | 역할 |
|--------|------|
| `sendThermoCommandAction` | `ctrl_thermo_command` insert `pending` |
| `sendBulkThermoCommandAction` | N건 bulk |
| `fetchThermoCommandAction` / `Batch` | ACK 폴링 |

- action types: `SET_CHANNEL_THERMO` · `SET_CTRL_THERMO`
- insert 후 `revalidateLiveCache` only — `revalidatePath /farm` 생략 (패널 흔들림 방지)
- **「적용했습니다」 UI 금지** — DB `applied`/`sent`만 반영

### A.7 API routes

`web/src/app/api/` 하위:

| Method | Path | 파일 | 역할 |
|--------|------|------|------|
| GET | `/api/live/controller` | [`api/live/controller/route.ts`](../src/app/api/live/controller/route.ts) | 단건 LIVE detail |
| GET | `/api/farm-plan/sat-overlay` | [`api/farm-plan/sat-overlay/route.ts`](../src/app/api/farm-plan/sat-overlay/route.ts) | 위성 타일 (nodejs) |

기타 route handlers:

| Path | 파일 |
|------|------|
| `/auth/callback` | [`auth/callback/route.ts`](../src/app/auth/callback/route.ts) |
| `/app/download` | [`app/download/route.ts`](../src/app/download/route.ts) — APK signed URL |

> DELIN `/api/voice-report` — PoC·env gate ([`aria-protocol.md`](./aria-protocol.md)). 미구현 구간은 env off.

### A.8 Admin health DAG

| 모듈 | 역할 |
|------|------|
| [`fetch-instance-health.ts`](../src/lib/admin/health/fetch-instance-health.ts) | `instance_health_current` |
| [`fetch-command-health.ts`](../src/lib/admin/health/fetch-command-health.ts) | sent 24h · checkpoint |
| [`fetch-snapshot.ts`](../src/lib/admin/health/fetch-snapshot.ts) | DAG 조립 · decode lag · raw buckets |
| [`fetch-ekape-health.ts`](../src/lib/admin/health/fetch-ekape-health.ts) | 외부 연계 (Ekape/FTP) — **미구현** · Health DAG 대기 |

신선도: `checked_at` 10m warn · 30m unknown ([`constants.ts`](../src/lib/admin/health/constants.ts)).

### A.9 PDF · report

- [`lib/report/build-daily-report-pdf*.ts`](../src/lib/report/) — 서버/클라 PDF
- 차트 축: **`mesure_at`** (received 아님)

---

## Part B — Frontend (Client)

### B.1 설계 이유

| 결정 | 설계 이유 | 하지 않은 것 | 근거 |
|------|-----------|--------------|------|
| **URL hub contract** | 딥링크·새로고침·Capacitor 동일 · `resolveFarmHubView` | 탭별 localStorage · 임의 query | [`farm-hub-url.md`](./farm-hub-url.md) |
| **received vs mesure UI** | caution=측정 정체 · 채널색≠상태색 · replay 구분 | received만 LIVE | [`UI_CHROMA.md`](./UI_CHROMA.md) |
| **RSC+client hybrid** | LIVE SSR prefetch · 차트/맵 client · SWR | 전 CSR · 전 RSC blocking | [`PROJECT_CONTEXT.md`](./PROJECT_CONTEXT.md) §10 |
| **델린 view=aria** | NLP PoC 허브 탭 격리 · `ARIA_PROTOCOL_V1` | 전역 챗봇 | [`aria-protocol.md`](./aria-protocol.md) |
| **명령 UX — 즉시 반영(낙관)** | insert 직후 패치 · 설정은 한눈 행 채움 · 일괄은 필드 덮개에서 접수→확인 | 확인 전 UI 동결 | [`controller-env-cover.tsx`](../src/components/farm/controller-env-cover.tsx) · [`settings-glance-strip.tsx`](../src/components/farm/settings-glance-strip.tsx) · [`UI_FEEDBACK.md`](./UI_FEEDBACK.md) |

### B.2 라우트·역할

| 라우트 | 파일 | 역할 | 데이터 |
|--------|------|------|--------|
| `/farm` | [`farm/page.tsx`](../src/app/(dashboard)/farm/page.tsx) | 허브 (map/list/chart/델린) | iot-live-fetch · trend RPC |
| `/admin/ops` | [`admin/ops/`](../src/app/(dashboard)/admin/ops/) | 헬스 DAG | service_role |
| `/settings` | settings | 알람·프로필 | profiles |
| `/login` · `/pending` | auth | gate | Supabase Auth |
| redirect | `/controllers` · `/alarms` | → `/farm` | |

**역할 매트릭스 (요약):**

| 역할 | /farm | /admin/ops | 명령 insert |
|------|-------|------------|-------------|
| viewer | read | ✗ | ✗ |
| operator | read | ✗ | farm scope |
| admin | read | read | all + health |

### B.3 허브 URL (query contract)

정본: [`farm-hub-url.md`](./farm-hub-url.md)

| 키 | 의미 |
|----|------|
| `lsind` / `item` | 농장 |
| `view` | 없음=map · `list|chart|model` · `aria|jarvis`→map |
| `trendPeriod` | 없음=7d · `24h|30d` |
| `sp`, `mapLevel`, `stall` | 그리드 drill |
| `listMode` | `controller|graph|settings` |
| `chartSp`, `chartStall`, `chartCtrl`, `chartW1`, `chartW2`, … | 차트 drill · 위젯 칸 |

**Epoch:** `farmUrlEpoch` (shallow) · `hubUrlEpoch` (탭/농장) — **기간만 변경 시 hub epoch bump 금지**.

구현: [`farm-view-url.ts`](../src/lib/farm/farm-view-url.ts) · [`use-farm-hub-view-shell`](../src/components/farm/)

### B.4 컴ponent 축

| 영역 | 컴포넌트 | 관심사 |
|------|----------|--------|
| 필드 | `FarmMapView` · `FarmMapCard` | LIVE · env cover |
| 목록 | `BarnListSummary` · `ControllerCardGrid` | gauge · caution |
| 차트 | `TrendChart` · `UnifiedBarnTrendPanel` | `mesure_at` · coverage |
| 일괄 | `farm-map-bulk-apply` | 명령 draft |
| 델린 | `farm-aria-view` · `delin-env-badge` | `view=aria` · env flag |
| keep-alive | [`farm-hub-keepalive.ts`](../src/lib/farm/farm-hub-keepalive.ts) | list 5m / chart 3m TTL |

### B.5 Prefetch · bootstrap

| 훅 | 역할 |
|----|------|
| [`warm-post-login-farm-hub.ts`](../src/lib/farm/warm-post-login-farm-hub.ts) | 로그인 후 panel + 24h 추이 |
| admin warm | `warmAdminHubOverviewCache` (`SKIP_ADMIN_HUB_WARM=1`로 off) |
| 스플래시 | 필드 LIVE bootstrap + 1프레임 paint (`NavContentReadyMarker`) |

### B.6 Android

- Capacitor · OAuth · APK: [`android-app-install.md`](./android-app-install.md) · [`android-push.md`](./android-push.md)
- `CAPACITOR_SERVER_URL` — Production URL

---

## Part C — 환경변수 (이름만)

| 그룹 | 변수 |
|------|------|
| Core | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` |
| LIVE/허브 | `NEXT_PUBLIC_LIVE_READ_TIER`, `NEXT_PUBLIC_FARM_FIELD_MERGE_V1`, `NEXT_PUBLIC_DELIN_ENABLED` |
| Auth | `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_GOOGLE_WEB_CLIENT_ID`, `KAKAO_*` |
| Maps | `KAKAO_JS_KEY`, `KAKAO_REST_API_KEY` |
| Admin/QA | `HEALTH_COLLECTOR_GROUPS`, `UI_VERIFY_BASE`, `SKIP_ADMIN_HUB_WARM` |
| APK | `APP_INSTALL_*`, `APP_APK_*` |

Edge Secrets (Supabase): `FCM_*` — 로컬 `.env` 아님.

---

## Part D — 운영 (앱층)

### D.1 로컬 게이트

```bash
cd dashboard/web
npm test && npm run verify:design && npm run build && npm run lint
```

Preview: `UI_VERIFY_BASE=https://<preview>.vercel.app npm run smoke:hub-url`

### D.2 배포 불일치 triage

1. Vercel Production commit SHA vs `origin/main`
2. dirty/local-only 변경은 Production에 **없음**
3. env tier · feature flag diff

### D.3 앱층 장애

| 증상 | 1차 확인 |
|------|----------|
| LIVE empty (DB OK) | `NEXT_PUBLIC_LIVE_READ_TIER` · RLS session |
| 차트 empty | trend RPC · `mesure_at` · coverage |
| 명령 UI 무반응 | Network → Server Action · `pending` row |
| admin 헬스 empty | admin role · service_role env |
| hub 탭 깨짐 | `npm run verify:hub` · epoch race |

### D.4 검증 스크립트

| script | 용도 |
|--------|------|
| `npm run measure:live` | list p95 |
| `npm run verify:hub` | URL contract |
| `npm run smoke:hub-url` | Preview 허브 |

---

## 참고

| 문서 | 내용 |
|------|------|
| [`SYSTEM_DB.md`](./SYSTEM_DB.md) | views · RLS · decode |
| [`SYSTEM_RUNBOOK.md`](./SYSTEM_RUNBOOK.md) | 장애 순서 |
| [`VERCEL_PREVIEW_GATE.md`](./VERCEL_PREVIEW_GATE.md) | push 게이트 |
| [`HUB_STABILITY_P0.md`](./HUB_STABILITY_P0.md) | 허브 P0 |

---

## 변경 이력

| 날짜 | 내용 |
|------|------|
| 2026-09-01 | 초안 — Backend §2.3 + Frontend §2.4 (Canvas 승인 반영) |
