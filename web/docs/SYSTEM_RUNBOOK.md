# 운영 Runbook — 장애 · 배포 · 모니터링

> **상위:** [`SYSTEM.md`](./SYSTEM.md) §3 · **계층별 상세:** [`SYSTEM_INSTANCE.md`](./SYSTEM_INSTANCE.md) · [`SYSTEM_DB.md`](./SYSTEM_DB.md) · [`SYSTEM_NEXTJS.md`](./SYSTEM_NEXTJS.md)

---

## 1. 설계 전제 (runbook이 RS-DB-C 순서를 따르는 이유)

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

## 2. 배포·게이트

### 2.1 Vercel (대시보드)

| 단계 | 절차 | 문서 |
|------|------|------|
| 로컬 | `npm ci` · `npm test` · `verify:design` · `build` · `lint` | [`SCRIPTS.md`](./SCRIPTS.md) |
| Git | feature → (Preview) → **main** push | [`CLOUD_DEPLOY.md`](./CLOUD_DEPLOY.md) |
| Production | Vercel auto · `smart.autofankorea.com` | [`VERCEL_PREVIEW_GATE.md`](./VERCEL_PREVIEW_GATE.md) |
| Preview 스모크 | `UI_VERIFY_BASE=... npm run smoke:hub-url` | |
| 특수 redeploy | 장애/핫픽스만 — **이후 Git main 맞출 것** | |

| 항목 | 값 |
|------|-----|
| Repo | `github.com/SIJackLee/dashboard` |
| Root | `web` |
| Functions | `icn1` |

### 2.2 DB migration

| 규칙 | 내용 |
|------|------|
| 정본 | `web/supabase/migrations/` |
| 적용 | **사용자 명시 승인 후만** |
| 롤백 | forward migration만 — DROP COLUMN 복구 불가 |
| retention cron | dry-run → trend 스모크 → `active=false` ([`IOT_RETENTION_OPTIONS.md`](./IOT_RETENTION_OPTIONS.md)) |

### 2.3 EC2 (Instance)

| 작업 | 절차 |
|------|------|
| RS 롤백 | `cp wire_decode.py.bak.phase3 wire_decode.py && sudo systemctl restart rsd-rs` |
| systemd·env | rsd repo — SSH **승인 후** |
| 키 로테 | Supabase + EC2 동시 — 문서에 값 기록 금지 |

---

## 3. 모니터링 신호

### 3.1 통합 표

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

### 3.2 admin `/admin/ops` DAG

- **Instance:** mqtt/rs/c · mem · disk · raw_last_received
- **Command:** 24h sent/applied · checkpoint
- **Decode:** cursor lag · failed count
- **Raw:** insert buckets

접근: admin role + `SUPABASE_SERVICE_ROLE_KEY` (server only).

---

## 4. 장애 시나리오별 runbook

### 4.1 LIVE 전체 empty

```text
[1] 사용자 영향 — 모든 농장 vs 특정 farm
[2] instance_health — mqtt/rs · raw_last_received_at
[3] SQL — max(received_at) FROM iot_room_state_raw (전체/ farm)
[4] raw 없음 → Instance triage (§4.2)
[5] raw 있음 · decoded 없음 → decode (§4.3)
[6] decoded 있음 · view 0 → read (§4.4)
[7] DB OK · UI empty → app (§4.5)
```

### 4.2 Uplink 중단 (raw 공백)

| 확인 | 명령/위치 |
|------|-----------|
| EC2 헬스 | `/admin/ops` · `instance_health_current` |
| MQTT | `mqtt_listen`, `mqtt_roundtrip` |
| 현장 | 통신모듈 전원 · RS-485 |
| RS | `sudo systemctl status rsd-rs` (SSH) |
| 재시작 | wire_decode 롤백 + `restart rsd-rs` |

참고: [`FARM02_ACK_TRIAGE.md`](./FARM02_ACK_TRIAGE.md)

### 4.3 Decode 실패 / backlog

| 확인 | 명령/위치 |
|------|-----------|
| cursor lag | `iot_decode_cursor` vs max raw id |
| failed | `iot_room_state_decode_failed` 최근 |
| Edge log | Supabase Functions `decode-batch` |
| sparse | 값 무변화 skip — **정상일 수 있음** |
| clock | `clock_kst_farm_keys` FARM02/03 |
| partition | `ensure_iot_decoded_month_partitions` cron |

### 4.4 Read path (데이터 있음 · 카드 empty)

| 확인 | 내용 |
|------|------|
| 2h hot | `received_at > now()-2h` — replay는 창 밖 |
| tier | `NEXT_PUBLIC_LIVE_READ_TIER` list vs latest |
| RLS | `user_access` · farm key |
| session | 로그인 farm scope |

검증: `SELECT count(*) FROM v_iot_dashboard_list;` (service_role)

### 4.5 버퍼 replay (오늘 수신 · 과거 측정)

| 관찰 | 해석 |
|------|------|
| `received_at` 오늘 | EC2/MQTT 수신 OK |
| `mesure_at` 8/30·8/31 | 장비 버퍼 재전송 |
| 카드 caution | 측정 60m+ 정체 — **정상 표시** |
| 차트 | `mesure_at` 축 — received 아님 |

clock_kst −9h 적용 후에도 과거 mesure는 **replay**.

### 4.6 명령 미반영

| 확인 | 내용 |
|------|------|
| DB row | `status` pending/sent/applied |
| C.py | Health C · `command_last_sent_at` |
| ACK | LIVE thermo vs command payload |
| TTL | 300s — stale sent |
| UI | **applied 환각 없음** — DB만 |

FARM02 사례: sent만 · applied 0 — 장비/펌웨어 triage.

### 4.7 Production만 깨짐

1. Vercel deployment commit = `origin/main` HEAD?
2. Production env vs Preview diff
3. `NEXT_PUBLIC_*` tier/flag
4. 최근 migration **적용 여부** (승인 없이 적용됐는지)

### 4.8 RLS / 권한 (데이터 있음 · operator 빈 화면)

1. `user_access` farm row
2. admin impersonation vs operator session
3. Supabase advisor — partition child RLS

### 4.9 FARM01 30일 차트 시각 재배치 (C안, 2026-09-17)

시뮬 수신이 8월 28일에 멈춰 30일 1시간 칸이 비던 것을, **값·키는 유지**하고 측정·수신 시각만 최근 30일로 폈다. clock_kst 목록에는 넣지 않음.

| 백업 | 내용 |
|------|------|
| `_bak_farm01_c_decoded_20260917` | decoded 118,840행 |
| `_bak_farm01_c_raw_20260917` | raw 122,780행 |
| `_bak_farm01_c_last_20260917` | last_value 13대 |
| `_farm01_c_map_20260917` | id → 신·구 시각 |

롤백: 백업으로 되돌릴 때는 파티션 키(`mesure_at`) 이동이 다시 일어난다.

---

## 5. incident 기록

| 필드 | 내용 |
|------|------|
| 시작/종료 | KST |
| 영향 | farm · LIVE/명령/차트 |
| 계층 | R / S / C |
| 근본 원인 | 1줄 |
| 복구 | commit · restart · config |
| 후속 | migration · rsd · 문서 |

저장: `docs/incidents/YYYYMMDD-*.md` (승인 후). 열린 체크는 이 런북에 둔다. [`WORKSPACE_NOTES.md`](./WORKSPACE_NOTES.md)는 스냅샷만.

---

## 6. 변경 금지 (승인 필수)

- 운영 DB migration · RLS 삭제 · retention DELETE
- Production env · `service_role` 노출
- EC2 force · main force push
- UI/UX H1–H5 — [`UI_*`](./UI_SURFACES.md) 별도 게이트

---

## 7. 빠른 참조 — 계층 문서

| 증상 1차 | 문서 |
|----------|------|
| MQTT·raw | [`SYSTEM_INSTANCE.md`](./SYSTEM_INSTANCE.md) §3 |
| decode·view·RLS | [`SYSTEM_DB.md`](./SYSTEM_DB.md) §3 |
| tier·Actions·hub URL | [`SYSTEM_NEXTJS.md`](./SYSTEM_NEXTJS.md) §D |
| 출고 QA | [`QA_SHIP_GATE.md`](./QA_SHIP_GATE.md) |

---

## 8. 미결 — 2026-09-17 RS 수집 공백 재발 방지

서비스는 복구됐다. `17:14~18:49 KST` 약 95분 raw는 복구하지 못한다. 원인·흐름은 [`incidents/20260917-rs-supabase-outage.md`](./incidents/20260917-rs-supabase-outage.md).

목표 흐름:

```text
MQTT → RS 수신 → SQLite Outbox commit → MQTT ACK
                                  ↓
                         DB worker → Supabase
```

### P0 — RS durable Outbox

- [ ] `SIJackLee/rsd`의 현재 `RS.py` MQTT callback·DB flush 구조 확인
- [ ] MQTT callback에서 SQLite WAL Outbox에 먼저 commit
- [ ] Outbox와 Supabase 전송 worker 분리
- [ ] DB 실패 시 exponential backoff와 circuit breaker 적용
- [ ] RS 재시작 후 미전송 행을 오래된 순서로 자동 전송
- [ ] Outbox를 72시간 및 2~5GB 중 먼저 도달한 상한으로 제한
- [ ] 디스크 여유 20% 이하, Outbox oldest age·row count 경보
- [ ] Supabase 성공이 불명확한 timeout 재시도에 대비한 idempotency 설계

### P1 — MQTT·DB 방어선

- [ ] RS 고정 `client_id`와 persistent session 적용 검토
- [ ] Mosquitto `persistence true`·queued message 상한·디스크 경보 검증
- [ ] raw `ingest_key` unique 제약 필요성 검토
- [ ] 운영 MCP/SQL 역할에 `statement_timeout`·`lock_timeout` 적용 검토
- [ ] 대형 SQL은 실행 전 `EXPLAIN`, 범위·예상 비용·운영 영향 확인
- [ ] 무거운 분석 쿼리는 read replica 또는 별도 분석 경로로 분리 검토

DB migration, Mosquitto 설정, EC2 systemd 변경과 운영 재시작은 각각 영향도를 확인하고 별도 승인 후 적용한다.

### 완료 조건

1. Supabase 연결을 30분 차단한 동안 MQTT payload가 Outbox에 보존된다.
2. DB 장애 중 `rsd-rs`를 재시작해도 Outbox 행이 유지된다.
3. DB 복구 후 모든 행이 자동 저장되며 누락과 중복이 없다.
4. Outbox 상한과 디스크 경보가 동작한다.
5. `raw_last_received_at`과 Outbox oldest age가 운영 화면 또는 알림에 노출된다.

### 롤백

- 기존 `RS.py`와 systemd unit을 보존하고 문제 발생 시 이전 버전으로 복원한다.
- 롤백 시에도 SQLite Outbox 파일은 삭제하지 않는다.
- DB schema 변경이 포함되면 forward migration 방식으로 별도 롤백 계획을 작성한다.

---

## 변경 이력

| 날짜 | 내용 |
|------|------|
| 2026-10-12 | 2026-09-17 RS 공백 재발 방지 체크를 §8로 모음 |
| 2026-09-17 | FARM01 C안 시각 재배치 · 백업 테이블 §4.9 |
| 2026-09-01 | 초안 — 배포·모니터링·시나리오 runbook (Canvas §3 승인 반영) |
