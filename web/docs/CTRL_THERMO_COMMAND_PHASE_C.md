# ctrl_thermo_command — Phase C (C1+C2 적용)

> **전제:** Phase B **P1 확정** (2026-08-06)  
> **C1·C2 적용일:** 2026-08-06 (구 `iot-cloud`) · **현재 운영 DB:** `fkkrjljeqxpbmazfnync` (구 프로젝트 폐기)

---

## 1. 목적

- stale `sent` (≥24h) → `cancelled` + 사유 `stale_sent_24h` (소급 + 일 1회)
- HOT `applied`/`cancelled` **90일** 초과 → hard DELETE (배치 + 일 1회)

## 2. C1 적용 결과

| 항목 | 결과 |
|------|------|
| dry-run | 182건 (FARM01 125 / FARM02 57) |
| 함수 | `public.cancel_stale_thermo_sent(age_hours default 24)` SECURITY DEFINER |
| 소급 1회 | `cancelled: 182` |
| 재실행 | `cancelled: 0` (멱등) |
| cron | `cancel-stale-thermo-sent-daily` · `0 19 * * *` UTC · jobid 8 |
| 적용 후 분포 | applied 1828 · cancelled 187 · **sent 0** |
| C.py | `status=eq.pending`만 poll → cancelled 재전송 없음 |

## 3. C2 적용 결과

| 항목 | 결과 |
|------|------|
| dry-run 90d | **0건** (oldest ≈ 2026-07-14) |
| 함수 | `public.cleanup_ctrl_thermo_hot(retention_days default 90, batch_limit default 5000)` |
| 1회 실행 | `deleted: 0` |
| cron | `cleanup-ctrl-thermo-hot-90d-daily` · `15 19 * * *` UTC · jobid 9 |
| FK | `health_command_checkpoint.command_id` **ON DELETE CASCADE** |
| 대상 외 | `pending` / `sent` / `failed` 삭제 안 함 |

## 4. 파일

| 구분 | 경로 |
|------|------|
| C1 migration | `supabase/migrations/20260806110000_ctrl_thermo_cancel_stale_sent.sql` |
| C2 migration | `supabase/migrations/20260806111500_ctrl_thermo_cleanup_hot_90d.sql` |
| 정책 | [`CTRL_THERMO_COMMAND_PHASE_B.md`](./CTRL_THERMO_COMMAND_PHASE_B.md) |

## 5. 영향

| 영역 | 영향 |
|------|------|
| DB | C1 UPDATE · C2 DELETE(HOT만) · RLS 유지 |
| C.py | pending만 조회 · 변경 불필요 |
| UI/Health | cancelled 표시 · 90일 후 HOT 이력 소실(의도) · checkpoint CASCADE |
| Edge | 불필요 |

## 6. 롤백

```sql
SELECT cron.unschedule('cancel-stale-thermo-sent-daily');
SELECT cron.unschedule('cleanup-ctrl-thermo-hot-90d-daily');
-- DROP FUNCTION public.cancel_stale_thermo_sent(integer);
-- DROP FUNCTION public.cleanup_ctrl_thermo_hot(integer, integer);
-- 소급 cancelled / 이미 DELETE된 HOT 행 복구는 비권장
```
