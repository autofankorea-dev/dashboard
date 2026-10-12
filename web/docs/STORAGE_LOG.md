# 용량 기록

구 DB 실측과 저장 형태 변경 기록이다. 지금 보존 정책의 정본은 [`IOT_RETENTION_OPTIONS.md`](./IOT_RETENTION_OPTIONS.md)이고, 스키마 정본은 [`SYSTEM_DB.md`](./SYSTEM_DB.md)이다.


---

## decoded 용량

## decoded 용량 트랙 (iot_room_state_decoded)

> **실측:** 구 `iot-cloud` · **2026-08-06** · raw/decoded 용량 트랙 **완료로 종결**  
> **운영 DB (현재):** `fkkrjljeqxpbmazfnync` · 구 프로젝트 **폐기** — 아래 수치는 역사 기록.  
> **원칙:** 인덱스 DROP은 별도 승인. 본 문서는 실측·판단·이력.  
> **잔여:** 희소 PoC **OFF** 2026-09-01 ([`IOT_RETENTION_OPTIONS.md`](./IOT_RETENTION_OPTIONS.md)). retention cron 적용 완료.

---

### 1. 용량 실측 (최신)

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

관련: [raw 저장 방식](#raw-저장-방식) · [`IOT_RETENTION_OPTIONS.md`](./IOT_RETENTION_OPTIONS.md)

#### LIVE/list 스모크 (2026-08-05)

| 검사 | 결과 |
|------|------|
| `v_iot_dashboard_list` | 15행 · setpoint 15/15 · exhaust 12 · intake 13 · **supply 0** |
| `v_iot_farm_overview` | 2농장 |
| decode cursor | 전진 · fail 1h = 0 |

---

### 2. 인덱스 사용률 (DROP 후보 없음)

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

### 3. 트랙 단계

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

#### 시각 컬럼 (decoded)

| 컬럼 | 역할 | 상태 |
|------|------|------|
| `mesure_at` | 측정 시각(timestamptz) · 파티션·UNIQUE·trend | **정본 유지** (KST-as-UTC 패킷은 Edge에서 −9h) |
| `mesure_dt` | 측정 시각(KST text) · UI/LIVE | 유지(동일 순간 표현) |
| `received_at` | 클라우드 수신 · LIVE/오프라인 | 유지 |
| `decoded_at` | Edge 기록 시각 | **DROP** (`20260805193000_…`) |

#### D-slim A 적용

- migration: `20260805140000_iot_decoded_drop_unused_slim_a.sql` · 구 `iot-cloud` 적용됨 (운영 `fkkrjljeqxpbmazfnync`)
- `fan_supply_pct`는 RPC/list가 컬럼을 노출하므로 **미포함**(별도)

#### D-slim B+C 적용

- migration: `20260805141000_iot_decoded_fill_keys_bc.sql`
- `trg_iot_decoded_fill_keys` BEFORE INSERT/UPDATE
- Edge는 당분간 기존처럼 flat도 넣어도 됨(덮어쓰기 없음 · 빈 값만 채움)
- **컬럼 DROP 없음** — list/인덱스 계약 유지. 이후 Edge 미전송·컬럼 DROP은 별도 승인

---

### 4. 행 수 · 시계열 과다

#### HOT flat 시계열 (차트 RPC가 버킷하는 메트릭)

실측(2일): **temp·humidity·exhaust·intake**는 거의 항상 값 있음 · **`fan_supply_pct`는 0건(EC01 미사용)**.

차트 `TrendStallSeries`는 5본선(온도·습도·급기·배기·흡기) → **실데이터 기준 유효 4 + 빈 급기 1**.

해소 방안은 채팅/후속 문서에서 옵션으로 제시.

#### D — flat ↔ json

| 구간 | flat `temp`/`fan_*` | `decoded_json` |
|------|---------------------|----------------|
| HOT (최근 N일) | 유지 (list/trend 속도) | 유지 (패널) |
| WARM/COLD | 물리 생략 또는 NULL | 정본 · RPC 추출 |

주의: `fan_exhaust`/`fan_intake`·`temp_c`는 **현재 사용 중**. `fan_supply`만 비어 있음 → supply DROP/RPC 정리는 D와 별도 소작업 가능.

---

### 5. 관련

- [raw 저장 방식](#raw-저장-방식) — Phase 1~4
- [`IOT_RETENTION_OPTIONS.md`](./IOT_RETENTION_OPTIONS.md) — retention **정본**(2026-08-06 정합)
- [`SYSTEM_DB.md`](./SYSTEM_DB.md) §2.3 — HOT list 뷰
- [`IOT_RETENTION_OPTIONS.md`](./IOT_RETENTION_OPTIONS.md) — 희소 재관측
- D1 파티션·retention·월 파티션 cron은 **적용 완료** (본 §3 표)


---

## decoded_json 슬림

## decoded_json 슬림 A — 실행 계획

> **합의:** 채널급(모터 outputs 포함) 유지 · flat과 중복인 키만 제거  
> **비목표:** HOT에서 JSON 제거(C), channels 삭제  
> **대상:** `dashboard/web` · Edge `decode-batch` · 운영 Supabase `fkkrjljeqxpbmazfnync` (구 `iot-cloud` 폐기)  
> **일자:** 2026-08-05

---

### 1. 목적

- `iot_room_state_decoded.decoded_json`에서 **flat 컬럼과 중복되는 키**를 제거해 행 용량 감소
- **남김:** `channels`(서모·outputs/모터), `tempsC`(센서 4점), `schema_version`
- **선택(83바이트 보고):** `alarmLowTempC` · `alarmHighTempC` — 습도 뒤 저온·고온 경보. 온도 원점 500=0℃. 파일럿 LIVE도 83바이트(원점 500). 디코더는 예전 79바이트(원점 0)도 받음.
- 상세(full tier) · 일괄 적용 · 향후 모터별 UI 경로 유지

---

### 2. 대상 / 비대상 파일

| 구분 | 경로 |
|------|------|
| 수정 | `supabase/functions/decode-batch/index.ts` |
| 수정 | `supabase/functions/decode-batch/wire-decode-v0c.ts` (`toSlimDecodedJson`) |
| 수정(선택·테스트) | `src/lib/data/*` 읽기는 channels+tempsC면 이미 호환 |
| 문서 | 본 파일 · `STORAGE_LOG.md` 요약 링크 |
| 비대상 | raw 스키마, list tier SELECT, alarm `decoded_json` |

---

### 3. 새 JSON 형상

**쓰기 (신규 decode):**

```json
{
  "schema_version": "v0c-slim-1",
  "tempsC": ["24.5", "24.4", "24.0", "24.1"],
  "channels": [
    {
      "channel": "A",
      "eqpmnCode": "EC02",
      "outputs": { "1": "30", "2": "0" },
      "thermo": { "setpointTemp": "...", "tempDeviation": "...", "minVentPct": 0, "maxVentPct": 100 }
    }
  ]
}
```

83바이트 보고는 같은 객체에 `alarmLowTempC` · `alarmHighTempC` 가 추가된다.

**제거 키 (flat에 있음):**  
`controllerKey`, `eqpmnNo`, `stallTyCode`, `stallNo`, `wireVer`, `packetMode`, `history`, `mesureDt`, `runMode`, `humidityPct`

**읽기:**  
- 기존 fat(`v0c-1`) 행: 그대로 동작  
- slim(`v0c-slim-1`): `iot-live-fetch`는 이미 `j.channels` / `j.tempsC` + flat `humidity_pct`/`run_mode` 사용

---

### 4. DB / API / 인증 영향

| 항목 | 영향 |
|------|------|
| DB 스키마 | 변경 없음 (`jsonb` 내용만) |
| 뷰 `extract_channel_a_thermo(decoded_json->channels)` | channels 유지 → OK |
| RLS / 인증 | 없음 |
| Edge upsert | `decoded_json` 페이로드만 축소. 측정 시각은 `received_at` 대비 +9h(KST-as-UTC)면 −9h |
| 배포 | `decode-batch` 재배포 필요 |
| migration | 불필요 (선택: 문서만) |

---

### 5. 테스트

1. 단위: `toSlimDecodedJson` — 제거 키 없음 · channels/tempsC/schema 존재  
2. Edge 배포 후 decode 1회 → 신규 행 `schema_version=v0c-slim-1`, `pg_column_size` 감소  
3. full tier: 농장 패널 channels·서모·outputs 표시  
4. list tier: 기존 slim SELECT 회귀 없음  
5. alarm 패킷 JSON 경로 불변

---

### 6. 롤백

1. Edge를 이전 버전(전체 `DecodedV0cPayload` 저장)으로 재배포  
2. 이미 쓰인 slim 행은 읽기 호환 유지(롤백 후에도 문제 없음)  
3. fat→slim 강제 backfill 없음 → 되돌릴 데이터 변환 불필요

---

### 7. 예상 절약 → 실측 (2026-08-05)

| | fat `v0c-1` | slim `v0c-slim-1` |
|--|-------------|-------------------|
| avg `pg_column_size` | **731 B** | **509 B (−30%)** |
| 키 | 13개 | `schema_version`, `tempsC`, `channels` |
| outputs(모터) | 유지 | 유지 (예: `{"1":"37"}`) |

신규 decode부터 적용. 희소 skip·기존 행은 fat 유지(점진 치환).


---

## raw 저장 방식

## iot_room_state_raw 저장 방식 변경안

> **작성:** 2026-08-05  
> **대상:** EC2 `RS.py` + Supabase `iot_room_state_raw`  
> **목적:** 중복 컬럼 제거, wire 바이너리 단일 저장

---

### 1. 문제 (현행 중복)

| 중복 | 설명 |
|------|------|
| `topic` ≈ `regist_no` | RS가 동일 MQTT topic 문자열을 두 번 INSERT |
| `payload_json.data` ≈ `payload_bytea` | 동일 wire의 base64 JSON vs bytea |
| `lsind_regist_no` / `item_code` | `topic = sungil/{lsind}/{item}/raw`에 이미 포함 |
| `module_uid` | v0x0B/0x0C에서 암묵값 `1` (topic에 없음, 정보량 거의 없음) |

---

### 2. 목표 스키마 (최종)

RS INSERT **필수 필드만**:

```json
{
  "topic": "sungil/FARM02/P00/raw",
  "payload_bytea": "\\x0c00....",
  "received_at": "2026-08-05T06:40:00+00:00"
}
```

| 컬럼 | 유지 | 비고 |
|------|------|------|
| `id` | DB | identity / sequence |
| `topic` | **RS 기록** | MQTT topic |
| `payload_bytea` | **RS 기록** | wire 바이너리 (단일 소스) |
| `received_at` | **RS 기록** | 수신 시각 UTC |
| `saved_at` | DB default `now()` | |
| `mode` | DB default `'live'` | 필요 시 트리거로 wire flags 반영 가능 |
| `chunk_seq` | DB default `0` | |
| `payload_format` | DB default `'binary'` | RS 미전송 |

#### 제거 또는 파생 컬럼

| 컬럼 | 권장 |
|------|------|
| `regist_no` | **DROP** (또는 deprecated, NULL 허용 후 미사용) |
| `payload_json` | **DROP** (또는 deprecated) |
| `lsind_regist_no` | **GENERATED** / 트리거로 topic에서 파싱, 또는 View에서 파싱 |
| `item_code` | 동일 |
| `module_uid` | default `1` 또는 topic 규칙 확정 후 파생 |

파싱 규칙 (현행 MQTT):

```
topic ~ ^sungil/(?P<lsind>[^/]+)/(?P<item>[^/]+)/raw$
lsind_regist_no = lsind
item_code       = item
module_uid      = 1   -- 현행 암묵값
```

---

### 3. 적용 단계

#### Phase 1 — EC2 RS (본 문서와 함께 적용됨)

**현재 DB 제약** (`lsind_regist_no`, `item_code` **NOT NULL**) 때문에 INSERT에서 당장 뺄 수 없음.

RS `build_raw_passthrough_row` 변경:

| 필드 | Phase 1 |
|------|---------|
| `topic` | 유지 |
| `payload_bytea` | 유지 |
| `received_at` | 유지 |
| `lsind_regist_no` | **유지** (NOT NULL 대응, topic 파싱값) |
| `item_code` | **유지** |
| `module_uid` | **유지** (`1`) |
| `regist_no` | **제거** |
| `payload_json` | **제거** |
| `payload_format` | **제거** (DB default 사용) |

디코드/ACK는 `payload_bytea`만 사용. `payload_json` fallback은 레거시 행용으로 코드에 잔존.

#### Phase 2 — DB 정책 (로컬/Supabase 담당)

1. **트리거 또는 generated column**으로 `lsind_regist_no`, `item_code`를 `topic`에서 채우기  
   - 예: `BEFORE INSERT`에서 topic 파싱 후 세팅  
   - 또는 `STORED` generated (Postgres 버전/표현식 제약 확인)
2. `lsind_regist_no`, `item_code`를 RS 미전송해도 되도록 **default/trigger 보장** 후, 애플리케이션 NOT NULL 의존 유지 가능
3. `regist_no`, `payload_json` 컬럼 **DROP** (또는 장기 deprecate)
4. (선택) `module_uid SMALLINT NOT NULL DEFAULT 1`
5. View / RPC / Dashboard가 `payload_json`·`regist_no`를 쓰는지 검색 후 제거  
   - EC2 측 View(`v_iot_*`)는 `iot_room_state_decoded` 기준이라 raw `payload_json` 직접 의존은 낮음
6. 인덱스: `lsind_regist_no` 조회가 많으면 generated 컬럼 유지 + index 권장

#### Phase 3 — RS 최종 축소 (DB Phase 2 완료 후)

INSERT를 아래로 축소:

```python
{
    "topic": topic,
    "payload_bytea": bytes_to_bytea_hex(payload_bytes),
    "received_at": received_at,
}
```

`lsind_regist_no` / `item_code` / `module_uid`는 DB가 채움.

---

### 4. 예시 SQL (DB 참고안 — 로컬에서 검토 후 적용)

> 운영 DB에 바로 실행하지 말 것. 로컬/스테이징에서 검증.

#### 4.1 topic 파싱 트리거 (개념)

```sql
CREATE OR REPLACE FUNCTION public.iot_raw_fill_from_topic()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  parts text[];
BEGIN
  -- sungil/{lsind}/{item}/raw
  parts := string_to_array(NEW.topic, '/');
  IF array_length(parts, 1) >= 4
     AND parts[1] = 'sungil'
     AND parts[4] = 'raw' THEN
    IF NEW.lsind_regist_no IS NULL OR NEW.lsind_regist_no = '' THEN
      NEW.lsind_regist_no := parts[2];
    END IF;
    IF NEW.item_code IS NULL OR NEW.item_code = '' THEN
      NEW.item_code := parts[3];
    END IF;
  END IF;
  IF NEW.module_uid IS NULL THEN
    NEW.module_uid := 1;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_iot_raw_fill_from_topic
  BEFORE INSERT ON public.iot_room_state_raw
  FOR EACH ROW
  EXECUTE FUNCTION public.iot_raw_fill_from_topic();
```

#### 4.2 컬럼 정리 (트리거 검증 후)

```sql
-- RS가 더 이상 안 넣는 중복 컬럼
ALTER TABLE public.iot_room_state_raw DROP COLUMN IF EXISTS regist_no;
ALTER TABLE public.iot_room_state_raw DROP COLUMN IF EXISTS payload_json;

-- (선택) Phase 3 이후 RS가 lsind/item 미전송해도 되도록
-- ALTER ... 는 트리거가 항상 채우는 것을 확인한 뒤
```

---

### 5. EC2 / 앱 영향 (현행 · Phase 3/4 반영)

| 구성요소 | 영향 |
|----------|------|
| **RS.py / wire_decode** | Phase 3: INSERT = `topic` + `payload_bytea` + `received_at`만. `lsind`/`item`/`module_uid`는 DB 트리거·default |
| **command_ack** | `payload_bytea` 디코드 — 변경 없음 |
| **C.py** | 무관 |
| **Dashboard / View** | LIVE는 `iot_room_state_decoded` / `v_iot_*` 경유. raw `payload_json`·미사용 컬럼 의존 없음 (UI LIVE 확인 완료) |
| **decode-batch (Edge)** | raw에서 `payload_bytea` + farm 키 사용 — Phase 4 DROP과 무관 |
| **기존 raw 행** | 과거 `payload_json`/미사용 컬럼 값은 DROP으로 **복구 불가**. wire는 `payload_bytea`에 유지 |
| **DB 스키마** | Phase 2: `regist_no`/`payload_json` DROP + topic 트리거. Phase 4: 미사용 7컬럼 DROP. 유지: `mode`/`chunk_seq`(default) |

---

### 6. 검증 체크리스트

- [x] MQTT uplink → `iot_room_state_raw` INSERT 성공
- [x] Phase 1: 신규 `payload_json`/`regist_no` NULL → Phase 2에서 컬럼 DROP
- [x] `lsind_regist_no` / `item_code` 정상 (트리거 + Phase 3 후 실측)
- [x] Phase 3 EC2: INSERT 3필드만 · `rsd-rs` 재기동 · saved failed=0
- [x] LIVE 데이터 경로: `v_iot_decoded_latest` fresh (FARM01)
- [x] ACK DB 스모크: 최근 `applied`, sent→applied ≈3.5s (장비 명령 신규 미발행)
- [x] Phase 4: 미사용 7컬럼 DROP (구 iot-cloud 2026-08-05 · 운영은 `fkkrjljeqxpbmazfnync`)
- [x] Dashboard UI LIVE — 사용자 확인 완료 (2026-08-05)

#### 적용 기록

| 대상 | 내용 |
|------|------|
| 구 iot-cloud Phase 2 | `iot_raw_fill_from_topic` 트리거 · DROP `regist_no`/`payload_json` |
| 구 iot-cloud Phase 4 | DROP `wire_ver`,`lut_ver`,`row_count`,`batch_seq`,`crc_ok`,`farm_uid`,`session_id` (+ `idx_iot_raw_session`) |
| 로컬 migration | `20260805100000_*`, `20260805101000_*`, `20260805120000_iot_raw_drop_unused_passthrough_columns.sql` |
| EC2 Phase 3 | `/home/ubuntu/SI1/ec2_v2/rs/wire_decode.py` · bak=`wire_decode.py.bak.phase3` |
| 로컬 RSD | `Operation/RSD/wire_decode.py` · `tests/test_rs.py` (6 passed) |

---

### 7. 롤백

1. EC2: `cp wire_decode.py.bak.phase3 wire_decode.py && sudo systemctl restart rsd-rs`  
2. DB 트리거/DROP은 마이그레이션 역순 (DROP된 json·미사용 컬럼 **데이터 복구 불가**)

---

### 8. 미사용 컬럼 (RS passthrough — 전부 NULL)

최근 raw 500건 기준 non-null = 0. **Phase 4에서 DROP 완료** (2026-08-05).

| 컬럼 | 비고 | 상태 |
|------|------|------|
| `wire_ver` | 예전 ingest 헤더 파싱용. 지금은 decode 시 계산 | **DROPPED** |
| `lut_ver` | v0x0B/0x0C header에 없음 | **DROPPED** |
| `row_count` | 미기록 | **DROPPED** |
| `batch_seq` | 미기록 | **DROPPED** |
| `crc_ok` | 미기록 (decode 시 판정) | **DROPPED** |
| `farm_uid` | legacy topic용. 현행 topic에 없음 | **DROPPED** |
| `session_id` | v0x0B 의미 있으나 raw에 미기록 | **DROPPED** (+ partial index) |

`mode`, `chunk_seq`는 DB **default** (`live` / `0`)로만 채워짐 — **유지**. wire flags와 불일치할 수 있음 → decode 쪽만 신뢰.

---

### 9. 요약

| 단계 | 담당 | 내용 | 상태 |
|------|------|------|------|
| **Phase 1** | EC2 | `regist_no` / `payload_json` / `payload_format` INSERT 중단 | **완료** |
| **Phase 2** | DB | topic 파생 트리거 + 중복 컬럼 DROP | **완료** |
| **Phase 3** | EC2 RS | INSERT = `topic` + `payload_bytea` + `received_at` 만 | **완료** |
| **Phase 4** | DB | 미사용 passthrough 컬럼 7개 DROP | **완료** |

---

### 10. 용량 재실측 (구 iot-cloud · 2026-08-05 Phase 4 후 · 역사)

| 항목 | 값 |
|------|-----|
| **total** | **21 MB** |
| heap | ~3.9 MB (18%) |
| **indexes** | **~17 MB (81%)** |
| toast | ~72 KB |
| rows | 8,788 (col 11) |
| avg row | ~409 B (`payload_bytea` avg 80 B · 행의 ~20%) |
| decoded 비교 | total ~34 MB |

#### 인덱스

| index | size |
|-------|------|
| `idx_iot_raw_farm_module` | 6.8 MB |
| `idx_iot_raw_received_at` | 3.8 MB |
| `idx_iot_raw_binary_recent` | 3.8 MB |
| PK | 2.1 MB |
| `idx_iot_raw_topic` | 1.0 MB |

해석: Phase 2·4로 컬럼은 줄었으나 **raw도 indexes가 total의 ~81%**. 추가 용량 ROI는 retention·인덱스 정리 쪽. (Phase 2 직전 total도 ~21 MB였음 — 열 DROP은 이미 NULL인 열이라 total 급감은 제한적.)

문의 시 본 문서와 함께 `wire_decode.build_raw_passthrough_row` / `RS.py` 를 참조.


---

## 기타 테이블

## other-tables 용량 스캔 (2026-08-06)

> raw/decoded·명령 보관 트랙 이후 · **읽기 전용**  
> decoded 파티션 합산은 parent `0 bytes`로 보일 수 있음 · raw는 단일 테이블

### 상위 (public 일반 테이블)

| 테이블 | 크기 | est rows | 비고 |
|--------|------|----------|------|
| `iot_room_state_raw` | **22 MB** | ~9k | 이미 30d retention |
| `ctrl_thermo_command` | ~2.1 MB | ~2k | C1/C2·키/인덱스 적용됨 |
| `profiles` | 232 kB | 7 | 마스터. `ui_config` 레거시 키 제거 + `barnLayouts` 옛 SP 좌표 정리 2026-08-28 |
| `push_outbox` | 96 kB | 11 | 작음 |
| `farm_module_alarm` | 80 kB | 6 | 작음 |
| `iot_room_state_decode_failed` | 80 kB | 0 | 비움 |
| `iot_decoded_last_value` | 64 kB | 13 | LIVE 보조 |
| `user_push_device` | 64 kB | 4 | |
| 기타 마스터/설정 | ≤56 kB | — | |
| `farm_alarm_notify` | — | — | **DROP** 2026-08-28 (SMS 미오픈) |
| `aria_turn_log` | — | — | **DROP** 2026-08-28 (음성 폐기) |
| `farm_weather_snapshot` | — | — | **DROP** 2026-08-28 (기상 CTRL 폐기) |
| `weather_control_recommendation` | — | — | **DROP** 2026-08-28 (기상 CTRL 폐기) |
| `weather_control_config` | — | — | **DROP** 2026-08-28 |
| `weather_fetch_config` | — | — | **DROP** 2026-08-28 |
| `health_command_checkpoint` | 24 kB | 0 | |

### 다음 후보 판단

| 우선 | 테이블 | 이유 | 제안 |
|------|--------|------|------|
| — | raw / decoded / command | 트랙 완료 | 유지·관찰 |
| 낮음 | `push_outbox` | 행 적음 | 실패/잔존 TTL만 문서화 여지 |
| 완료 | `aria_turn_log` | 음성 폐기 | **DROP** 2026-08-28 |
| 완료 | `farm_weather_snapshot` · `weather_control_*` · `weather_fetch_config` | 기상 CTRL 폐기 | **DROP** 2026-08-28 |
| 완료 | `farm_alarm_notify` | SMS 미오픈 | **DROP** 2026-08-28 |
| 불필요 | 마스터류 | 성장 없음 | — |

**결론:** raw/decoded/command 외 **당장 용량 위생 대상 없음**. 다음은 제품 기능(푸시/SMS) 열릴 때 retention을 같이 설계.
