# decoded_json 슬림 A — 실행 계획

> **합의:** 채널급(모터 outputs 포함) 유지 · flat과 중복인 키만 제거  
> **비목표:** HOT에서 JSON 제거(C), channels 삭제  
> **대상:** `dashboard/web` · Edge `decode-batch` · 운영 Supabase `fkkrjljeqxpbmazfnync` (구 `iot-cloud` 폐기)  
> **일자:** 2026-08-05

---

## 1. 목적

- `iot_room_state_decoded.decoded_json`에서 **flat 컬럼과 중복되는 키**를 제거해 행 용량 감소
- **남김:** `channels`(서모·outputs/모터), `tempsC`(센서 4점), `schema_version`
- **선택(83바이트 보고):** `alarmLowTempC` · `alarmHighTempC` — 습도 뒤 저온·고온 경보. 온도 원점 500=0℃. 파일럿 LIVE도 83바이트(원점 500). 디코더는 예전 79바이트(원점 0)도 받음.
- 상세(full tier) · 일괄 적용 · 향후 모터별 UI 경로 유지

---

## 2. 대상 / 비대상 파일

| 구분 | 경로 |
|------|------|
| 수정 | `supabase/functions/decode-batch/index.ts` |
| 수정 | `supabase/functions/decode-batch/wire-decode-v0c.ts` (`toSlimDecodedJson`) |
| 수정(선택·테스트) | `src/lib/data/*` 읽기는 channels+tempsC면 이미 호환 |
| 문서 | 본 파일 · `DECODED_CAPACITY.md` 요약 링크 |
| 비대상 | raw 스키마, list tier SELECT, alarm `decoded_json` |

---

## 3. 새 JSON 형상

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

## 4. DB / API / 인증 영향

| 항목 | 영향 |
|------|------|
| DB 스키마 | 변경 없음 (`jsonb` 내용만) |
| 뷰 `extract_channel_a_thermo(decoded_json->channels)` | channels 유지 → OK |
| RLS / 인증 | 없음 |
| Edge upsert | `decoded_json` 페이로드만 축소. 측정 시각은 `received_at` 대비 +9h(KST-as-UTC)면 −9h |
| 배포 | `decode-batch` 재배포 필요 |
| migration | 불필요 (선택: 문서만) |

---

## 5. 테스트

1. 단위: `toSlimDecodedJson` — 제거 키 없음 · channels/tempsC/schema 존재  
2. Edge 배포 후 decode 1회 → 신규 행 `schema_version=v0c-slim-1`, `pg_column_size` 감소  
3. full tier: 농장 패널 channels·서모·outputs 표시  
4. list tier: 기존 slim SELECT 회귀 없음  
5. alarm 패킷 JSON 경로 불변

---

## 6. 롤백

1. Edge를 이전 버전(전체 `DecodedV0cPayload` 저장)으로 재배포  
2. 이미 쓰인 slim 행은 읽기 호환 유지(롤백 후에도 문제 없음)  
3. fat→slim 강제 backfill 없음 → 되돌릴 데이터 변환 불필요

---

## 7. 예상 절약 → 실측 (2026-08-05)

| | fat `v0c-1` | slim `v0c-slim-1` |
|--|-------------|-------------------|
| avg `pg_column_size` | **731 B** | **509 B (−30%)** |
| 키 | 13개 | `schema_version`, `tempsC`, `channels` |
| outputs(모터) | 유지 | 유지 (예: `{"1":"37"}`) |

신규 decode부터 적용. 희소 skip·기존 행은 fat 유지(점진 치환).
