# IoT 보존(Retention) — 채택·적용 현황

> **정합:** 2026-08-28 · 구 `iot-cloud` 실측 cron (ops 로그 7일 추가)  
> **운영 DB (현재):** `fkkrjljeqxpbmazfnync` · 구 `iot-cloud`(`ompufmezugftzoergdbn`) **폐기**  
> **역할:** 보존 정책의 옵션 이력 · **실행 상태는 본 문서 §현재 상태**가 정본  
> 상세 설계·파티션: [`DECODED_ROWCOUNT_PLAN.md`](./DECODED_ROWCOUNT_PLAN.md) · archive DROP: [`IOT_ARCHIVE_AND_THERMO_FLAT.md`](./IOT_ARCHIVE_AND_THERMO_FLAT.md) · 용량: [`DECODED_CAPACITY.md`](./DECODED_CAPACITY.md)

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

함수·마이그레이션: dashboard `supabase/migrations` · 운영 메모 [`IOT_ARCHIVE_AND_THERMO_FLAT.md`](./IOT_ARCHIVE_AND_THERMO_FLAT.md).

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
| 희소(D3) | PoC on · 확대 보류 ([`SPARSE_OBSERVATION.md`](./SPARSE_OBSERVATION.md)) |
| cmd-poll ids 배칭 | 백로그 (보존과 무관) |
| 문서 | 본 문서 = retention **정본** (구 “미실행” 문구 폐기) |

관련: [`LIVE_HOT_VIEW_RULES.md`](./LIVE_HOT_VIEW_RULES.md) · [`PERF_BASELINE.md`](./PERF_BASELINE.md) · [`PROJECT_CONTEXT.md`](./PROJECT_CONTEXT.md)
