# iot_room_state_raw 저장 방식 변경안

> **작성:** 2026-08-05  
> **대상:** EC2 `RS.py` + Supabase `iot_room_state_raw`  
> **목적:** 중복 컬럼 제거, wire 바이너리 단일 저장

---

## 1. 문제 (현행 중복)

| 중복 | 설명 |
|------|------|
| `topic` ≈ `regist_no` | RS가 동일 MQTT topic 문자열을 두 번 INSERT |
| `payload_json.data` ≈ `payload_bytea` | 동일 wire의 base64 JSON vs bytea |
| `lsind_regist_no` / `item_code` | `topic = sungil/{lsind}/{item}/raw`에 이미 포함 |
| `module_uid` | v0x0B/0x0C에서 암묵값 `1` (topic에 없음, 정보량 거의 없음) |

---

## 2. 목표 스키마 (최종)

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

### 제거 또는 파생 컬럼

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

## 3. 적용 단계

### Phase 1 — EC2 RS (본 문서와 함께 적용됨)

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

### Phase 2 — DB 정책 (로컬/Supabase 담당)

1. **트리거 또는 generated column**으로 `lsind_regist_no`, `item_code`를 `topic`에서 채우기  
   - 예: `BEFORE INSERT`에서 topic 파싱 후 세팅  
   - 또는 `STORED` generated (Postgres 버전/표현식 제약 확인)
2. `lsind_regist_no`, `item_code`를 RS 미전송해도 되도록 **default/trigger 보장** 후, 애플리케이션 NOT NULL 의존 유지 가능
3. `regist_no`, `payload_json` 컬럼 **DROP** (또는 장기 deprecate)
4. (선택) `module_uid SMALLINT NOT NULL DEFAULT 1`
5. View / RPC / Dashboard가 `payload_json`·`regist_no`를 쓰는지 검색 후 제거  
   - EC2 측 View(`v_iot_*`)는 `iot_room_state_decoded` 기준이라 raw `payload_json` 직접 의존은 낮음
6. 인덱스: `lsind_regist_no` 조회가 많으면 generated 컬럼 유지 + index 권장

### Phase 3 — RS 최종 축소 (DB Phase 2 완료 후)

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

## 4. 예시 SQL (DB 참고안 — 로컬에서 검토 후 적용)

> 운영 DB에 바로 실행하지 말 것. 로컬/스테이징에서 검증.

### 4.1 topic 파싱 트리거 (개념)

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

### 4.2 컬럼 정리 (트리거 검증 후)

```sql
-- RS가 더 이상 안 넣는 중복 컬럼
ALTER TABLE public.iot_room_state_raw DROP COLUMN IF EXISTS regist_no;
ALTER TABLE public.iot_room_state_raw DROP COLUMN IF EXISTS payload_json;

-- (선택) Phase 3 이후 RS가 lsind/item 미전송해도 되도록
-- ALTER ... 는 트리거가 항상 채우는 것을 확인한 뒤
```

---

## 5. EC2 / 앱 영향 (현행 · Phase 3/4 반영)

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

## 6. 검증 체크리스트

- [x] MQTT uplink → `iot_room_state_raw` INSERT 성공
- [x] Phase 1: 신규 `payload_json`/`regist_no` NULL → Phase 2에서 컬럼 DROP
- [x] `lsind_regist_no` / `item_code` 정상 (트리거 + Phase 3 후 실측)
- [x] Phase 3 EC2: INSERT 3필드만 · `rsd-rs` 재기동 · saved failed=0
- [x] LIVE 데이터 경로: `v_iot_decoded_latest` fresh (FARM01)
- [x] ACK DB 스모크: 최근 `applied`, sent→applied ≈3.5s (장비 명령 신규 미발행)
- [x] Phase 4: 미사용 7컬럼 DROP (구 iot-cloud 2026-08-05 · 운영은 `fkkrjljeqxpbmazfnync`)
- [x] Dashboard UI LIVE — 사용자 확인 완료 (2026-08-05)

### 적용 기록

| 대상 | 내용 |
|------|------|
| 구 iot-cloud Phase 2 | `iot_raw_fill_from_topic` 트리거 · DROP `regist_no`/`payload_json` |
| 구 iot-cloud Phase 4 | DROP `wire_ver`,`lut_ver`,`row_count`,`batch_seq`,`crc_ok`,`farm_uid`,`session_id` (+ `idx_iot_raw_session`) |
| 로컬 migration | `20260805100000_*`, `20260805101000_*`, `20260805120000_iot_raw_drop_unused_passthrough_columns.sql` |
| EC2 Phase 3 | `/home/ubuntu/SI1/ec2_v2/rs/wire_decode.py` · bak=`wire_decode.py.bak.phase3` |
| 로컬 RSD | `Operation/RSD/wire_decode.py` · `tests/test_rs.py` (6 passed) |

---

## 7. 롤백

1. EC2: `cp wire_decode.py.bak.phase3 wire_decode.py && sudo systemctl restart rsd-rs`  
2. DB 트리거/DROP은 마이그레이션 역순 (DROP된 json·미사용 컬럼 **데이터 복구 불가**)

---

## 8. 미사용 컬럼 (RS passthrough — 전부 NULL)

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

## 9. 요약

| 단계 | 담당 | 내용 | 상태 |
|------|------|------|------|
| **Phase 1** | EC2 | `regist_no` / `payload_json` / `payload_format` INSERT 중단 | **완료** |
| **Phase 2** | DB | topic 파생 트리거 + 중복 컬럼 DROP | **완료** |
| **Phase 3** | EC2 RS | INSERT = `topic` + `payload_bytea` + `received_at` 만 | **완료** |
| **Phase 4** | DB | 미사용 passthrough 컬럼 7개 DROP | **완료** |

---

## 10. 용량 재실측 (구 iot-cloud · 2026-08-05 Phase 4 후 · 역사)

| 항목 | 값 |
|------|-----|
| **total** | **21 MB** |
| heap | ~3.9 MB (18%) |
| **indexes** | **~17 MB (81%)** |
| toast | ~72 KB |
| rows | 8,788 (col 11) |
| avg row | ~409 B (`payload_bytea` avg 80 B · 행의 ~20%) |
| decoded 비교 | total ~34 MB |

### 인덱스

| index | size |
|-------|------|
| `idx_iot_raw_farm_module` | 6.8 MB |
| `idx_iot_raw_received_at` | 3.8 MB |
| `idx_iot_raw_binary_recent` | 3.8 MB |
| PK | 2.1 MB |
| `idx_iot_raw_topic` | 1.0 MB |

해석: Phase 2·4로 컬럼은 줄었으나 **raw도 indexes가 total의 ~81%**. 추가 용량 ROI는 retention·인덱스 정리 쪽. (Phase 2 직전 total도 ~21 MB였음 — 열 DROP은 이미 NULL인 열이라 total 급감은 제한적.)

문의 시 본 문서와 함께 `wire_decode.build_raw_passthrough_row` / `RS.py` 를 참조.
