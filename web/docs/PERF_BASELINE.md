# LIVE read performance baseline

Phase 0 측정 기록. local dev · Supabase remote DB 기준.

## 목표 (local · Preview · Production 동일)

| 지표 | 목표 | 적용 |
| --- | --- | --- |
| LIVE SELECT p95 | &lt; 300 ms | local · 운영 DB |
| 페이지 TTFB p95 | &lt; 1.5 s | **local · Vercel Preview · Production** |

> **운영·배포에서도 TTFB 목표를 유지한다.** Preview/Production에서 목표를 넘기면 회귀로 보고 push 전·후 게이트에 반영한다 ([`VERCEL_PREVIEW_GATE.md`](./VERCEL_PREVIEW_GATE.md)).

## 측정 방법

```bash
cd dashboard/web
npm run measure:live
# 동일: npx tsx scripts/measure-live-read.ts
```

페이지 TTFB는 브라우저 DevTools Network 탭에서 `/farm`, `/controllers`, `/alarms`, `/settings`, `/admin/ops` 각 10회 샘플. Admin hub는 아래 **Admin hub TTFB** 절 · `npm run measure:hub-ttfb`.

운영 URL 예:

```bash
UI_VERIFY_BASE=https://smart.autofankorea.com npm run measure:hub-ttfb
```

## Measured LIVE SELECT (2026-07-24)

`npm run measure:live` · n=10 · FARM01/P00 · remote Supabase.

| Query | p50 (ms) | p95 (ms) | vs 목표 | Notes |
| --- | --- | --- | --- | --- |
| `v_iot_dashboard_list` limit 500 | 77 | 446 | p95 spike | global list — remote cold outlier (min 43) |
| `v_iot_decoded_latest` limit 1500 | 61 | 134 | OK | legacy path |
| `v_iot_farm_overview` limit 100 | 106 | 2206 | p95 spike | aggregate — 1회 cold 2s급 (min 85) |
| **List farm-scoped 500** (`decoded_latest` FARM01/P00) | **84** | **115** | **OK** | 출고 단일농장 경로 (1-A) |
| **Detail 1 row** | **51** | **76** | **OK** | 1-B |

판정: **출고 경로(farm-scoped / detail) p95 &lt; 300 ms 충족.** global list·overview p95는 remote RTT/cold에 민감 — 참고용.

Sprint A 재측정 (2026-08-05 · `npm run measure:live`): List farm-scoped p50/p95 **40.4 / 57.0 ms**, Detail **32.1 / 35.4 ms** — 목표 유지·개선. Admin hub TTFB Playwright는 미재실행(slim은 클라이언트 TailLoader 배치에만 영향).

동일 세션 직전 1회 샘플(참고): list 116/1348 · legacy 60/85 · overview 57/82 · farm-scoped 56/75 · detail 44/53.

## Baseline (pre-optimization placeholder)

초기 문서의 `_run script_` 자리 — 최적화 전 수치는 미보존. 현재 remote 측정은 위 **Measured** 표 사용.

| Query | p50 (ms) | p95 (ms) | Notes |
| --- | --- | --- | --- |
| `v_iot_decoded_latest` limit 1500 + `decoded_json` | 61 | 134 | 2026-07-24 |
| `v_iot_dashboard_list` limit 500 | 77 | 446 | 2026-07-24 · p95 outlier |
| `v_iot_farm_overview` | 106 | 2206 | 2026-07-24 · p95 outlier |

## Post-optimization

| Query | p50 (ms) | p95 (ms) | Phase |
| --- | --- | --- | --- |
| List farm-scoped 500 | 84 | 115 | 1-A |
| Detail 1 row | 51 | 76 | 1-B |
| Farm overview | 106 | 2206† | 1-C |
| Cached repeat navigation | — | — | 1-D → Admin hub TTFB warm (아래) |

† overview p95는 cold spike; p50·min은 ~85–106 ms대.

## 2026-08-21 · overview timeout

FARM01 LIVE ~12.8만 행에서 `v_iot_farm_overview`(전체 `DISTINCT ON`)이 **9.6s** → PostgREST statement timeout.  
핫 뷰는 최근 2시간 키 + LATERAL 최신 1행으로 교체 (`20260821061828_live_hot_views_recent_latest.sql`). 적용 직후 overview EXPLAIN **605 ms** (이전 9.6 s).

## 정책

- 서버 캐시: `unstable_cache` 300 s + `revalidateTag('live')` on thermo save
- `NEXT_PUBLIC_LIVE_READ_TIER=list` (rollback: `legacy`)
- farm-scoped limit: `LIVE_FARM_ROW_LIMIT=500`
- PostgREST `max_rows=1000` 유지 ([`supabase/config.toml`](../supabase/config.toml))

## Trend RPC (farm `/farm`)

| RPC | When loaded | Cache tag | Typical rows (24h) |
| --- | --- | --- | --- |
| `farm_trend_history_by_controller_json` | Client lazy (list / 통합 추이 / 히트맵 파생) | `live:controller-trend:{scope}` | SP × stall × controller × 96 buckets · **`mesure_at` bin** · jsonb 1행 |
| `farm_trend_history_json` | PDF/SSR fallback via controller convert | `live:trend:{scope}` | unused on hub idle path |
| `farm_trend_uplink_coverage_json` | 차트 탭 전용 (희소/통신두절) | `live:controller-trend:{scope}` | **`mesure_at` bin** (received_at 선행 필터) · jsonb · `user_can_read_farm` DEFINER |

- Bucket policy: hub **and PDF/list all-periods** fetch **24h 15m → 30d 1h (24h RPC chunks, newest first)**. Splash/field prefetch **24h only**. Chart tab (or map idle stall prefetch) extends 30d. Hub **client** paints each 30d day chunk as it arrives (right=now, fill left) with **up to 3 in-flight** day RPCs; apply order stays newest-first. Mini tiles show skeleton then 24h **2h-average** until 30d is complete. Expanded lookback stays **1h**. PDF still waits for the full 30d window. 7d is a tail slice of 30d 1h. **Drag-zoom ≤ 48h** fetches **15m for that range only** (`TREND_15M_PERIODS`). Wheel lookback does not. PDF print LTTB-caps each stacked chart at 96 points. Wire format is sparse compact. UI bars 24h→24, 7d→28, 30d→30 (`farm-trend-types.ts` + `GRAPH_BARS`). Mini display uses `TREND_MINI_STRIDE_MS` (2h).
- App fetch uses `*_json` RPCs (one PostgREST row). Table-returning `farm_trend_history*` remain for SQL/EXPLAIN; do **not** `.range()` them — `max_rows=1000` re-runs the 30d `GROUP BY` per page.
- Hub UI: **controller json only**. Stall heatmap is derived (`stallTrendFromControllerPeriod`).
- Map tab SSR skips stall trend + controller-trend (Phase B idle hydrate / P4 lazy)
- **Post-login:** farmer client warms scoped panel + 24h controller trend during brand splash (`warmPostLoginFarmHub`). Splash waits for field LIVE bootstrap + paint, not chart 30d / 3D.
- Admin ops Z3 (`FarmScopedPanel`) uses per-farm scoped fetch; stall trend client-idle when map opens

### Measured (dev, 2026-08-18) — `npm run measure:trend` · FARM01/P00 · 30d @ 15m · `*_json`

| RPC | p50 | p95 | rows |
| --- | --- | --- | --- |
| `farm_trend_history_json` | 248 ms | 496 ms | 1283 |
| `farm_trend_history_by_controller_json` | 491 ms | 599 ms | 5554 |

App cold path was 15–40s when `.range()` re-ran the SETOF RPC per 1000-row page (FARM01 decoded ~77k). Direct SQL SETOF 30d ≈ 307 ms · 5602 groups.

### Measured (dev, 2026-08-11) — table-returning RPC · PostgREST first page only

| RPC | p50 | p95 | rows (note) |
| --- | --- | --- | --- |
| `farm_trend_history` | 110 ms | 182 ms | 942 (PostgREST `max_rows=1000` cap) |
| `farm_trend_history_by_controller` | 102 ms | 172 ms | 1000 (cap) |

## Soft refresh tiers (H2)

| Mode | Action | Loads | Used by |
| --- | --- | --- | --- |
| `live` (default) | `fetchFarmScopedLiveDataAction` | LIVE **slim** (list tier, no channels[]) + barn layout/map | ScopeBar / list soft refresh, ACK `onRefreshLive` |
| `full` | `fetchFarmScopedPanelDataAction` | LIVE (decoded + channels) + alarm + thermo/history · **no stall trend** | cold bootstrap / enrich / `revalidateFarmLive({ mode: "full" })` |
| stall trend | `fetchFarmTrendAllPeriodsAction` | map heatmap stall trend | idle `prefetchFarmStallTrend` |
| controller trend | `fetchFarmControllerTrendAllPeriodsAction` | list graph controller trend | list trend refresh bar |

Soft refresh no longer reloads settings or trend in the same round-trip as LIVE. Slim soft merge keeps prior `channels[]` when omitted.

## LIVE callers (Sprint A audit)

| Caller | slim? | Source |
| --- | --- | --- |
| `loadFarmScopedLiveData` | yes | soft refresh / ACK LIVE |
| `buildFarmFacts` (ARIA) | yes | voice facts |
| `loadAdminFarmGridPanels*` | **yes (Sprint A)** | admin hub overview cards |
| `loadFarmScopedPanelData` | no | cold bootstrap / panel enrich / bulk channels |

Admin hub grid is overview-only. Farm drill-in uses full panel (or enrich). Bulk apply blocks control when modern controllers lack `channels[]` and triggers `revalidateFarmLive({ mode: "full" })`.

## Client trend cache (Sprint A)

| Layer | TTL / key | Notes |
| --- | --- | --- |
| Server `cachedLiveQuery` | 300 s · `[farm-trend, userId, scope, period, toMs]` | tags `live`, `trend:{scope}` |
| Client Map (stall + controller) | **90 s** · `farmKeyId` | `client-trend-cache.ts` · farm leave invalidates previous scope |

## Profile UI meta cache (Sprint B)

| Read | TTL | Invalidate |
| --- | --- | --- |
| `getBarnLayoutPrefs` | 60 s · tag `profile-ui-meta` | save/patch/clear barn layouts |
| `getAlarmSettings` | 60 s · same tag | `saveAlarmSettings` |

`user_access` / 권한은 캐시하지 않음. Soft LIVE fingerprint short-circuit는 도입하지 않음 (mergeLiveReadings 유지).

## ARIA metrics (Sprint B)

- Initial: `fetchAriaFarmMetricsAction` → slim LIVE + settings (server)
- Soft poll: hub `readings`로 `assembleFarmFacts` (DB 생략) · `document.hidden` skip · 이상 없으면 60s / 있으면 30s
- cmd-poll / alarm-single 읽기 경로: 현행 유지 (완료 고정)

## HOT view · retention (Sprint C → 적용)

- Thin list 규칙: [`LIVE_HOT_VIEW_RULES.md`](./LIVE_HOT_VIEW_RULES.md) · 가드 `live-read-select.ts` + unit test
- Retention: [`IOT_RETENTION_OPTIONS.md`](./IOT_RETENTION_OPTIONS.md) — **채택·cron 적용**(30d detach/archive · raw DELETE · archive soak DROP). 정합 2026-08-06
- cmd-poll ids 배칭: 백로그 (현행 조건부 폴링 유지)

## Follow-ups (M1–M5 / L1–L2)

| Item | Change | Status |
| --- | --- | --- |
| M1 | `startTransition` URL only; controller-trend module cache shared map/list | done |
| M4 | Admin hub SSR first batch → client TailLoader hydrate (LIVE SSR 제거) | done |
| M5 | Ops `fetchHealthSnapshotAction` patch (no periodic `router.refresh`) | **done** (2026-07-22) |
| L1 | `staggerMount` only when `readings.length > STAGGER_MOUNT_MIN_READINGS` (8) | **done** (2026-07-22) |
| L2 | `FarmMapCanvas` / `FarmMapMobileStage` / `FarmMapBulkApply` via `next/dynamic` | **done** (2026-07-22) |
| Phase C | Hub visible-first LIVE · Ops Scan client defer · `mergeBarnLayouts` off read path | **done** |
| Sprint A | Admin hub grid slim LIVE · client trend TTL 90s · bulk channels hydration guard | **done** (2026-08-05) |
| Sprint B | ARIA metrics visibility/idle poll · soft facts from hub LIVE · profile ui_config 60s cache + tag invalidate | **done** (2026-08-05) |
| Sprint C | HOT list thin guard + docs · retention options → **이후 D1/D4 cron 적용** | **done** (docs 2026-08-05 · cron 2026-08-05 · 문서정합 2026-08-06) |

## Admin hub TTFB

| Change | Effect |
| --- | --- |
| `fetchFarmOverviewForFarmKeys` | N per-farm queries → **1 OR batch** + `unstable_cache` 60s |
| `cachedLiveQuery` | broken `shouldCache`(always DB) → real `unstable_cache` hit |
| Admin login warm | `signInWithEmail`이 overview 캐시를 미리 채움 → 직후 `/farm` cold≈warm |
| Hub grid SSR | 첫 배치 LIVE SSR 제거 → `TailLoader`가 전부 client hydrate |
| Hub visible-first | TailLoader가 viewport ∩ pending을 배치 우선 로드 |

### Measured (dev, 2026-07-22)

Playwright `node scripts/measure-hub-ttfb.mjs` — `/farm` navigation, `responseStart` ≈ TTFB. n=3.

| Scenario | wall median | TTFB (`responseStart`) median | Notes |
| --- | --- | --- | --- |
| **warm** (login overview warm) | **287 ms** | **106 ms** | Steady after login |
| **cache-cleared** (`.next/dev/cache` 삭제, 동일 프로세스) | **260 ms** | **98 ms** | Disk만 비움 — in-memory `unstable_cache`는 유지될 수 있음 |
| **strict-cold** (`SKIP_ADMIN_HUB_WARM=1` + restart 후 login) | **276 ms** (first **1920 ms**) | **107 ms** (first **170 ms**) | Warm 없이 overview를 `/farm`에서 조회. 첫 히트에 compile 포함 |
| Prior (LIVE SSR hub batch) | ~2.4 s | — | 개선 전 cold 체감 |

재측정:

```bash
# warm + disk cache clear
npm run measure:hub-ttfb

# true cold (warm skip): restart with env, then
# SKIP_ADMIN_HUB_WARM=1 npm run dev
# TTFB_PHASE=strict-only npm run measure:hub-ttfb
```

## Storage capacity (iot-cloud · 2026-08-05)

| Table | total | heap | indexes | note |
| --- | --- | --- | --- | --- |
| `iot_room_state_raw` | 21 MB | ~3.9 MB | ~17 MB (81%) | Phase 4 후 · [`RAW_STORAGE_CHANGE.md`](./RAW_STORAGE_CHANGE.md) §10 |
| `iot_room_state_decoded` | ~27 MB (파티션 합, 2026-08-06) | — | — | D1+slim 후 · [`DECODED_CAPACITY.md`](./DECODED_CAPACITY.md) |

decoded: index DROP 비권장. D1·retention **적용 완료**. 잔여 용량 ROI = 희소 관측(확대 보류) · raw 인덱스 검토(승인 후).
