# dashboard/web/docs — 문서 유일 위치

> **앱(제품) 문서는 전부 이 폴더에만 둔다.**  
> `web/` 루트·`scripts/`·`dashboard/docs/` 에 md를 새로 만들지 말 것.  
> 배포: `commit → push → main → Vercel` · 규칙: `SI1/.cursor/rules/single-agent.mdc`  
> 코드 반영: **`git status` / `origin/main`이 문서보다 우선**

---

## 목차 (전부)

### 시작 · 배포 · CI

| 문서 | 내용 |
|------|------|
| [`CLOUD_DEPLOY.md`](./CLOUD_DEPLOY.md) | 배포 정본 |
| [`VERCEL_PREVIEW_GATE.md`](./VERCEL_PREVIEW_GATE.md) | push 전 게이트 |
| [`QA_PRE_RELEASE.md`](./QA_PRE_RELEASE.md) | 출고 전 전수 품질 검수 체계(0~14) |
| [`QA_SHIP_GATE.md`](./QA_SHIP_GATE.md) | 출고마다·메이저·분기 실행 축소판 |
| [`SHIP_CHECKLIST.md`](./SHIP_CHECKLIST.md) | 출고 스모크 |
| [`GITLAB_CI.md`](./GITLAB_CI.md) | GitLab / GitHub Actions |
| [`SCRIPTS.md`](./SCRIPTS.md) | npm test · verify · 스모크 스크립트 |
| [`mobile-ui-audit.md`](./mobile-ui-audit.md) | 모바일 UI audit |
| [`PERF_BASELINE.md`](./PERF_BASELINE.md) | LIVE/TTFB |
| [`LIVE_HOT_VIEW_RULES.md`](./LIVE_HOT_VIEW_RULES.md) | HOT list 뷰 thin 규칙·PR 체크리스트 |
| [`IOT_RETENTION_OPTIONS.md`](./IOT_RETENTION_OPTIONS.md) | 보존(retention) **채택·cron 적용 현황** (정본) |
| [`RAW_STORAGE_CHANGE.md`](./RAW_STORAGE_CHANGE.md) | raw passthrough 축소 Phase 1~4 · 용량 실측 |
| [`DECODED_CAPACITY.md`](./DECODED_CAPACITY.md) | decoded 용량·인덱스 실측 · D0~D4 트랙 |
| [`DECODED_ROWCOUNT_PLAN.md`](./DECODED_ROWCOUNT_PLAN.md) | 행 수: 파티션 + retention (D1·D4) · **희소 PoC OFF 2026-09-01** |
| [`SPARSE_OBSERVATION.md`](./SPARSE_OBSERVATION.md) | 희소 관측 기록 · **현재 `sparse_enabled=false`** |
| [`HUB_STABILITY_P0.md`](./HUB_STABILITY_P0.md) | 허브 안정화 P0 게이트·체크리스트 |
| [`WORKSPACE_NOTES.md`](./WORKSPACE_NOTES.md) | 운영 메모(스냅샷) |
| [`incidents/20260917-rs-supabase-outage.md`](./incidents/20260917-rs-supabase-outage.md) | RS Supabase timeout 수집 공백 · durable Outbox 재발 방지 작업 |
| [`PROJECT_CONTEXT.md`](./PROJECT_CONTEXT.md) | 작업 맥락·스키마 참고 |
| [`SYSTEM.md`](./SYSTEM.md) | 인스턴스·DB·Next.js 시스템 정본 ([DB](./SYSTEM_DB.md) · [Instance](./SYSTEM_INSTANCE.md) · [Next.js](./SYSTEM_NEXTJS.md) · [런북](./SYSTEM_RUNBOOK.md)) |
| [`HOME_SIM_PILOT.md`](./HOME_SIM_PILOT.md) | 집 PC FARM01 LIVE 시뮬 (`sim_pilot_farm01.py`) |
| [`android-push.md`](./android-push.md) | Android Capacitor + FCM 푸시 1차 |

### 프로토콜 · 데이터폼

| 문서 | 내용 |
|------|------|
| [`protocol/README.md`](./protocol/README.md) | 데이터폼·개선안 인덱스 (레포 루트에서 이 폴더로 이동) |

### 허브 · DELIN · 디자인

| 문서 | 내용 |
|------|------|
| [`farm-hub-url.md`](./farm-hub-url.md) | `/farm` URL·탭·epoch |
| [`aria-protocol.md`](./aria-protocol.md) | 델린(DELIN) 뱃지 정본 |
| [`UI_MOTION.md`](./UI_MOTION.md) | 모션 |
| [`UI_DENSITY.md`](./UI_DENSITY.md) | 밀도·맵 수치 |
| [`UI_ELEVATION.md`](./UI_ELEVATION.md) | elevation |
| [`UI_CHROMA.md`](./UI_CHROMA.md) | 채도 |
| [`UI_SURFACES.md`](./UI_SURFACES.md) | 면 종류(A–H) · Glass 전 분류 |
| [`UI_AFFORDANCE.md`](./UI_AFFORDANCE.md) | 버튼·표시·히트 계약 (명령/도구/선택군/칩/히트면/잉크) |
| [`UI_FEEDBACK.md`](./UI_FEEDBACK.md) | ops-feedback |
| [`UI_ARIA_PRESENCE.md`](./UI_ARIA_PRESENCE.md) | DELIN 뱃지 presence |
| [`UI_VISUAL_QA.md`](./UI_VISUAL_QA.md) | 시각 QA |
| [`UI_DARK_VISIBILITY.md`](./UI_DARK_VISIBILITY.md) | 다크모드 가시성 현황·P0–P6 적용 |

### 운영자 매뉴얼

| 문서 | 내용 |
|------|------|
| [`user-manual/README.md`](./user-manual/README.md) | 목차 |
| [`user-manual/`](./user-manual/) | 00–12 절 + images |

스크린샷 추가 예정: `user-manual/images/11-farm-chart.png`, `12-farm-aria.png`.

---

## 이 폴더 밖에 두는 것 (문서 아님)

| 경로 | 이유 |
|------|------|
| `web/README.md` | npm/GitHub용 3줄 실행 안내 → 여기로 링크 |
| `web/AGENTS.md` · `CLAUDE.md` | 에디터 도구용 포인터만 |
| `web/src/**/*.test.ts` | 유닛 테스트 (문서가 아님 · `npm test`) |
| `web/scripts/` | verify·audit·measure 스크립트 ([`SCRIPTS.md`](./SCRIPTS.md)) |
| `Operation/docs` | 파이프라인·펌웨어 (별 영역) |

## 문서 · 테스트 · 참고 배치

| 종류 | 위치 |
|------|------|
| 제품·배포·시스템·UI | **`web/docs/`** (본 README 목차) |
| 프로토콜·데이터폼 | **`web/docs/protocol/`** |
| 운영자 매뉴얼 | **`web/docs/user-manual/`** |
| 유닛 테스트 | `web/src/**/*.test.ts` · `web/supabase/functions/**/*.test.ts` |
| 게이트·스모크 | `web/scripts/` · [`SCRIPTS.md`](./SCRIPTS.md) · [`VERCEL_PREVIEW_GATE.md`](./VERCEL_PREVIEW_GATE.md) |

```bash
cd dashboard/web
npm test && npm run verify:design && npm run build
```