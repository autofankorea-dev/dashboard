# 스마트 축사 IoT 대시보드 - 작업 맥락

> **문서 허브:** [`README.md`](./README.md)  
> **배포 기준:** [`CLOUD_DEPLOY.md`](./CLOUD_DEPLOY.md) (`commit → push → main → Vercel`)  
> IoT 축사 모니터링·제어 대시보드. 인증/권한 기반 조회·명령.

## 1. 프로젝트 개요

- **대상 폴더**: `web/` (Next.js 앱).
- **목적**: Supabase IoT 데이터 권한별 조회 · 컨트롤러 명령.
- **Supabase**: `fkkrjljeqxpbmazfnync`. 키는 `.env.local`만 두고 문서에 적지 않는다.

## 2. 기술 스택

- Next.js 16 (App Router, **webpack** dev/build) + TypeScript
- Tailwind CSS + shadcn/ui
- Supabase (`@supabase/ssr`, `@supabase/supabase-js`) — DB + Auth
- 인증: 이메일/비밀번호 (Supabase Auth)

## 3. 실행 방법

> **경로:** `dashboard/web/` (저장소 루트 `dashboard/` 기준).  
> 집 LIVE 시뮬: [`HOME_SIM_PILOT.md`](./HOME_SIM_PILOT.md) (`simulator/sim_pilot_farm01.py`). 회사 MQTT/RS 없이 raw INSERT + `decode-batch`.

```bash
cd web
npm install
# web/.env.local 에 환경변수 설정 (아래 4번 참고)
npm run dev      # http://localhost:3000 (webpack)
npm run build    # webpack 프로덕션 빌드 검증
```

## 4. 환경변수 (`web/.env.local`)

실제 값은 커밋하지 않는다. 이름만 `web/.env.example`에 기록.

| 이름 | 용도 |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 프로젝트 URL (클라이언트 노출) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon key (RLS 전제, 클라이언트 노출) |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role key (서버 전용, 관리자 기능에서만 사용) |

> `service_role` key는 서버 코드(`lib/supabase/admin.ts`, 관리자 액션)에서만 사용하며 `server-only`로 가드.

## 5. LIVE 데이터 경로 (현행)

RS-DB-C: EC2는 raw INSERT, **decode·LIVE UI는 이 앱**. 배포 요약: [`CLOUD_DEPLOY.md`](./CLOUD_DEPLOY.md).

| 계층 | 현행 |
| --- | --- |
| Raw / pipeline | `v_iot_raw_live` 등 (Edge·앱 decode) |
| 대시보드 list tier (기본) | `v_iot_dashboard_list` — `NEXT_PUBLIC_LIVE_READ_TIER` 미설정 시 |
| Farm-scoped full / bulk | `v_iot_decoded_latest` (channels[] 필요) |
| Overview | `v_iot_farm_overview` (list 집계 · 최근 2시간 최신 1행) |
| 레거시 롤백 | `NEXT_PUBLIC_LIVE_READ_TIER=legacy` → decoded_latest + decoded_json 중심 |

구현: `web/src/lib/data/iot-live-fetch.ts`, `live-config.ts`, `iot-raw-live.ts`.

### 도메인 계층 (현장)

```mermaid
flowchart TB
  F[농장] --> M1[통신모듈]
  F --> M2[통신모듈]
  M1 --> C1["컨트롤러 (모듈당 최대 48)"]
  M2 --> C2["컨트롤러"]
  C1 --> S1[축사]
  C1 --> S2[축사]
```

| 계층 | 설명 |
| --- | --- |
| 농장 | 다농장 · UI는 표시명 |
| 통신모듈 | RS-485 마스터 · 컨트롤러 최대 48 |
| 컨트롤러 | 온·습·팬 측정 단위 |
| 축사 | 지도 카드 1장 = 축사 1 |

**제외:** NH3, CO2 — 장비 측 커스텀·적용까지 장기(≥2년). 대시보드 **비목표**.

### 페이로드·파싱 가정

- 디코드 결과의 컨트롤러 배열 · 시계열 → UI 현재값은 보통 **마지막 원소**
- 축사유형 바이트는 0~255를 `SP00`~`SP255`로 디코드한다. 예전 1~10 제한으로 `iot_room_state_decode_failed`에 남은 행은 raw를 다시 디코드해 `iot_room_state_decoded`로 복원한다.
- 통신상태 ≈ **수신 시각(`received_at`) + 측정 시각(`mesure_dt`)** 신선도 (`lib/data/live-status.ts`). 수신 ≤15분=정상 · ≤60분=주의 · 그 외=통신두절. 수신이 정상이어도 측정이 60분 넘게 정체하면(버퍼 replay·장비 시계정지) **주의로 강등**.
- 추이 차트·리포트 시계열 ≈ **측정 시각(`mesure_at`)** — 재연결 시 컨트롤러 버퍼를 짧은 주기로 올려도 샘플 자체는 기존 5분 측정 간격. 패킷 unix가 서울 벽시계를 UTC처럼 넣은 경우 Edge가 9시간을 빼 실제 UTC로 맞춤. LIVE/REPLAY 플래그 구분 없이 `farm_trend_history*`에 포함 (`live`/`history`/`replay`)
  - **clock 보정 모드** (`decode-batch`, `iot_decode_config.clock_kst_farm_keys`): 목록에 오른 소스(`FARM02`·`FARM03`)는 **live/replay 무관하게 항상 -9h**. 지연 재전송(패킷 epoch가 수신보다 과거) burst도 실제 측정 시각에 정확히 안착. 목록 밖(파일럿 `FARM01` 시뮬레이터=정직한 UTC)은 기존 **future-only 휴리스틱**(수신보다 미래인 epoch만 -9h) 유지. 분류 근거=14일 raw `epoch−received` 분포(허용목록 소스는 +9h에 집중, 파일럿은 ≈0). HEALTH 등 신규 실장비 재가동 시 허용목록 추가 검토.
- **추이 차트 커버리지** (차트 탭만): 측정 시각 버킷 RPC `farm_trend_uplink_coverage_json` (migration `20260901003000`, **iot-cloud 적용됨**). 희소=유효 업링크·디코드 생략 → 직전 값 유지. 통신두절=해당 슬롯에 raw 없음 → 선 단절. 없음=잘못된 축사유형·폐기 패킷 → 유지 금지. `clock_kst_farm_keys`와 동일하게 epoch를 보정한다. **색면·구간 라벨·범례는 그리지 않음.** 목록 카드·LIVE·PDF는 기존 null 갭.
- **헤더 도구:** TopBar 오른쪽 상시 아이콘(이상상황 · 운영 · 리포트 · 테마 · md+ 뷰포트). 플로팅 Hub FAB 레일은 사용하지 않음.
- 구 **REPLAY 전용 UI** (`/replay`, `/logs`) = 미구현·비목표 (정책상 모드 분리 없음). `v_iot_replay_*` view는 레거시
- 구 테이블 `iot_room_state_decoded` 는 RLS·이력 참고용일 수 있음. **출고 LIVE 읽기 정본은 위 view** (카드 최신값은 여전히 live 스냅샷 + `received_at`)

### 데이터 모듈

| 파일 | 용도 |
| --- | --- |
| `lib/data/iot.ts` | LIVE readings 진입 |
| `lib/data/iot-live-fetch.ts` | list/detail/overview + cache |
| `lib/data/live-status.ts` | 카드 신선도 (수신+측정) |
| `lib/data/iot-live-merge.ts` | LIVE 병합 |
| `lib/data/iot-chart.ts` | 차트 집계 |
| `lib/data/iot-firmware.ts` | 48 ctrl 상수 |
| `lib/data/barn-meta.ts` | 축사 메타 |
| `lib/data/controller-meta.ts` | 컨트롤러 표시명 |
| `lib/data/alarms.ts` | 파생 알람 |


## 6. 인증 / 권한 (RLS)

DB에 RLS가 적용되어 있어 권한이 DB 레벨에서 강제된다.

| 테이블 | 정책 | 조건 |
| --- | --- | --- |
| `iot_room_state_decoded` | `decoded_select_scoped` (SELECT) | `user_can_read_farm(auth.uid(), farm_uid)` |
| `profiles` | `profiles_select_own` (SELECT) | 본인 또는 `is_admin()` |
| `user_access` | `user_access_select_own` (SELECT) | 본인 또는 `is_admin()` |

- `profiles.role`: `admin` / `operator` / `viewer`
- `user_access`: 스코프(`farm`/`module`/`ctrl`)별 `can_read`, `can_command`
- 앱 레벨: `lib/auth/get-current-user.ts`가 user+profile+access를 묶어 제공(React `cache`). `RoleGuard`로 UI 노출 제어, `require-admin`으로 관리자 페이지 보호.

### 인스턴스 헬스 (`instance_health_current`)

- EC2 수집 인스턴스의 `rsd-healthcheck.timer`가 per-service 상태(mqtt/rs/c, systemd·listen·roundtrip)와 자원(mem/disk)을 `instance_health_current`에 upsert.
- 대시보드는 **service_role admin 클라이언트**로만 읽음 → 클라이언트 RLS 정책 불필요(관리자 헬스 스냅샷 내부 소비).
- 소비 경로: `lib/admin/health/fetch-instance-health.ts`(조회) → `instance-health-map.ts`(순수 매핑) → `fetch-snapshot.ts`가 수집 노드(MQTT/RS/C) 색·드릴다운 포인트에 반영.
- **신선도 게이트**: `checked_at`이 10분 초과 시 주의 포인트, 30분 초과(또는 미적재)면 서버 값 무시하고 기존 수신-추론으로 **폴백**(무중단). 임계값은 `constants.ts`.
- 자원 경고(mem<200MB / disk>85%)는 수집(RS) 노드에 합산 표시. `raw_last_age_sec`(장비 몫)는 서버 노드 색에 영향 없이 정보로만 노출.

## 7. 라우팅 / 접근 흐름

- `/` → `/login` 리다이렉트
- `proxy.ts`(Next 16 미들웨어): 미인증 시 보호 경로 → `/login`, 로그인 상태에서 `/login` → `/farm`
- `(dashboard)/layout.tsx`: 미인증 → `/login`, 권한 없음(`!hasAccess`) → `/pending`
- 관리자 메뉴(`/admin/ops`)는 `role === "admin"`에만 노출
- 허브 탭: [`farm-hub-url.md`](./farm-hub-url.md) · 사용설명서: [`user-manual/`](./user-manual/)

## 8. 구현 현황

| 영역 | 상태 |
| --- | --- |
| 로그인 / 로그아웃 / 세션 미들웨어 | 완료 |
| 접근 게이트 / `/pending` / RoleGuard | 완료 |
| 관리자 `/admin/ops` (디렉터리·명령·헬스 DAG 아이콘 타일) | 완료 |
| `/farm` 허브 — 관리자 전국 지도 관제 · 단건 농장 그리드·목록·차트 · ARIA | 완료 (ARIA는 PoC) |
| 일괄적용 · 컨트롤러 설정 · 명령 insert | 완료 |
| 적용 큐·티켓 · 명령 이력 UI | 필드 덮개 채널 스트립 · `/admin/ops/commands` |
| LIVE view 경로 (`dashboard_list` / `decoded_latest`) | 완료 — §5 |
| REPLAY 전용 UI (`/replay`, `/logs`) | **비목표** — 재연결 백필은 추이(`mesure_at`)로 흡수 |
| 명령 downlink (`pending` → MQTT → `sent`) | **완료** — EC2 **C.py** (대시보드는 DB insert·적용큐·이력) |
| 사용설명서 차트·ARIA 절 | 완료 — `user-manual/11` · `12` |

## 9. 주요 의사결정

- **축사번호(`stallNo`)** 는 **통신모듈에서 idx별로 설정**(NVM)·**전송** (wire `ver=0x04`). 슬레이브·서버 LUT·대시보드에서 idx→stallNo 매핑 **하지 않음**.
- `profiles.ui_config` 는 사용자별 **카드 좌표(`barnLayouts`)·표시명·알람·온보딩**. stallNo 목록은 수집 데이터에서 자동 유도. 옛 `barns` 배열·`displaySettings`는 폐기(2026-08-28).
- `controller_stall_map` 등 **양방향 매핑 DB migration 보류·취소**.
- 농장 지도는 **2D 그리드 카드 맵** (아이소메트릭은 후속). **NH3/CO2**는 장비 커스텀·적용까지 장기(≥2년) — 대시보드 비목표. 신호강도·지리좌표는 미표시.
- 관리자 `/farm`(농장 미선택)은 **전국 지도 + 현황 목록**. 지도는 **카카오맵** 기본(키·SDK 실패 시 Leaflet + OSM 한국). 남한 범위. 배정 농장은 좌표가 없어도 목록에 두고, 핀은 좌표가 있는 것만. 상태 칩으로 목록·핀을 거른다. 핀·목록 클릭은 단건 현장 화면. `/admin/ops`에는 지도를 두지 않음.
- **축사(`/barns`)** stallNo 기준 전환은 **펌웨어 `ver=0x04` 이후**. 현재는 **컨트롤러(idx) 단위** 임시 표시.
- **축사 페이지 차트** x축 = 컨트롤러 **1~50** (`idx+1`) 고정 슬롯. 외부 차트 라이브러리 없이 `CompactColumnChart`(CSS/SVG).
- **`iot-chart.ts` 분리**: 클라이언트 컴포넌트가 `server-only`인 `iot.ts`를 import 하지 않도록 차트 집계만 별도 모듈.
- **빠른 비교** UI는 제거. 온습도·팬 비교로 역할 분리.
- **컨트롤러 제품 UI** (AVR-2000 / AUTOFAN)는 **추후** — 브로슈어·홈페이지에 제품 사진 충분. 현재는 실데이터 폼·적용큐로 조작.
- **시간축 신뢰:** `mesure_dt`가 수신보다 늦은 경우는 **장비 측 역량**. 대시보드는 **있는 그대로** 표시(보정 강제하지 않음).
- 제어 명령 의도는 4종: **최저환기 / 최고환기 / 설정온도 / 온도편차** (`ctrl_thermo_command`).
- 인증: **이메일/비밀번호** + **Google / 카카오 OAuth** (Supabase Auth). OAuth 콜백 `/auth/callback`. 신규·미승인 계정은 `user_access`/`admin` 없으면 `/pending` (정책 A).

## 10. 농장 지도 UI/UX

### 저장소 (`profiles.ui_config`)

```json
{
  "barnLayouts": {
    "catalogKey#stallNo": { "col": 1, "row": 2 }
  }
}
```

- **축사 식별**: `stallNo` = 펌웨어 전송 → `decoded_json`. 지도 카드 1개 = stallNo 1개. 좌표만 `barnLayouts`.
- 집계: `aggregateByBarn(readings, barnMetas)` — LIVE 스냅샷 기준, 평균값·최악 상태
- 지도: `FarmMapView` — 필드 탭 카드 그리드 (LIVE + `barnLayouts`)
- **로그인 스플래시:** 브랜드 최소 ~2.1초. 해제는 셸 마운트가 아니라 **필드 LIVE bootstrap 종료 + 1프레임 paint** (`NavContentReadyMarker ready`). 로그인 직후 농장 패널·24h 추이를 스플래시와 겹쳐 prefetch (`warmPostLoginFarmHub`). 차트 30일·모델 WebGL은 스플래시에서 기다리지 않음.
- **그래프 기간:** `?trendPeriod=24h|7d|30d` (기본 **7d**) — 그리드·목록·DELIN 탭 공유. 차트 탭 **일괄**은 최근 24시간(오른쪽=지금, **표시는 2시간 평균**). 펼친 카드는 **1시간 평균**으로 먼저 24시간을 보이고, 휠·핀치로 왼쪽(과거)만 늘림. 안 보이는 30일 트랙은 백그라운드 **1시간** 로드. `trendPeriod`는 바꾸지 않음. 특정 구간은 플롯 **드래그 줌**이며, 그 창이 **약 48시간 이하**일 때만 15분을 추가 요청. 휠 룩백은 1시간을 유지. 그리드 히트맵=컨트롤러 추이에서 파생한 축사 평균, 목록/상세=TrendChart 컨트롤러 단위. 버킷 기준 **`mesure_at`**. **로드:** 필드 진입 시 백그라운드. 희소 compact. **스플래시·필드는 24h 15분만. 차트 탭 또는 idle(히트맵 prefetch)에 30d 1시간(하루 RPC, 최신부터, 최대 3개 병렬·화면은 최신부터 조각마다). 7일은 30일 슬라이스.** 히트맵은 GRAPH_BARS(24/28/30) 다운샘플, 차트 탭은 플롯 px viewBox + LTTB(약 2.5px/점). 필드 라인은 점 마커 없음(핀·카드는 유지), 구간 줌·브러시 없음. **PDF 인쇄 그래프는 30일 1시간**(720 → LTTB 최대 96점). 목록 all-periods 축은 허브와 같음(24h×96 15분 / 7d×168 1h / 30d×720 1h). 15분 2880 경로는 폐기. 드래그 줌 창만 `TREND_15M_PERIODS`.
- **오늘의 리포트 PDF:** 헤더 `DailyReportButton` (`data-tour-id="header-daily-report"`) — 활성 농장 기준 브라우저 생성. **표지(농장 30일 1시간)** + **축사유형 1장씩** + **마지막 권장구간 이탈**. 온도·습도·채널은 허브 차트처럼 **지표마다 풀폭 행**. 표지 상·하한은 **이 농장에 저장된 알람**(`getAlarmSettings` → 농장 스코프, 없으면 계정 전역). 축사유형·이탈 페이지는 **생육 권장**. 그 그래프의 최저·최고도 함께 표시. 문장은 숫자 FACT만. 마지막 페이지는 30일 중 **가장 긴 생육 권장 온도 이탈 연속 구간**(없으면 페이지 유지·없음). 허브 미니 2시간·split-Y·브러시·48h 줌은 인쇄에 넣지 않음. 시계열 원본은 허브 `TREND_PERIODS` 30d(`getFarmControllerTrendAllPeriods` → 축사·유형 평균, **1시간×720**). 차트 선색은 `TREND_CHART_COLORS`. 문서 뼈대는 **레터헤드**. 빨강은 이상상황·통신 두절·온도 선·권장 이탈만. 인쇄는 LTTB 최대 96점. 표지·헤더는 농장 **표시명**. **이상상황**은 모듈 에러코드 + 통신두절만(온·습 권장/가이드 이탈은 배지와 별개, 마지막 장에서 다룸). 렌더 `buildAndDownloadDailyReportPdf` (jspdf + canvas). 컨트롤러 1대/페이지 첨부는 넣지 않음.
- 클릭: `/farm?tab=ops&…` 딥링크 (레거시 `/controllers`는 redirect)
- 빈 상태: 축사 미설정 시 설정 탭 CTA
- 모바일: `FarmMapList` 세로 카드 폴백

### 목업 대비 표시 항목

| 목업 | 구현 |
| --- | --- |
| 아이소메트릭 3D | 2D 그리드 카드 (후속 업그레이드 가능) |
| NH3, CO2 | 미표시 |
| RPM, 팬레벨 1~10, 모드 | 미표시 (실데이터 없음) |
| 온도, 습도, 팬% | 표시 |
| 게이트웨이 신호강도 | placeholder (`--`) |

## 11. 축사 페이지 (`/barns`) UI

### 레이아웃 (상→하)

1. **요약 카드** — 총/정상/주의/오프라인 (`summarizeBarns`)
2. **3열 그리드** — 상태 분포 | 온습도 비교 | 팬 비교
3. **축사 목록** — 컨트롤러 단위 테이블 (`getBarnReadings`)

### 차트 컴포넌트

| 컴포넌트 | 데이터 | 설명 |
| --- | --- | --- |
| `BarnStatusDonut` | `BarnSummary` | 정상/주의/오프라인 SVG 도넛 + 범례 |
| `TempHumidityCompareChart` | `readings` | 온도·습도, x축 1~50 |
| `FanCompareChart` | `readings` | 송풍·배기·입기팬 %, x축 1~50 |

- 공통 렌더: `BarnMetricChartStack` → `buildControllerSlotSeries()` (`iot-chart.ts`)
- 막대: `CompactColumnChart` — `fillWidth`로 50슬롯 균등 분할, 마지막 행에만 x축 눈금 (1, 5, 10, …, 50)
- 동일 슬롯에 복수 모듈 데이터가 있으면 해당 슬롯 값 **평균**

## 12. 추후: 컨트롤러 제품 UI

AVR-2000 / AUTOFAN **실물 패널 레이아웃**은 추후. 브로슈어·홈페이지에 제품 사진이 있어 **사진 수령 블로커는 해제**. 현재 조작은 적용 큐·명령 이력·실데이터(온·습·팬%) 기준.

### 데이터 메모
목업의 RPM·팬 레벨·모드는 `decoded_json`에 **없음** — 패널은 EC% / 온도 / 습도 기준.

## 13. Git / 브랜치

- 원격: `github.com/autofankorea-dev/dashboard`
- Vercel: `autofankorea-dev/dashboard`
- 작업 브랜치(스택): `feature/auth-access-gate` → `feature/admin-user-access`
  - `feature/admin-user-access`에 관리자·실데이터·명령·축사 차트 커밋 누적
- 최근 커밋 예: `3374425` 축사 차트, `386537a` 원격 명령
- 규칙: main 직접 push 금지, 기능 단위 브랜치/커밋, push/merge는 승인 후.

## 14. 주요 경로

```
web/src/
  app/
    (dashboard)/farm/page.tsx          # map | ops 허브
    (dashboard)/{controllers,alarms,settings}/page.tsx  # redirect only
    (dashboard)/admin/ops/**             # system | users | farms | commands (+ health-actions, users-actions)
    login/page.tsx  pending/page.tsx  auth/{actions.ts,callback/route.ts}
  components/
    layout/{top-bar, header-tools-menu, ...}
    common/{stat-card,section-card,status-badge,...}
    farm/  controllers/  ops/  admin/
  lib/
    data/{iot.ts,iot-live-fetch.ts,barn-meta.ts,commands.ts}
    farm/{farm-map-view,farm-map-canvas,...}
    auth/{get-current-user,require-admin}.ts
    supabase/{client,server,admin,middleware}.ts
  proxy.ts                 # Next 16 미들웨어(세션/보호)
```
