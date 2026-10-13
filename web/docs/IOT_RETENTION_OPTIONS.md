# IoT 보존(Retention) — 채택·적용 현황

> **정합:** 2026-08-28 · 구 `iot-cloud` 실측 cron (ops 로그 7일 추가)  
> **운영 DB (현재):** `fkkrjljeqxpbmazfnync` · 구 `iot-cloud`(`ompufmezugftzoergdbn`) **폐기**  
> **역할:** 보존 정책의 옵션 이력 · **실행 상태는 본 문서 §현재 상태**가 정본  
> 상세 설계·파티션: [행 수 계획](#행-수-계획) · archive DROP·slim·thermo flat: 아래 slim 절 · 용량: [`STORAGE_LOG.md`](./STORAGE_LOG.md)

대시보드 읽기는 `latest` 뷰 + trend RPC. 보존은 디스크·스캔 상한용 운영 과제였고, **아래 채택안은 적용 완료**.

---

## 전제 (합의 · 유지)

- IoT는 **운영 단일 Supabase 프로젝트** (`fkkrjljeqxpbmazfnync`). 구 `iot-cloud`는 폐기.
- 타 Supabase 프로젝트로 COLD 분리 **금지** (현 단계)
- 물리 테이블을 View로 바꿔 “저장 절약” **금지**
- 대시보드: LIVE=최신 투영 · 차트 최대 **30일** · raw는 앱 읽기 경로 비포함
- 추가 `DELETE` / 파티션 DROP 정책 변경 · cron 스케줄 변경은 **명시 승인 후**

---

## 채택안 (적용됨)

합의(2026-08-05) 후 구현·cron on:

| 층 | 동작 |
|----|------|
| **D1 파티션** | `iot_room_state_decoded` `RANGE (mesure_at)` 월 단위 |
| **HOT** | 최근 ~30일 (차트·LIVE 상한과 동일 · WARM 티어 없음) |
| **Retention** | 월 상한 ≤ now−30d 파티션 → detach → `archive.*_archived` + raw `received_at` 30일 초과 batch DELETE |
| **Archive soak DROP** | archive 월 종료 ≤ now−**60d** (retention 30d + soak 30d) → DROP |
| **월 파티션 예비** | 익월 등 자동 생성 |

### pg_cron (당시 구 iot-cloud · active · 역사)

| jobname | schedule (UTC) | KST 대략 | command |
|---------|----------------|----------|---------|
| `ensure-iot-decoded-partitions-daily` | `0 18 * * *` | 03:00 | `ensure_iot_decoded_month_partitions(2)` |
| `cleanup-iot-retention-30d-daily` | `30 18 * * *` | 03:30 | `cleanup_iot_retention_30d(30, 10000)` |
| `cleanup-iot-archive-drop-daily` | `45 18 * * *` | 03:45 | `cleanup_iot_archive_drop(30, 30)` |
| `cleanup-ops-logs-7d-daily` | `50 18 * * *` | 03:50 | `cleanup_ops_logs_7d(7, 10000)` |

`net._http_response` · `cron.job_run_details`는 제품 데이터가 아니라 pg_net/pg_cron 실행 로그. **7일** 초과분 배치 DELETE. 스케줄(`cron.job`)은 유지. `VACUUM FULL`은 용량 회수용 **1회 작업**이며 일일 잡에 넣지 않음.

구 `iot-cloud` 적용 (2026-08-28): HTTP **481 MB → 3.4 MB**, cron 기록 **340 MB → 37 MB**, DB **1,171 MB → 391 MB**. 일일 잡 `cleanup-ops-logs-7d-daily` (03:50 KST). 현재 운영은 `fkkrjljeqxpbmazfnync`.

함수·마이그레이션: dashboard `supabase/migrations`.

### slim · thermo flat (2026-08-05)

전 행 `decoded_json` → `v0c-slim-1` (`tempsC` + `channels`만). 실측: 대부분 slim · avg JSON ~509B.

서모 flat 컬럼: `setpoint_temp`, `temp_deviation`, `min_vent_pct`, `max_vent_pct`. `v_iot_dashboard_list`는 flat만 사용한다 (JSON extract 제거). Edge decode-batch가 Channel A thermo를 flat에 기록한다.

### 대시보드 영향 (현재)

- LIVE latest: **영향 없음** (최신만)
- `farm_trend_history*`: 앱 기간 ≤30일과 정합 · 그 이상 요청 시 빈 버킷 가능(UI 상한 30일)
- raw: 30일 초과 batch 삭제 · 재처리/장기 디버그는 archive·기간 내만

---

## 옵션 비교 (이력 · 참고)

초기 Sprint C에서 비교했던 메뉴. **채택 = D(파티션) + C(archive detach) + B에 준하는 raw 30d DELETE + archive 60d DROP**.

| 옵션 | 내용 | 현 상태 |
| --- | --- | --- |
| **A. 관측만** | 디스크·행 수 모니터링 | 용량 문서·희소 관측과 병행 |
| **B. 30일 롤링 DELETE** | 행 단위 삭제 | raw에 batch DELETE로 **적용** · decoded는 파티션 detach 우선 |
| **C. archive** | detach 후 archive 스키마 | **적용** |
| **D. 파티션** | 월 RANGE | **적용 (D1)** |
| **E. multi-DB COLD** | 타 프로젝트 | **채택 안 함** |

---

## 승인 전 체크리스트 (추가 변경 시)

정책·일수·cron을 **다시 바꿀 때**만:

- [ ] 변경 내용(일수·DROP 여부)과 영향 범위
- [ ] dry-run: detach/삭제 대상 추정
- [ ] trend 24h/30d 스모크
- [ ] 롤백: 해당 cron `active=false`
- [ ] 사용자 명시 승인

---

## 현재 상태 (2026-08-28)

| 항목 | 상태 |
| --- | --- |
| 정책 | HOT=보관=차트 **30일** · archive soak **+30일** 후 DROP · ops 로그 **7일** |
| SQL / 함수 / cron | **적용·active** (위 표 + `cleanup-ops-logs-7d-daily`) |
| 희소(D3) | PoC on · 확대 보류 ([`IOT_RETENTION_OPTIONS.md`](./IOT_RETENTION_OPTIONS.md)) |
| cmd-poll ids 배칭 | 백로그 (보존과 무관) |
| 문서 | 본 문서 = retention **정본** (구 “미실행” 문구 폐기) |

관련: [`SYSTEM_DB.md`](./SYSTEM_DB.md) §2.3 · [`QA_RECORD.md`](./QA_RECORD.md) · [`SYSTEM_APP.md`](./SYSTEM_APP.md#작업-맥락)

---

## 행 수 계획

실행 상태의 정본은 위 채택안이다. 아래는 합의와 설계 상세다.

## decoded 행 수 계획 — 상세 계획

> **대상:** `iot_room_state_decoded` (+ raw는 후속 별도)  
> **전략:** ① 파티션 HOT 경량화 → ② 희소 쓰기(추천안) → ③ 30일 초과 retention  
> **합의 확정:** 2026-08-05 (아래 §합의)  
> **실행 상태:**  
> ① D1 파티션 **운영 적용** · legacy **DROP** (2026-08-05)  
> ② 희소 PoC — allowlist 적용 후 **OFF 2026-09-01** (`sparse_enabled=false` · LIVE·델린 side effect) · migration `20260901153000`  
> ③ retention **cron on** — `cleanup_iot_retention_30d` 매일 03:30 KST · archive soak DROP · 월 파티션 ensure  
> **문서 정합:** 2026-09-11 — sparse OFF · [`IOT_RETENTION_OPTIONS.md`](./IOT_RETENTION_OPTIONS.md)

실측(2026-08-06): decoded ~9.4k행 · 파티션 합 ~27MB · raw ~22MB.

관련: [`STORAGE_LOG.md`](./STORAGE_LOG.md) · [`IOT_RETENTION_OPTIONS.md`](./IOT_RETENTION_OPTIONS.md) · [`STORAGE_LOG.md`](./STORAGE_LOG.md) · [`IOT_RETENTION_OPTIONS.md`](./IOT_RETENTION_OPTIONS.md)

---

### 합의 (잠금)

| 항목 | 결정 |
|------|------|
| **HOT** | **현재로부터 30일** 로그 (차트·LIVE가 보는 전 구간) |
| **희소** | **추천안 채택** — Edge decode만 희소 · raw 유지 · 절대값+heartbeat · Δ 금지 |
| **차트·보관 상한** | **30일** — 초과분 detach/archive(또는 승인된 DELETE) |

함의: HOT 창 = 보관 상한 = 30일 → **WARM 티어 없음**.  
보관 창 안은 전부 HOT 인덱스 · **30일 초과만** COLD(detach).

---

### 0. 목표·비목표

| 목표 | 비목표 |
|------|--------|
| 30일 창 안 LIVE/trend 성능·운영 비용 통제 | multi-DB COLD |
| 희소로 **일 행 증가율** 억제 | 순수 Δ 체인 |
| 30일 초과 안전 폐기 | 승인 없는 DELETE |
| latest / trend RPC / list flat 계약 유지 | View로 저장 위장 |

---

### 1단계 — 파티션 (D1)

#### 1.1 키·단위

- `PARTITION BY RANGE (mesure_at)` · **월 단위** 파티션  
- Free tier: 동시에 살아 있는 파티션 ≈ **당월 + 전월**(≤30일이면 최대 2~3개) + 익월 예비

#### 1.2 티어 (확정안)

| 티어 | 정의 | 인덱스 | 읽기 |
|------|------|--------|------|
| **HOT** | `mesure_at >= now() - 30 days` 인 월 파티션들 | 현행 5종 동등 | LIVE + trend 전체(≤30d) |
| **COLD** | 30일 밖 월 파티션 | detach → archive(동일 스키마) 또는 승인 후 DROP | 기본 앱 경로 **제외** |

월 경계: “정확히 30일”은 job이 **일 단위로 detach 후보 판정**(파티션 전체가 30일보다 오래되면 detach).

#### 1.3 전환 절차 (승인 후)

1. 파티션 부모 테이블 생성 + 월 파티션  
2. 데이터 복사 · 인덱스·트리거(`fill_keys`, `mesure_at`)·RLS 재부착  
3. `raw_id` UNIQUE/FK 전략 확정(버전 제약 검토)  
4. 뷰/RPC는 **부모** 조회(30일 필터는 RPC·앱 기존 기간과 일치)  
5. rename 스왑 · Edge upsert 검증  
6. `_legacy` 안정화 후 DROP(별도 승인)

#### 1.4 완료 기준

- [ ] LIVE·trend(≤30d) 스모크  
- [ ] upsert failed=0  
- [ ] HOT 파티션만 autovacuum 부담

---

### 2단계 — 희소 쓰기 (D3 · 추천안 확정)

#### 2.1 정책

```
series = (lsind, item, module_uid, controller_key)
last = 직전 **decoded에 저장한** 절대값
if |temp-last.temp| > ε_temp
   OR |fan_ex-last.fan_ex| > ε_fan OR |fan_in-last.fan_in| > ε_fan
   OR now - last_t >= heartbeat:
    UPSERT decoded (absolute)
    update last
else:
    skip decoded   # raw INSERT는 그대로
```

| 파라미터 | **확정 초깃값(추천)** | 조정 |
|----------|----------------------|------|
| ε_temp | **0.2 °C** | PoC 후 ±0.1 |
| ε_fan | **2 %p** | PoC 후 1~3 |
| heartbeat | **30분** | 5분×6 업링크마다 최소 1행 |
| 위치 | **decode-batch (Edge)** | RS에서 필터 금지 |
| last 저장 | 테이블 `iot_decoded_last_value` (또는 동등) | Redis 선택 |

`fan_supply`는 현재 미기록 → 비교에서 제외(exhaust/intake·temp만).

#### 2.2 차트

- LIVE: 최신 absolute → 변화 없음  
- trend: PoC에서 **LOCF 후 버킷 avg** vs 현행 관측평균 오차 측정 후 문서화  
- 차트 UI 최대 기간 **30일**과 동일

#### 2.3 롤아웃

1. ~~last 테이블 + config~~ → migration `20260805150000_iot_decoded_sparse_poc.sql` 적용  
2. ~~Edge decode-batch 희소 게이트~~ → 배포 v14 · allowlist `FARM01/P00` · ε_temp=0.2 · ε_fan=2 · heartbeat=1800s  
3. ~~관측~~ → **OFF** (2026-09-01) — 확대·ε 조정 중단 · 재개 시 LIVE 신선도 분리 선행  
4. 전 농장 확대 (`sparse_farm_keys` 비우면 전체)  
5. 플래그 기본 on 유지 / 장애 시 `sparse_enabled=false`

스모크(2026-08-05): 동일 raw 재처리 시 `sparse_skipped>0` · `last_value` 갱신 확인.  
skip 시에도 decode cursor는 전진(raw 보존 · 재디코드는 cursor rewind로 가능).

#### 2.4 완료 기준

- [x] raw 행 수 불변(희소는 decoded만 skip)  
- [ ] PoC 행/일 감소율 기록  
- [ ] trend 30d UX 허용

---

### 3단계 — Retention (D4 · 30일)

#### 3.1 정책 (**적용됨**)

- decoded: **`mesure_at` 기준 30일 초과** 월 파티션 → **detach → archive**  
- archive: soak **30일** 후 DROP (`cleanup_iot_archive_drop(30, 30)`)  
- raw: **30일** (`received_at`) batch DELETE — 동일 retention 함수  
- dry-run(2026-08-05): 당시 30일 초과 0행. job은 일 1회 대기  
- 정본: [`IOT_RETENTION_OPTIONS.md`](./IOT_RETENTION_OPTIONS.md)

#### 3.2 Job (**cron active**)

| job | UTC | 역할 |
|-----|-----|------|
| `ensure-iot-decoded-partitions-daily` | 18:00 | 월 파티션 예비 |
| `cleanup-iot-retention-30d-daily` | 18:30 | detach + raw DELETE |
| `cleanup-iot-archive-drop-daily` | 18:45 | archive soak DROP |

#### 3.3 승인 체크리스트 (추가 변경 시)

- [x] 초기 적용·cron on (2026-08-05)  
- [ ] 일수·DROP 정책 변경 시 dry-run · trend 스모크 · **재승인**

---

### 4. 확정 로드맵

```text
합의 잠금 (본 문서)
    │
    ├─① D1 파티션 SQL 초안 → 승인 → 전환
    │
    ├─② 희소: last 테이블 + Edge 플래그 → FARM01 PoC → 전체
    │
    └─③ 30d detach→archive + archive soak DROP + raw 30d → **cron on**
```

①·③ **완료**. ② 희소 allowlist PoC **OFF** 2026-09-01 ([`IOT_RETENTION_OPTIONS.md`](./IOT_RETENTION_OPTIONS.md)).

---

### 5. 다음 실행 게이트

| # | 항목 | 상태 |
|---|------|------|
| 1 | D1 파티션 | ✅ 운영 적용 · legacy DROP |
| 2 | 희소 PoC | ⏸ **OFF** 2026-09-01 — LIVE·델린 side effect · migration `20260901153000` |
| 3 | retention 30d + archive DROP | ✅ cron 3종 active |

다음: retention **추가 작업 없음**. sparse 재개 시 승인 + side effect 분리 설계 선행.

---

## 희소 관측 쿼리

`sparse_enabled=false`이다. 아래 쿼리는 보관용이다.

## 희소(sparse) 관측 체크 쿼리

> **상태 (2026-09-01):** **`sparse_enabled=false` — PoC OFF** (LIVE·델린 caution side effect 기각)  
> **migration:** `20260901153000_iot_decode_sparse_off.sql`  
> **롤백:** `UPDATE iot_decode_config SET sparse_enabled = true WHERE id = 1;` (승인 후)  
> **대상 (당시):** 구 `iot-cloud` · allowlist `FARM01/P00`, `FARM02/P00` (OFF 시 gate 미적용)  
> **운영 DB (현재):** `fkkrjljeqxpbmazfnync` · 구 `iot-cloud` **폐기**  
> **관련:** [`IOT_RETENTION_OPTIONS.md`](./IOT_RETENTION_OPTIONS.md)

---

### OFF 사유 (요약)

| side effect | sparse ON | OFF 후 |
|-------------|-----------|--------|
| LIVE `received_at` | decode skip 시 정체 → caution | raw uplink마다 decoded 갱신 |
| 델린 tier `stale` | sparse-induced caution | 대부분 해소 |
| decoded/raw 비율 | ~25–36% (allowlist) | ~100% (실패 제외) |

장비 **mesure 지연·replay** caution은 OFF와 무관 — 별도 triage.

---

### 성공 기준 (PoC — **보관용**, 현재 OFF)

| 지표 | 기대 |
|------|------|
| allowlist 농장 `decoded_n / raw_n` | 대략 **&lt; 70%**(변동·heartbeat에 따라 다름) |
| LIVE / trend | 이상 없음 · 사용자 체감 OK |
| `decode_failed` (UPSERT) | 지속 증가 없음 |
| `decode_failed` (`INVALID_STALL_TY`) | 축사유형 바이트 1~10 밖(예: `0xFF`). **decoded 미기록(가림)** · raw는 유지. 펌웨어 미설정 관측용. UPSERT 장애와 구분 |
| slim JSON | 신규 행 `v0c-slim-1` 비율 증가 |

---

### 1) 설정 확인

```sql
SELECT sparse_enabled, sparse_farm_keys,
       sparse_eps_temp, sparse_eps_fan, sparse_heartbeat_sec
FROM public.iot_decode_config
WHERE id = 1;
```

### 2) 일별 raw vs decoded (농장별) — 핵심

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

### 3) last_value · 실패 · slim 비율

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

### 4) 파티션·용량 스냅샷

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

### 5) 판정 메모

- `decoded_pct_of_raw`가 allowlist에서 계속 ~100%면 heartbeat만 쓰이거나 eps가 너무 큼 → ε/heartbeat 재검토  
- 다른 농장이 생기면 allowlist 밖은 ~100%가 정상(희소 미적용)  
- ~~확대~~ **OFF (2026-09-01):** `sparse_enabled=false` — 재개 시 LIVE 분리 설계 선행

---

### 베이스라인 (2026-08-05 실행)

| day_kst | farm | raw_n | decoded_n | decoded_pct |
|---------|------|-------|-----------|-------------|
| 2026-08-05 | FARM01/P00 | 1538 | 1533 | **99.7%** |
| 2026-08-05 | FARM02/P00 | 3 | 3 | 100% |
| 2026-08-04 | FARM01/P00 | 1297 | 1296 | 99.9% |

→ 당일까지는 희소 효과가 일 집계에 거의 안 보임(값 변동·재처리·PoC 직후). **3~7일 동일 쿼리 재실행** 후 ε/heartbeat 조정 여부 판단.

---

### 재관측 (2026-08-06)

> Canvas: `sparse-reobservation-2026-08-06.canvas.tsx` · 읽기 전용

#### 설정 (변경 없음)

`sparse_enabled=true` · farms=`FARM01/P00`,`FARM02/P00` · ε_t=0.2 · ε_f=2 · hb=1800s  
`decode_failed` 7d/1h = 0

#### FARM01 일별 decoded÷raw

| day_kst | raw_n | decoded_n | pct | 비고 |
|---------|-------|-----------|-----|------|
| 2026-07-29~31 · 08-03 | — | — | **~100%** | |
| 2026-08-04 | 1297 | 1296 | 99.9% | |
| 2026-08-05 | 1594 | 1589 | 99.7% | |
| 2026-08-06 (부분) | 411 | 387 | **94.2%** | 첫 skip 징후 |

#### 원인 요약 (FARM01 · 최근 24h · 연속 decoded)

- p50 샘플 간격 ≈ 300s ≪ heartbeat 1800s → heartbeat 강제 거의 없음(14건)
- p50 |Δtemp| ≈ 0.2 · 온도 트리거 다수 · **팬만 ε 초과 ~550건**
- “전부 조용(스킵 후보)” = **0** → 시뮬이 ε를 자주 넘김

#### 판정

| 항목 | 결과 |
|------|------|
| 목표 &lt;70% | **미달** |
| allowlist 확대 | **하지 않음** |
| 권고 | **A 관측 유지** · ε/팬 게이트 변경은 승인 후(B/C) |

### 추이 차트 표시 (2026-08-28)

희소 스킵은 decoded 행을 만들지 않는다. 차트 탭은 `farm_trend_uplink_coverage_json`(측정 시각 버킷, `clock_kst` 보정)으로 희소 칸의 **직전 값 유지**와 raw 없음의 **선 단절**만 적용한다. 색면·구간 라벨·범례는 그리지 않는다. LIVE 카드 신선도는 `received_at`+`mesure_dt`(`live-status.ts`). RPC는 migration `20260901003000` — 구 `iot-cloud` 적용(2026-09-01) · 운영 `fkkrjljeqxpbmazfnync`.
