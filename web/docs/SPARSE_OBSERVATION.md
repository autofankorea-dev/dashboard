# 희소(sparse) 관측 체크 쿼리

> **상태 (2026-09-01):** **`sparse_enabled=false` — PoC OFF** (LIVE·델린 caution side effect 기각)  
> **migration:** `20260901153000_iot_decode_sparse_off.sql`  
> **롤백:** `UPDATE iot_decode_config SET sparse_enabled = true WHERE id = 1;` (승인 후)  
> **대상:** iot-cloud · allowlist `FARM01/P00`, `FARM02/P00` (OFF 시 gate 미적용)  
> **관련:** [`DECODED_ROWCOUNT_PLAN.md`](./DECODED_ROWCOUNT_PLAN.md)

---

## OFF 사유 (요약)

| side effect | sparse ON | OFF 후 |
|-------------|-----------|--------|
| LIVE `received_at` | decode skip 시 정체 → caution | raw uplink마다 decoded 갱신 |
| 델린 tier `stale` | sparse-induced caution | 대부분 해소 |
| decoded/raw 비율 | ~25–36% (allowlist) | ~100% (실패 제외) |

장비 **mesure 지연·replay** caution은 OFF와 무관 — 별도 triage.

---

## 성공 기준 (PoC — **보관용**, 현재 OFF)

| 지표 | 기대 |
|------|------|
| allowlist 농장 `decoded_n / raw_n` | 대략 **&lt; 70%**(변동·heartbeat에 따라 다름) |
| LIVE / trend | 이상 없음 · 사용자 체감 OK |
| `decode_failed` (UPSERT) | 지속 증가 없음 |
| `decode_failed` (`INVALID_STALL_TY`) | 축사유형 1~10 제한은 해제됨. 0~255는 `SP00`~`SP255`로 decoded에 기록. 과거 실패 행은 raw 재디코드로 복원 |
| slim JSON | 신규 행 `v0c-slim-1` 비율 증가 |

---

## 1) 설정 확인

```sql
SELECT sparse_enabled, sparse_farm_keys,
       sparse_eps_temp, sparse_eps_fan, sparse_heartbeat_sec
FROM public.iot_decode_config
WHERE id = 1;
```

## 2) 일별 raw vs decoded (농장별) — 핵심

```sql
WITH bounds AS (
  SELECT now() - interval '7 days' AS since
),
raw_d AS (
  SELECT
    (received_at AT TIME ZONE 'Asia/Seoul')::date AS day_kst,
    lsind_regist_no || '/' || item_code AS farm,
    count(*)::int AS raw_n
  FROM public.iot_room_state_raw, bounds
  WHERE received_at >= bounds.since
  GROUP BY 1, 2
),
dec_d AS (
  SELECT
    (received_at AT TIME ZONE 'Asia/Seoul')::date AS day_kst,
    lsind_regist_no || '/' || item_code AS farm,
    count(*)::int AS decoded_n
  FROM public.iot_room_state_decoded, bounds
  WHERE received_at >= bounds.since
  GROUP BY 1, 2
)
SELECT
  coalesce(r.day_kst, d.day_kst) AS day_kst,
  coalesce(r.farm, d.farm) AS farm,
  coalesce(r.raw_n, 0) AS raw_n,
  coalesce(d.decoded_n, 0) AS decoded_n,
  round(
    100.0 * coalesce(d.decoded_n, 0) / nullif(r.raw_n, 0),
    1
  ) AS decoded_pct_of_raw
FROM raw_d r
FULL OUTER JOIN dec_d d
  ON r.day_kst = d.day_kst AND r.farm = d.farm
ORDER BY 1 DESC, 2;
```

## 3) last_value · 실패 · slim 비율

```sql
SELECT count(*)::int AS last_value_rows
FROM public.iot_decoded_last_value;

SELECT error_code, count(*)::int AS n
FROM public.iot_room_state_decode_failed
WHERE attempted_at > now() - interval '24 hours'
GROUP BY 1
ORDER BY 2 DESC;

-- 유형 바이트 이상(가림 후 관측). error_detail 예: stall_ty_raw=255 stall_no=255 eqpmn_no=1
SELECT raw_id, error_detail, attempted_at
FROM public.iot_room_state_decode_failed
WHERE error_code = 'INVALID_STALL_TY'
ORDER BY attempted_at DESC
LIMIT 50;

SELECT
  decoded_json->>'schema_version' AS ver,
  count(*)::int AS n,
  round(avg(pg_column_size(decoded_json))) AS avg_json_b
FROM public.iot_room_state_decoded
WHERE received_at > now() - interval '2 days'
GROUP BY 1
ORDER BY 2 DESC;
```

## 4) 파티션·용량 스냅샷

```sql
SELECT
  inhrelid::regclass::text AS partition,
  pg_size_pretty(pg_total_relation_size(inhrelid)) AS total
FROM pg_inherits
WHERE inhparent = 'public.iot_room_state_decoded'::regclass
ORDER BY 1;

SELECT
  (SELECT count(*) FROM public.iot_room_state_decoded)::int AS decoded_n,
  (SELECT count(*) FROM public.iot_room_state_raw)::int AS raw_n,
  (SELECT pg_size_pretty(sum(pg_total_relation_size(inhrelid)))
   FROM pg_inherits
   WHERE inhparent = 'public.iot_room_state_decoded'::regclass) AS decoded_parts;
```

## 5) 판정 메모

- `decoded_pct_of_raw`가 allowlist에서 계속 ~100%면 heartbeat만 쓰이거나 eps가 너무 큼 → ε/heartbeat 재검토  
- 다른 농장이 생기면 allowlist 밖은 ~100%가 정상(희소 미적용)  
- ~~확대~~ **OFF (2026-09-01):** `sparse_enabled=false` — 재개 시 LIVE 분리 설계 선행

---

## 베이스라인 (2026-08-05 실행)

| day_kst | farm | raw_n | decoded_n | decoded_pct |
|---------|------|-------|-----------|-------------|
| 2026-08-05 | FARM01/P00 | 1538 | 1533 | **99.7%** |
| 2026-08-05 | FARM02/P00 | 3 | 3 | 100% |
| 2026-08-04 | FARM01/P00 | 1297 | 1296 | 99.9% |

→ 당일까지는 희소 효과가 일 집계에 거의 안 보임(값 변동·재처리·PoC 직후). **3~7일 동일 쿼리 재실행** 후 ε/heartbeat 조정 여부 판단.

---

## 재관측 (2026-08-06)

> Canvas: `sparse-reobservation-2026-08-06.canvas.tsx` · 읽기 전용

### 설정 (변경 없음)

`sparse_enabled=true` · farms=`FARM01/P00`,`FARM02/P00` · ε_t=0.2 · ε_f=2 · hb=1800s  
`decode_failed` 7d/1h = 0

### FARM01 일별 decoded÷raw

| day_kst | raw_n | decoded_n | pct | 비고 |
|---------|-------|-----------|-----|------|
| 2026-07-29~31 · 08-03 | — | — | **~100%** | |
| 2026-08-04 | 1297 | 1296 | 99.9% | |
| 2026-08-05 | 1594 | 1589 | 99.7% | |
| 2026-08-06 (부분) | 411 | 387 | **94.2%** | 첫 skip 징후 |

### 원인 요약 (FARM01 · 최근 24h · 연속 decoded)

- p50 샘플 간격 ≈ 300s ≪ heartbeat 1800s → heartbeat 강제 거의 없음(14건)
- p50 |Δtemp| ≈ 0.2 · 온도 트리거 다수 · **팬만 ε 초과 ~550건**
- “전부 조용(스킵 후보)” = **0** → 시뮬이 ε를 자주 넘김

### 판정

| 항목 | 결과 |
|------|------|
| 목표 &lt;70% | **미달** |
| allowlist 확대 | **하지 않음** |
| 권고 | **A 관측 유지** · ε/팬 게이트 변경은 승인 후(B/C) |

## 추이 차트 표시 (2026-08-28)

희소 스킵은 decoded 행을 만들지 않는다. 차트 탭은 `farm_trend_uplink_coverage_json`(측정 시각 버킷, `clock_kst` 보정)으로 희소 칸의 **직전 값 유지**와 raw 없음의 **선 단절**만 적용한다. 색면·구간 라벨·범례는 그리지 않는다. LIVE 카드 신선도는 `received_at`+`mesure_dt`(`live-status.ts`). RPC는 migration `20260901003000` — **iot-cloud 적용됨**(2026-09-01).
