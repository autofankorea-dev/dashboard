# decoded 용량 트랙 (iot_room_state_decoded)

> **실측:** 구 `iot-cloud` · **2026-08-06** · raw/decoded 용량 트랙 **완료로 종결**  
> **운영 DB (현재):** `fkkrjljeqxpbmazfnync` · 구 프로젝트 **폐기** — 아래 수치는 역사 기록.  
> **원칙:** 인덱스 DROP은 별도 승인. 본 문서는 실측·판단·이력.  
> **잔여:** 희소 PoC **OFF** 2026-09-01 ([`SPARSE_OBSERVATION.md`](./SPARSE_OBSERVATION.md)). retention cron 적용 완료.

---

## 1. 용량 실측 (최신)

| 항목 | 값 |
|------|-----|
| **decoded 파티션 합계** | **~27 MB** (28,393,472 B · `decoded_at` DROP 후에도 동일 밴드 · 스키마 정리) |
| **raw total** | **~22 MB** |
| decoded 행 | ~9,042 |
| raw 행 | ~9,068 |
| `decoded_json` avg | **~504 B** (전원 `v0c-slim-1`) |
| slim 이전(당일 초) | decoded ~34 MB · json avg ~731 B |

| 비교 | 당일 초(단일 테이블) | 지금 |
|------|---------------------|------|
| decoded | ~34 MB | ~27 MB (파티션+thermo flat · `decoded_at` DROP) |
| raw | ~21 MB | ~22 MB |
| legacy 복제 | (D1 직후 ~34 MB) | **없음(DROP)** |

관련: [`DECODED_JSON_SLIM.md`](./DECODED_JSON_SLIM.md) · [`IOT_ARCHIVE_AND_THERMO_FLAT.md`](./IOT_ARCHIVE_AND_THERMO_FLAT.md) · [`SPARSE_OBSERVATION.md`](./SPARSE_OBSERVATION.md)

### LIVE/list 스모크 (2026-08-05)

| 검사 | 결과 |
|------|------|
| `v_iot_dashboard_list` | 15행 · setpoint 15/15 · exhaust 12 · intake 13 · **supply 0** |
| `v_iot_farm_overview` | 2농장 |
| decode cursor | 전진 · fail 1h = 0 |

---

## 2. 인덱스 사용률 (DROP 후보 없음)

| index | size | idx_scan | 역할 |
|-------|------|----------|------|
| `idx_iot_decoded_live_latest` | 7.8 MB | **27,642** | LIVE latest (partial live+ok) |
| `idx_iot_decoded_farm_received` | 6.9 MB | **8,273** | 농장·수신 시각 |
| `idx_iot_decoded_mesure_at` | 6.8 MB | **13,838** | trend / mesure_at |
| `uq_iot_decoded_raw_id` | 2.1 MB | **570,347** | raw 1:1 · decode upsert |
| PK | 2.1 MB | 37 | identity |

**판단:** 전부 활성 사용. 용량 줄이려고 인덱스를 지우면 LIVE/trend/decode 회귀 위험 → **Phase D0에서 DROP 금지**.

마이그레이션에만 있고 클라우드에 **없는** 인덱스(`idx_iot_decoded_live_list_scope`, `idx_iot_decoded_farm_module`, `idx_iot_decoded_session`)는 지금 **추가하지 않음**(용량↑).

---

## 3. 트랙 단계

| ID | 내용 | 용량 효과 | 상태 |
|----|------|-----------|------|
| **D0** | 실측·사용률·본 문서 | — | **완료** |
| **D-slim A** | DROP unused 컬럼 | 스키마 정리 | **완료** |
| **D-slim B+C** | topic/controller 채움 트리거 | 중복 쓰기↓ | **완료** |
| **D1** | 월 파티션 · HOT 30일 | 운영 분리 | **완료** |
| **D3 희소** | Edge ε+heartbeat | 행 증가율↓ | **PoC on** · 관측 대기 |
| **D4 retention** | 30d detach + archive 30d DROP | total 상한 | **완료(cron)** |
| **JSON slim** | v0c-slim-1 | json −30% | **완료+backfill** |
| **thermo flat** | setpoint 등 컬럼 | list JSON 비의존 | **완료** |
| **drop decoded_at** | Edge 기록 시각 제거 | 스키마 정리 | **완료** |

### 시각 컬럼 (decoded)

| 컬럼 | 역할 | 상태 |
|------|------|------|
| `mesure_at` | 측정 시각(timestamptz) · 파티션·UNIQUE·trend | **정본 유지** (KST-as-UTC 패킷은 Edge에서 −9h) |
| `mesure_dt` | 측정 시각(KST text) · UI/LIVE | 유지(동일 순간 표현) |
| `received_at` | 클라우드 수신 · LIVE/오프라인 | 유지 |
| `decoded_at` | Edge 기록 시각 | **DROP** (`20260805193000_…`) |

### D-slim A 적용

- migration: `20260805140000_iot_decoded_drop_unused_slim_a.sql` · 구 `iot-cloud` 적용됨 (운영 `fkkrjljeqxpbmazfnync`)
- `fan_supply_pct`는 RPC/list가 컬럼을 노출하므로 **미포함**(별도)

### D-slim B+C 적용

- migration: `20260805141000_iot_decoded_fill_keys_bc.sql`
- `trg_iot_decoded_fill_keys` BEFORE INSERT/UPDATE
- Edge는 당분간 기존처럼 flat도 넣어도 됨(덮어쓰기 없음 · 빈 값만 채움)
- **컬럼 DROP 없음** — list/인덱스 계약 유지. 이후 Edge 미전송·컬럼 DROP은 별도 승인

---

## 4. 행 수 · 시계열 과다

### HOT flat 시계열 (차트 RPC가 버킷하는 메트릭)

실측(2일): **temp·humidity·exhaust·intake**는 거의 항상 값 있음 · **`fan_supply_pct`는 0건(EC01 미사용)**.

차트 `TrendStallSeries`는 5본선(온도·습도·급기·배기·흡기) → **실데이터 기준 유효 4 + 빈 급기 1**.

해소 방안은 채팅/후속 문서에서 옵션으로 제시.

### D — flat ↔ json

| 구간 | flat `temp`/`fan_*` | `decoded_json` |
|------|---------------------|----------------|
| HOT (최근 N일) | 유지 (list/trend 속도) | 유지 (패널) |
| WARM/COLD | 물리 생략 또는 NULL | 정본 · RPC 추출 |

주의: `fan_exhaust`/`fan_intake`·`temp_c`는 **현재 사용 중**. `fan_supply`만 비어 있음 → supply DROP/RPC 정리는 D와 별도 소작업 가능.

---

## 5. 관련

- [`RAW_STORAGE_CHANGE.md`](./RAW_STORAGE_CHANGE.md) — raw Phase 1~4
- [`IOT_RETENTION_OPTIONS.md`](./IOT_RETENTION_OPTIONS.md) — retention **정본**(2026-08-06 정합)
- [`IOT_ARCHIVE_AND_THERMO_FLAT.md`](./IOT_ARCHIVE_AND_THERMO_FLAT.md)
- [`LIVE_HOT_VIEW_RULES.md`](./LIVE_HOT_VIEW_RULES.md)
- [`SPARSE_OBSERVATION.md`](./SPARSE_OBSERVATION.md) — 희소 재관측
- D1 파티션·retention·월 파티션 cron은 **적용 완료** (본 §3 표)
