# IoT 보존(Retention) — 채택·적용 현황

> **정합:** 2026-10-30 · 운영 DB에 **링 버퍼(용량 기준)** 적용 · 30일 월 파티션 보존은 **중지**  
> **운영 DB (현재):** `fkkrjljeqxpbmazfnync` · 구 `iot-cloud`(`ompufmezugftzoergdbn`) **폐기**  
> **역할:** 보존 정책의 옵션 이력 · **실행 상태는 본 문서 §현재 상태**가 정본  
> 마이그레이션: `supabase/migrations/20261030120000_iot_ring_buffer_slots.sql` · `20261030120100_iot_ring_buffer_finalize.sql`  
> 이전 설계(이력): [`DECODED_ROWCOUNT_PLAN.md`](./DECODED_ROWCOUNT_PLAN.md) · [`IOT_ARCHIVE_AND_THERMO_FLAT.md`](./IOT_ARCHIVE_AND_THERMO_FLAT.md) · 용량: [`DECODED_CAPACITY.md`](./DECODED_CAPACITY.md)

대시보드 읽기는 `latest` 뷰 + trend RPC. 보존은 무료 플랜 **DB 500 MB 상한**(초과 시 read-only)을 넘지 않기 위한 운영 과제.

---

## 전제 (합의 · 유지)

- IoT는 **운영 단일 Supabase 프로젝트** (`fkkrjljeqxpbmazfnync`, Free). 구 `iot-cloud`는 폐기.
- 타 Supabase 프로젝트로 COLD 분리 **금지** (현 단계)
- 물리 테이블을 View로 바꿔 “저장 절약” **금지**
- 대시보드: LIVE=최신 투영 · raw는 앱 읽기 경로 비포함
- 슬롯 크기·개수·브레이크 값 · cron 스케줄 변경은 **명시 승인 후**

---

## 채택안: 링 버퍼 (2026-10-30 적용, 테스트 기간)

기간(30일)이 아니라 **용량**으로 자른다. 오래된 데이터는 행 `DELETE` 없이 슬롯 단위 `TRUNCATE`로 버려서 디스크를 즉시 돌려받는다(dead tuple·VACUUM 부담 없음).

| 항목 | 값 |
|------|----|
| 대상 | `iot_room_state_raw`, `iot_room_state_decoded` |
| 구조 | 두 테이블 모두 `LIST (slot)` 파티션 `_s1` … `_s7` |
| 슬롯 크기 | **50 MB** (raw + decoded, 인덱스 포함) — `iot_ring_state.slot_max_bytes` |
| 쓰기 위치 | `slot` 기본값 = `iot_ring_current_slot()` (활성 슬롯). decode-batch는 raw의 `slot`을 decoded에 그대로 복사 |
| 점검 주기 | pg_cron `iot-ring-rotate-10s` → `iot_ring_rotate()` **10초마다** |
| 링 최대 사용량 | 가득 찬 5칸 + 채우는 1칸 = **약 300 MB** (1칸은 항상 비어 있음) |

### `iot_ring_rotate()` 동작

1. **회전:** 활성 슬롯이 50 MB 이상이면 다음 슬롯으로 넘어간다. 이때 **넘어갈 슬롯과 그 다음 슬롯을 TRUNCATE**해서 쓰는 슬롯 앞 칸이 항상 비어 있게 한다.
   - 예: 활성 2 → 3으로 이동하며 3·4를 비움
2. **2차 브레이크:** `pg_database_size` > **450 MB** (`db_brake_bytes`)이면 활성 슬롯을 제외하고 **가장 오래된 비어 있지 않은 슬롯**을 TRUNCATE한다. 한 번에 1칸씩 비우고 10초 뒤 다시 확인한다. 링 바깥 테이블이 커지는 경우를 대비한 장치다.
3. TRUNCATE가 조회와 겹치면 `lock_timeout` 3초 후 포기하고 다음 주기에 다시 시도한다.
4. 회전·브레이크는 모두 `iot_ring_event`에 기록된다.

### pg_cron (운영 · 2026-10-30)

| jobname | schedule | command |
|---------|----------|---------|
| `iot-ring-rotate-10s` | `10 seconds` | `iot_ring_rotate()` |
| `cleanup-ops-logs-2d-daily` | `50 18 * * *` (03:50 KST) | `cleanup_ops_logs_7d(2, 10000)` — pg_net/pg_cron 실행 로그 **2일** 보관 |

중지·삭제: `cleanup-iot-retention-30d-daily`, `ensure-iot-decoded-partitions-daily`, `cleanup-iot-archive-drop-daily`, `cleanup-ops-logs-7d-daily` 및 앞의 세 함수(월 파티션 전용이라 슬롯 테이블에서 동작하지 않음).

> 적용 직후 `iot-ring-rotate-10s`가 실행되지 않아 `cron.alter_job(<jobid>, schedule := '10 seconds', active := true)`로 다시 활성화했다. 새로 적용하는 환경에서는 `cron.job_run_details`에 실행 기록이 쌓이는지 확인할 것.

### 대시보드 영향

- LIVE latest: **영향 없음** (뷰 3개를 운영 정의 그대로 재생성)
- `farm_trend_history*`: 링에 남은 기간만 조회 가능. 보관 기간은 고정이 아니라 **유입량에 따라 달라짐**
- 기존 FK(`decode_failed`, `farm_module_alarm`, decoded → raw)는 제거됨. 파티션 PK가 `(id, slot)`이라 `raw_id` 단독 참조가 불가하고, 슬롯 TRUNCATE와도 맞지 않음

### 확인 쿼리

```sql
-- DB 사용량 (500 MB 대비)
select pg_size_pretty(pg_database_size(current_database())),
       round(pg_database_size(current_database()) / (500.0*1024*1024) * 100, 1) as pct;

-- 활성 슬롯과 슬롯별 크기
select active_slot from public.iot_ring_state;
select s, pg_size_pretty(public.iot_ring_slot_bytes(s::smallint)) from generate_series(1, 7) s;

-- 회전·브레이크 기록
select * from public.iot_ring_event order by id desc limit 20;
```

### 적용 기록 (2026-10-30)

| 단계 | 내용 |
|------|------|
| 백업 | git tag `backup/pre-ring-20261030` · `pg_dump -Fc` 전체 덤프(로컬 보관, 저장소 비포함) |
| 1. slots | 기존 데이터를 슬롯 1로 복사, 옛 테이블은 `*_pre_ring`으로 보존. 첫 회전 1 → 2 |
| 2. finalize | 남은 행 0건 확인 후 `*_pre_ring` 삭제. DB **305 MB → 150 MB** |
| 롤백 | finalize 이후에는 덤프 복원만 가능 |

---

## 이전 정책 (2026-08-05 ~ 2026-10-29 · 중지)

| 층 | 동작 |
|----|------|
| **D1 파티션** | `iot_room_state_decoded` `RANGE (mesure_at)` 월 단위 |
| **Retention** | 월 상한 ≤ now−30d 파티션 → detach → `archive.*_archived` + raw `received_at` 30일 초과 batch DELETE |
| **Archive soak DROP** | archive 월 종료 ≤ now−60d → DROP |
| **월 파티션 예비** | 익월 등 자동 생성 |
| **ops 로그** | `net._http_response` · `cron.job_run_details` 7일 초과 DELETE |

중지 사유: 운영 DB에 배포된 `cleanup_iot_retention_30d`의 파티션 경계 정규식이 맞지 않아 detach가 한 번도 실행되지 않았다. 또한 기간 기준이라 유입이 늘면 500 MB 상한을 보장하지 못한다.

구 `iot-cloud` 적용 기록 (2026-08-28): HTTP **481 MB → 3.4 MB**, cron 기록 **340 MB → 37 MB**, DB **1,171 MB → 391 MB**.

---

## 옵션 비교 (이력 · 참고)

| 옵션 | 내용 | 현 상태 |
| --- | --- | --- |
| **A. 관측만** | 디스크·행 수 모니터링 | 확인 쿼리로 병행 |
| **B. 30일 롤링 DELETE** | 행 단위 삭제 | 중지 (dead tuple·VACUUM 부담) |
| **C. archive** | detach 후 archive 스키마 | 중지 |
| **D. 월 파티션** | 월 RANGE | 링 슬롯 파티션으로 **대체** |
| **E. multi-DB COLD** | 타 프로젝트 | **채택 안 함** |
| **F. 링 버퍼** | 용량 기준 슬롯 TRUNCATE | **적용 (2026-10-30)** |

---

## 승인 전 체크리스트 (추가 변경 시)

슬롯 크기·개수·브레이크·cron을 **다시 바꿀 때**만:

- [ ] 변경 값과 링 최대 사용량(가득 찬 칸 × 슬롯 크기) 계산
- [ ] 링 바깥 사용량과 합쳐 500 MB 미만인지
- [ ] LIVE · trend 스모크
- [ ] 롤백: `iot-ring-rotate-10s` `active=false`
- [ ] 사용자 명시 승인

---

## 현재 상태 (2026-10-30)

| 항목 | 상태 |
| --- | --- |
| 정책 | 링 버퍼 7슬롯 × 50 MB · 450 MB 브레이크 · ops 로그 **2일** |
| SQL / 함수 / cron | **적용·active** (`iot-ring-rotate-10s`, `cleanup-ops-logs-2d-daily`) |
| DB 사용량 | finalize 직후 **150 MB** (30%) |
| 희소(D3) | PoC off ([`SPARSE_OBSERVATION.md`](./SPARSE_OBSERVATION.md)) |
| 문서 | 본 문서 = retention **정본** |

관련: [`LIVE_HOT_VIEW_RULES.md`](./LIVE_HOT_VIEW_RULES.md) · [`PERF_BASELINE.md`](./PERF_BASELINE.md) · [`PROJECT_CONTEXT.md`](./PROJECT_CONTEXT.md)
