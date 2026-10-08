# UI 스모크 — Health C / 명령 이력 (2026-08-06)

> **환경:** `localhost:3000` (로그인된 관리자 세션) · DB는 당시 구 `iot-cloud`  
> **현재 운영 DB:** `fkkrjljeqxpbmazfnync` · 구 `iot-cloud` **폐기**  
> **Prod URL:** 별도 로그인 미실시 · Vercel이 `main`(`8eb322a`) 배포 후 동일 기대

## 체크 결과

| # | 항목 | 결과 |
|---|------|------|
| 1 | 명령 이력 최상단 | **11:30 · 적용 완료** · `FARM01 · 자돈사 · 축사 01 · 06번 · A` (스모크 `farm01_ops_smoke_20260806`) |
| 2 | 채널 라벨 | 대상에 **· A** 표시 (J6 `formatCommandTarget`) |
| 3 | Health C | DAG **C 명령 · 정상** · `24h 실패 0` · checkpoint 0 |
| 4 | sent stuck | UI상 실패/stuck 없음 (DB sent=0과 정합) |
| 5 | 외부 연계 | **미구현** (EKAPE WAITING과 정합) |
| 6 | FARM02 모듈 | S1 장애(수신 정지) — **HW 테스트용 · 조치 범위 밖** |

## 비고

- 로컬 Next hydration: `HealthRefreshBar` ARIA/title 시계·카운트다운을 마운트 후로 지연 · `formatKst`를 formatToParts 고정 조립으로 맞춤 (2026-08-06)
- Health lane에 raw `channel_key` 문자열(`SP05:01:06|A|EC03`)은 사용자 표시명 대신 정식 명칭 경로를 씀 (의도)
