# 시스템 문서 — Instance · DB · Next.js

> **범위:** 스마트 축사 IoT 대시보드(RS-DB-C)의 **인스턴스(EC2) · DB(Supabase) · Next.js(Back/Front)**  
> **작성 원칙:** 각 절은 **설계 이유**(왜) → **경로**(어디) → **운영**(장애·TODO) 순.  
> UI/UX·디자인 토큰은 별도([`UI_SURFACES.md`](./UI_SURFACES.md) 등).  
> **정본 우선순위:** `git status` / `origin/main` > 이 문서 > [`WORKSPACE_NOTES.md`](./WORKSPACE_NOTES.md)

---

## 목차

1. [전체 시스템](#1-전체-시스템)
2. [개별 시스템](#2-개별-시스템)
3. [운영 및 리스크 대응](#3-운영-및-리스크-대응)
4. [참고](#4-참고)

---

## 1. 전체 시스템

### 1.1 한 줄 요약

현장 장비 → **EC2(RS/C/MQTT)** 가 Supabase **raw** 적재 → **Edge decode-batch** + **Next.js(Vercel)** 가 디코드·LIVE UI·명령 insert → 운영자 브라우저.

### 1.2 계층 구조 (RS-DB-C)

| 계층 | 담당 | 산출물 |
|------|------|--------|
| **R** (Receive) | EC2 `RS.py` | `iot_room_state_raw` (MQTT payload) |
| **S** (Store) | Supabase Postgres | raw · decoded · last_value · 명령·프로필 |
| **C** (Consume) | Vercel Next.js + Edge Functions | LIVE 카드 · 차트 · PDF · 관리자 헬스 |

- **배포 분리:** EC2 = [`rsd` 저장소](https://github.com/SIJackLee/rsd) · 대시보드 = `dashboard/web` → Vercel ([`CLOUD_DEPLOY.md`](./CLOUD_DEPLOY.md))
- **decode 소유:** 과거 D.py INSERT → **현행은 Edge `decode-batch` + 앱 read path** ([`CLOUD_DEPLOY.md`](./CLOUD_DEPLOY.md) § RS-DB-C)

### 1.3 데이터 흐름 (정상 경로)

```mermaid
flowchart LR
  DEV[컨트롤러/통신모듈] --> MQTT[MQTT QoS1]
  MQTT --> RS[EC2 RS.py]
  RS --> RAW[(iot_room_state_raw)]
  RAW --> DEC[Edge decode-batch]
  DEC --> DCD[(iot_room_state_decoded)]
  DEC --> LV[(iot_decoded_last_value)]
  DCD --> V1[v_iot_dashboard_list]
  DCD --> V2[v_iot_decoded_latest]
  V1 --> APP[Next.js /farm]
  V2 --> APP
  APP --> CMD[ctrl_thermo_command INSERT]
  CMD --> CPY[EC2 C.py downlink]
  CPY --> DEV
  EC2H[rsd-healthcheck] --> IHC[(instance_health_current)]
  IHC --> ADMIN[/admin/ops 헬스]
```

### 1.4 현장 도메인 (읽기 시 공통)

| 계층 | 설명 | DB 키 예 |
|------|------|----------|
| 농장 | 다농장 · UI 표시명 | `lsind_regist_no` + `item_code` → `FARM02/P00` |
| 통신모듈 | RS-485 마스터 · 컨트롤러 최대 48 | `module_uid` |
| 컨트롤러 | 온·습·팬 측정 단위 | `controller_key` (예 `SP07:01:01`) |
| 축사 | 지도 카드 1장 | `stall_ty_code` + `stall_no` |

상세: [`PROJECT_CONTEXT.md`](./PROJECT_CONTEXT.md) §5

### 1.5 시간축 정책 (혼동 방지)

| 축 | 필드 | 용도 |
|----|------|------|
| **수신** | `received_at` | LIVE 카드 신선도 · 2h hot view |
| **측정** | `mesure_at` / `mesure_dt` | 차트 · PDF · 히트맵 버킷 |
| **clock 보정** | `iot_decode_config.clock_kst_farm_keys` | KST-stuffed firmware → decode 시 −9h ([`PROJECT_CONTEXT.md`](./PROJECT_CONTEXT.md)) |

수신은 최신인데 측정이 정체면 **주의(caution)** — 버퍼 replay·장비 시계 정지와 구분 ([`live-status.ts`](../src/lib/data/live-status.ts)).

### 1.6 권한·보안 경계

- **브라우저:** anon key + RLS (`user_can_read_farm`, `is_admin`)
- **서버(사용자 컨텍스트):** `@supabase/ssr` cookie session
- **서버(관리 전용):** `service_role` — `server-only`, 관리자 헬스·일부 admin API만
- **명령:** 대시보드는 DB insert·적용 큐·이력까지 · MQTT downlink는 EC2 **C.py**
- **외부 연계 (Health DAG):** Ekape/FTP 등 — **미구현** (대기/비활성 표시)

### 1.7 설계 원칙 (횡단 — 문서 정본)

> **시스템 문서는 경로 나열이 아니라 「결정 → 이유 → 기각안」이 핵심이다.**  
> 아래 표는 §2.1–2.4 공통 전제. 각 절은 동일 형식으로 상세화한다.

| 결정 | 설계 이유 | 하지 않은 것 | 근거 |
|------|-----------|--------------|------|
| **RS-DB-C 3계층** | 수집(EC2)·저장(DB)·소비(Vercel)의 배포 주기·장애 반경·스케일 요구가 다름 | 올인원 EC2(구 D.py decode+UI) · 브라우저 직접 MQTT | [`CLOUD_DEPLOY.md`](./CLOUD_DEPLOY.md) · [`protocol/데이터폼_최종안.md`](./protocol/데이터폼_최종안.md) §8 |
| **해석(decode)을 DB Edge** | raw 옆 **~10초 cron** · batch cursor · sparse/clock이 `iot_decoded_last_value`·`iot_decode_config`와 같은 트랜잭션·스키마 필요 | RS에서 wire decode(Phase3+ 폐기) · Next API batch decode · 농장별 decode 서버 | [`DECODED_ROWCOUNT_PLAN.md`](./DECODED_ROWCOUNT_PLAN.md) · `supabase/functions/decode-batch/` |
| **명령·uplink 동일 DB** | INSERT 감사·RLS·pending queue · uplink thermo와 command payload **ACK diff** · C.py **단일 downlink 소비자** | 대시보드→MQTT 직접 publish · 명령 전용 DB/Redis 분리 | [`CTRL_THERMO_COMMAND_PHASE_A.md`](./CTRL_THERMO_COMMAND_PHASE_A.md) · [`protocol/데이터폼_정책문서.md`](./protocol/데이터폼_정책문서.md) §4.3 |
| **iot-cloud 단일 프로젝트** | Auth·RLS·JOIN view·Edge cron·명령 ACK를 **한 Postgres**에서. Free tier 운영 현실 | multi-DB COLD(E) · read/write 물리 샤딩 · 농장별 Supabase | [`IOT_RETENTION_OPTIONS.md`](./IOT_RETENTION_OPTIONS.md) |
| **LIVE vs 추이 시간축 분리** | `received_at`=신선도(2h hot) · `mesure_at`=차트/PDF. **버퍼 replay**와 live stream 구분 | REPLAY 전용 UI/DB 모드 · received만 LIVE 표시 | [`PROJECT_CONTEXT.md`](./PROJECT_CONTEXT.md) · [`live-status.ts`](../src/lib/data/live-status.ts) |

**Instance를 농장별로 쪼개지 않은 이유 (요약):** MQTT 브릿지·키·systemd 운영을 **1벌**로 유지. 다농장 topic multiplex. blast radius는 RS=raw-only·decode=DB로 이미 분리.

**DB 물리 분리를 하지 않은 이유 (요약):** retention·파티션·view tier로 **논리 분리**가 가능. 물리 multi-DB는 JOIN·RLS·Edge cron·비용이 급증 ([`IOT_RETENTION_OPTIONS.md`](./IOT_RETENTION_OPTIONS.md) 옵션 E 기각).

**명령이 수집 DB를 거치는 이유 (요약):** 현장 downlink는 **C.py만** MQTT publish. 대시보드는 **감사 가능한 queue**(`ctrl_thermo_command`)에 insert → EC2가 poll. 브라우저 MQTT·직통 HTTP는 보안·감사·ACK 비교 불가.

---

## 2. 개별 시스템

> **형식:** §2.x.0 설계 이유 · §2.x.1 경로 · §2.x.2 운영(TODO). 분리 문서(`SYSTEM_*.md`)도 동일 형식.

> **작성 권장:** 아래 소절을 각각 독립 md로 분리해도 됨 (`SYSTEM_INSTANCE.md`, `SYSTEM_DB.md`, `SYSTEM_NEXTJS.md`).

### 2.1 Instance (EC2 · 수집·다운링크)

#### 2.1.0 설계 이유

| 결정 | 설계 이유 | 하지 않은 것 | 근거 |
|------|-----------|--------------|------|
| **Instance·Dashboard repo 분리** | `rsd`=상시 MQTT·systemd · `dashboard`=Vercel git 배포. **수집 장애와 UI 릴리스 분리** | 대시보드 repo에 RS/C 통합 · UI를 EC2에서 호스팅 | [`CLOUD_DEPLOY.md`](./CLOUD_DEPLOY.md) · rsd repo |
| **RS는 raw INSERT만** | EC2 blast radius 최소. decode는 upsert·sparse·월 파티션·`last_value` 갱신 필요 → DB 소유 | RS wire decode(Phase3+ 폐기) · RS sparse 필터 | [`RAW_STORAGE_CHANGE.md`](./RAW_STORAGE_CHANGE.md) · [`DECODED_ROWCOUNT_PLAN.md`](./DECODED_ROWCOUNT_PLAN.md) |
| **C.py는 EC2 유지** | MQTT cmd 구독·long poll·현장 네트워크 근접. **serverless/Vercel 부적합** | Next.js MQTT publish · 농장마다 cmd 브로커 | [`protocol/데이터폼_정책문서.md`](./protocol/데이터폼_정책문서.md) §4 · HOME_SIM |
| **헬스→DB 적재** | admin DAG가 **DB만** 읽어 전국 상태. EC2 SSH 없이 관측 | Prometheus만 별도 · 대시보드가 EC2 SSH | [`PROJECT_CONTEXT.md`](./PROJECT_CONTEXT.md) §6 |
| **공유 수집 Instance** | MQTT 브릿지 1벌 · 다농장 topic. 운영 인력·키 관리 단순 | **농장별 EC2** · tenant별 MQTT 클러스터 | [`SYSTEM_INSTANCE.md`](./SYSTEM_INSTANCE.md) · Health DAG |

#### 2.1.1 경로·객체

| 구분 | 경로/객체 | 역할 |
|------|-----------|------|
| Repo | `github.com/SIJackLee/rsd` | RS/C/MQTT · systemd |
| 수집 | `RS.py` → `iot_room_state_raw` | topic + `payload_bytea` + `received_at` |
| 다운 | `C.py` ← `ctrl_thermo_command` | pending → MQTT downlink |
| 헬스 | `rsd-healthcheck.timer` → `instance_health_current` | mem/disk/mqtt/rs/c |
| 레거시 | EC2 `wire_decode` (보조) | Phase3+는 Edge decode 주력 |

#### 2.1.2 운영·상세

→ **[`SYSTEM_INSTANCE.md`](./SYSTEM_INSTANCE.md)** (Health 실측 · MQTT · 장애)

---

### 2.2 DB (Supabase · iot-cloud)

#### 2.2.0 설계 이유

| 결정 | 설계 이유 | 하지 않은 것 | 근거 |
|------|-----------|--------------|------|
| **iot-cloud 단일 Postgres** | Auth·RLS·JOIN view·Edge cron·명령 ACK **한 스키마** | 농장별 DB · read replica만 분리 · COLD multi-DB(E) | [`IOT_RETENTION_OPTIONS.md`](./IOT_RETENTION_OPTIONS.md) |
| **raw/decoded 논리 분리·물리 단일** | 월 파티션·retention cron·sparse·hot view로 계층 분리. Free tier에서 물리 샤딩 불필요 | raw 전용 클러스터 · decoded만 S3 아카이브 | [`DECODED_CAPACITY.md`](./DECODED_CAPACITY.md) |
| **decode-batch on Edge** | raw INSERT 직후 **pg_cron ~10s** · cursor·`last_value`·config **DB co-location** | RS decode · Next API batch · per-farm worker | `supabase/functions/decode-batch/` |
| **ctrl_thermo_command in DB** | 감사·RLS·pending queue · uplink thermo↔command **ACK 비교** · C.py 단일 소비 | MQTT cmd topic 직접 · Redis 명령 큐 | [`CTRL_THERMO_COMMAND_PHASE_A.md`](./CTRL_THERMO_COMMAND_PHASE_A.md) |
| **LIVE view 2h hot** | `received_at` 신선도 · list/latest tier 분리 · decode 부하와 read 분리 | 앱 raw scan · 무제한 latest view | [`LIVE_HOT_VIEW_RULES.md`](./LIVE_HOT_VIEW_RULES.md) |

#### 2.2.1 경로·객체

| 계층 | 객체 | 용도 |
|------|------|------|
| Raw | `iot_room_state_raw` | MQTT payload · `received_at` |
| Decode | `iot_room_state_decoded` (월 파티션) · `iot_decoded_last_value` | `mesure_at` · sparse 기준 |
| 실패 | `iot_room_state_decode_failed` | INVALID_STALL_TY 등 |
| LIVE | `v_iot_dashboard_list` · `v_iot_decoded_latest` · `v_iot_farm_overview` | 2h hot · tier |
| Edge | `decode-batch` · `push-dispatch` | cron decode · FCM |
| 설정 | `iot_decode_config` | sparse · `clock_kst_farm_keys` · batch_limit |
| 명령 | `ctrl_thermo_command` | insert → EC2 C |
| Auth | `profiles` · `user_access` | role · farm scope |
| Migration | `web/supabase/migrations/` | DDL 정본 (**적용은 사용자 승인 후**) |

#### 2.2.2 운영·상세

→ **[`SYSTEM_DB.md`](./SYSTEM_DB.md)** (ER · RLS · Edge · cron · retention)

---

### 2.3 Next.js — Backend (Server)

#### 2.3.0 설계 이유

| 결정 | 설계 이유 | 하지 않은 것 | 근거 |
|------|-----------|--------------|------|
| **decode는 Next가 안 함** | wire decode·sparse·clock은 Edge+DB. Vercel timeout·cold start·대량 raw scan 부적합 | API route decode proxy · RSC raw loop | [`CLOUD_DEPLOY.md`](./CLOUD_DEPLOY.md) |
| **명령은 Server Action→DB** | 브라우저 MQTT 불가 · RLS·감사 · C.py만 downlink | 클라 MQTT · API→EC2 HTTP 직통 | `farm/actions` · CTRL_THERMO |
| **LIVE read tier env** | list(경량) vs latest(channels). farm 규모·Functions 한도 | 항상 latest · 클라 only direct Supabase | `iot-live-fetch.ts` · `NEXT_PUBLIC_LIVE_READ_TIER` |
| **admin health service_role** | 전국 `instance_health`는 RLS 밖 · `server-only` | anon 헬스 노출 · EC2 SSH | `lib/admin/health/*` |
| **Vercel icn1 + webpack** | 국내 latency · Next16 webpack 정본 build | RS 동일 EC2 UI 호스팅 | [`CLOUD_DEPLOY.md`](./CLOUD_DEPLOY.md) |

#### 2.3.1 경로·객체

| 유형 | 경로/모듈 | 역할 |
|------|-----------|------|
| Middleware | `src/proxy.ts` | 세션 · `/login` 리다이렉트 |
| LIVE | `lib/data/iot-live-fetch.ts` | list/detail/overview |
| 신선도 | `lib/data/live-status.ts` | received+mesure → caution |
| 명령 | `app/(dashboard)/farm/actions.ts` · `controllers/actions.ts` | `ctrl_thermo_command` insert |
| API | `api/live/controller` · `api/farm-plan/sat-overlay` | bulk LIVE · 위성 |
| Admin | `lib/admin/health/*` | service_role 헬스 |
| Auth | `lib/auth/get-current-user.ts` | profile+access |
| Supabase | `lib/supabase/server.ts` · `admin.ts` | RLS vs service_role |

#### 2.3.2 운영·상세

→ **[`SYSTEM_NEXTJS.md`](./SYSTEM_NEXTJS.md)** Part A (Backend)

---

### 2.4 Next.js — Frontend (Client)

#### 2.4.0 설계 이유

| 결정 | 설계 이유 | 하지 않은 것 | 근거 |
|------|-----------|--------------|------|
| **URL hub contract** | 딥링크·새로고침·Capacitor 동일. `resolveFarmHubView` 단일 진입 | 탭별 localStorage only · 임의 query | [`farm-hub-url.md`](./farm-hub-url.md) |
| **received vs mesure UI 분리** | 카드 caution=측정 정체 · 채널색≠상태색 · replay 오해 방지 | received만 LIVE · 단일 timestamp | `live-status` · [`UI_CHROMA.md`](./UI_CHROMA.md) |
| **RSC+client hybrid** | LIVE SSR prefetch · 차트/맵 client · stale-while-revalidate | 전 CSR · 전 RSC blocking | [`PROJECT_CONTEXT.md`](./PROJECT_CONTEXT.md) §10 |
| **델린 view=aria 분리** | NLP·음성 PoC 허브 탭 격리 · env gate | 전역 챗봇 · jarvis 확장 | [`aria-protocol.md`](./aria-protocol.md) |
| **명령 UX — 즉시 반영(낙관)** | insert 직후 `patchThermoFromCommand`로 게이지·설정값 **즉시** 표시 · 설정은 한눈 행 채움 · 일괄은 필드 덮개에서 접수→확인 | LIVE uplink 올 때까지 UI frozen · applied DB만 표시 | [`farm-live-refresh.tsx`](../src/lib/navigation/farm-live-refresh.tsx) · [`UI_FEEDBACK.md`](./UI_FEEDBACK.md) · [`SHIP_CHECKLIST.md`](./SHIP_CHECKLIST.md) §6 |

#### 2.4.1 경로·객체

| 라우트/영역 | 대표 경로·컴포넌트 | 데이터·관심사 |
|-------------|-------------------|---------------|
| 허브 | `/farm` · `use-farm-hub-view-shell` | LIVE · trend RPC · 델린 |
| 필드 | `FarmMapView` · `FarmMapCard` | map · env cover |
| 목록 | `BarnListSummary` · `ControllerCardGrid` | gauge · caution |
| 차트 | `TrendChart` · `UnifiedBarnTrendPanel` | `mesure_at` · coverage |
| 운영 | `/admin/ops` | service_role health |
| Auth | `/login` · `/pending` | Supabase Auth |

#### 2.4.2 운영·상세

→ **[`SYSTEM_NEXTJS.md`](./SYSTEM_NEXTJS.md)** Part B (Frontend)

---

## 3. 운영 및 리스크 대응

> **상세 runbook:** [`SYSTEM_RUNBOOK.md`](./SYSTEM_RUNBOOK.md)

### 3.1 배포·게이트

| 단계 | 절차 | 문서 |
|------|------|------|
| 로컬 검증 | `npm test` · `verify:design` · `build` | [`SCRIPTS.md`](./SCRIPTS.md) |
| Git | feature → (Preview) → **main** push | [`CLOUD_DEPLOY.md`](./CLOUD_DEPLOY.md) |
| Production | Vercel auto · `smart.autofankorea.com` | [`VERCEL_PREVIEW_GATE.md`](./VERCEL_PREVIEW_GATE.md) |
| DB migration | `supabase/migrations` — **운영 적용 승인 필수** | §2.2 |

### 3.2 모니터링 포인트

| 신호 | 어디서 | 임계/의미 |
|------|--------|-----------|
| LIVE empty | `v_iot_decoded_latest` 0건 | 2h 창 밖 · uplink 중단 |
| 카드 caution | `live-status.ts` | 수신 OK · 측정 60분+ 정체 |
| Instance stale | `instance_health_current.checked_at` | 10m 주의 · 30m 무시 |
| decode 실패 | `iot_room_state_decode_failed` | INVALID_STALL_TY 등 |
| sent stuck | Health C · `ctrl_thermo_command` | C.py/ACK 경로 |
| 용량 | raw/decoded rowcount | retention cron ([`IOT_RETENTION_OPTIONS.md`](./IOT_RETENTION_OPTIONS.md)) |

### 3.3 알려진 리스크 · 대응

| 리스크 | 증상 | 1차 확인 | 참고 |
|--------|------|----------|------|
| **Uplink 중단** | 화면 빈 LIVE | raw `received_at` 최신 · decoded 2h view | [`FARM02_ACK_TRIAGE.md`](./FARM02_ACK_TRIAGE.md) |
| **버퍼 replay** | 오늘 수신·과거 측정 | `mesure_at` 분포 vs `received_at` | clock_kst −9h 적용 후에도 8/31 재전송 가능 |
| **장비 시계/KST stuff** | 차트 날짜 어긋남 | `clock_kst_farm_keys` · epoch−received 분포 | [`PROJECT_CONTEXT.md`](./PROJECT_CONTEXT.md) |
| **명령 미반영** | applied 0 | LIVE thermo vs command payload | FARM02 사례 — 장비 미반영 |
| **RLS/권한** | 빈 화면(데이터 있음) | `user_access` · admin role | |
| **파티션 RLS** | advisor 경고 | child table policies | Supabase advisor |
| **배포 불일치** | Production만 깨짐 | Vercel commit SHA vs `main` | dirty/local-only 변경 없음 |

### 3.4 장애 대응 순서 (제안)

1. **사용자 영향** — LIVE 전체 vs 농장 단위 vs 명령만
2. **수신층** — EC2 헬스 · raw count · MQTT
3. **decode층** — decode-batch 로그 · failed 테이블
4. **read층** — view 정의 · RLS · env tier
5. **앱층** — Vercel build · API 5xx
6. **기록** — `WORKSPACE_NOTES.md` 또는 incident md (원인·시각·복구 커밋)

### 3.5 변경 금지·승인 필수

- 운영 DB migration 적용 · RLS 삭제 · retention 대량 DELETE
- `service_role` 클라이언트 노출 · env Production 변경
- EC2 force 설정 · main force push
- UI/UX는 본 문서 범위 밖 — 별도 디자인 게이트

---

## 4. 참고

### 4.1 문서 맵 (시스템 관련)

| 주제 | 문서 |
|------|------|
| 작업 맥락·스키마 요약 | [`PROJECT_CONTEXT.md`](./PROJECT_CONTEXT.md) |
| 배포 | [`CLOUD_DEPLOY.md`](./CLOUD_DEPLOY.md) |
| LIVE view 규칙 | [`LIVE_HOT_VIEW_RULES.md`](./LIVE_HOT_VIEW_RULES.md) |
| Raw/용량 | [`RAW_STORAGE_CHANGE.md`](./RAW_STORAGE_CHANGE.md) · [`DECODED_CAPACITY.md`](./DECODED_CAPACITY.md) |
| Sparse·coverage | [`SPARSE_OBSERVATION.md`](./SPARSE_OBSERVATION.md) |
| 명령 파이프라인 | [`CTRL_THERMO_COMMAND_PHASE_A.md`](./CTRL_THERMO_COMMAND_PHASE_A.md) 등 |
| 성능 | [`PERF_BASELINE.md`](./PERF_BASELINE.md) |
| 출고 QA | [`QA_PRE_RELEASE.md`](./QA_PRE_RELEASE.md) · [`QA_SHIP_GATE.md`](./QA_SHIP_GATE.md) |
| 운영자 UI | [`user-manual/README.md`](./user-manual/README.md) |
| 프로토콜·페이로드 | [`protocol/`](./protocol/README.md) (`데이터폼_정책문서` · `데이터폼_최종안`) |

### 4.2 코드 진입점

```
web/src/lib/data/iot-live-fetch.ts   # LIVE read
web/src/lib/data/live-status.ts      # 카드 신선도
web/supabase/functions/decode-batch/ # Edge decode
web/supabase/migrations/               # DDL 정본
web/src/app/(dashboard)/farm/          # 허브 UI
web/src/app/(dashboard)/admin/ops/     # 운영
```

### 4.3 용어

| 용어 | 설명 |
|------|------|
| RS-DB-C | Receive(EC2) · Store(DB) · Consume(Vercel) |
| list tier | `v_iot_dashboard_list` — channels[] 생략한 LIVE |
| hot view | `received_at > now()-2h` 필터 ([`LIVE_HOT_VIEW_RULES.md`](./LIVE_HOT_VIEW_RULES.md)) |
| sparse | 값 변화 없으면 decoded skip — **2026-09-01 OFF** ([`SPARSE_OBSERVATION.md`](./SPARSE_OBSERVATION.md)) |
| clock_kst | firmware KST→UTC 오인 보정 farm 목록 |

### 4.4 개별 문서 (분리본)

| 파일 | §2 대응 | 내용 |
|------|---------|------|
| [`SYSTEM_INSTANCE.md`](./SYSTEM_INSTANCE.md) | §2.1 | EC2 · MQTT · RS/C · downlink |
| [`SYSTEM_DB.md`](./SYSTEM_DB.md) | §2.2 | 테이블·뷰·RLS·Edge·cron |
| [`SYSTEM_NEXTJS.md`](./SYSTEM_NEXTJS.md) | §2.3–2.4 | Backend · Frontend · env |
| [`SYSTEM_RUNBOOK.md`](./SYSTEM_RUNBOOK.md) | §3 | 장애 시나리오 · 배포 · 모니터링 |

---

## 변경 이력

| 날짜 | 내용 |
|------|------|
| 2026-09-01 | 초안 — 4절 구조 · RS-DB-C · Instance/DB/Next.js 분리 |
| 2026-09-01 | §1.7·§2.x **설계 이유**(결정→이유→기각안) + 경로 표 · Canvas 동기화 |
| 2026-09-01 | 분리본 작성 — INSTANCE · DB · NEXTJS · RUNBOOK (작성 승인) |
