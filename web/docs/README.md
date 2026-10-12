# dashboard/web/docs — 문서 유일 위치

> **앱(제품) 문서는 전부 이 폴더에만 둔다.**  
> `web/` 루트·`scripts/`·`dashboard/docs/` 에 md를 새로 만들지 말 것.  
> 배포: `commit → push → main → Vercel` · 규칙: `SI1/.cursor/rules/single-agent.mdc`  
> 코드 반영: **`git status` / `origin/main`이 문서보다 우선**

목차 축은 시스템 계층 **R 수집 · S 저장 · C 앱 · 횡단**이다. 이 단계는 문서를 그 계층으로 가리키기만 하고, 본문 통합은 다음 단계다.

---

## R 수집

### 인스턴스

| 문서 | 내용 |
|------|------|
| [`SYSTEM_INSTANCE.md`](./SYSTEM_INSTANCE.md) | EC2 · MQTT · RS/C |
| [`HOME_SIM_PILOT.md`](./HOME_SIM_PILOT.md) | 집 PC FARM01 LIVE 시뮬 |
| [`incidents/20260917-rs-supabase-outage.md`](./incidents/20260917-rs-supabase-outage.md) | 2026-09-17 RS 수집 공백 · 재발 방지 |

### 업링크

| 문서 | 내용 |
|------|------|
| [`protocol/README.md`](./protocol/README.md) | 데이터폼 인덱스 |
| [`protocol/데이터폼_정책문서.md`](./protocol/데이터폼_정책문서.md) | RS-DB-C · topic · cmd/raw 정본 |
| [`protocol/데이터폼_최종안.md`](./protocol/데이터폼_최종안.md) | wire `ver=0x0C` 확정안 |
| [`protocol/프로토콜_개선안_v1.docx`](./protocol/프로토콜_개선안_v1.docx) | 개선안 초안 (바이너리) |

### 다운링크

| 문서 | 내용 |
|------|------|
| [`COMBINED_CHANNEL_COMMAND.md`](./COMBINED_CHANNEL_COMMAND.md) | A/B/C 통합 명령 `v0x0D` |
| [`DEVICE_ALARM_COMMAND.md`](./DEVICE_ALARM_COMMAND.md) | 저온·고온 경보 `0x0E` |
| [`CTRL_THERMO_COMMAND_PHASE_A.md`](./CTRL_THERMO_COMMAND_PHASE_A.md) | thermo 명령 Phase A 관측 |
| [`CTRL_THERMO_COMMAND_PHASE_B.md`](./CTRL_THERMO_COMMAND_PHASE_B.md) | Phase B 정책 확정 |
| [`CTRL_THERMO_COMMAND_PHASE_C.md`](./CTRL_THERMO_COMMAND_PHASE_C.md) | Phase C 적용 결과 |
| [`CTRL_THERMO_KEYS_P0_P1.md`](./CTRL_THERMO_KEYS_P0_P1.md) | 키·인덱스 적용 |
| [`FARM02_ACK_TRIAGE.md`](./FARM02_ACK_TRIAGE.md) | FARM02 ACK 점검 (패치 미실행) |

## S 저장

### 스키마

| 문서 | 내용 |
|------|------|
| [`SYSTEM_DB.md`](./SYSTEM_DB.md) | Supabase 운영 프로젝트 · 테이블 · RLS |
| [`LIVE_HOT_VIEW_RULES.md`](./LIVE_HOT_VIEW_RULES.md) | HOT list 뷰 thin 규칙 |

### 보존

| 문서 | 내용 |
|------|------|
| [`IOT_RETENTION_OPTIONS.md`](./IOT_RETENTION_OPTIONS.md) | 보존 채택·cron **정본** |
| [`DECODED_ROWCOUNT_PLAN.md`](./DECODED_ROWCOUNT_PLAN.md) | 파티션·행 수 계획. 희소 PoC **OFF** 2026-09-01 |
| [`SPARSE_OBSERVATION.md`](./SPARSE_OBSERVATION.md) | 희소 관측 쿼리 · `sparse_enabled=false` |
| [`IOT_ARCHIVE_AND_THERMO_FLAT.md`](./IOT_ARCHIVE_AND_THERMO_FLAT.md) | archive DROP · slim · thermo flat |

### 용량 기록

| 문서 | 내용 |
|------|------|
| [`DECODED_CAPACITY.md`](./DECODED_CAPACITY.md) | decoded 용량 트랙 (구 DB 실측) |
| [`DECODED_JSON_SLIM.md`](./DECODED_JSON_SLIM.md) | decoded_json 슬림 계획·실측 |
| [`RAW_STORAGE_CHANGE.md`](./RAW_STORAGE_CHANGE.md) | raw 저장 방식 변경안 |
| [`OTHER_TABLES_SCAN.md`](./OTHER_TABLES_SCAN.md) | 기타 테이블 용량 스캔 |

## C 앱

### 서버·클라

| 문서 | 내용 |
|------|------|
| [`SYSTEM.md`](./SYSTEM.md) | RS-DB-C 총론 ([DB](./SYSTEM_DB.md) · [Instance](./SYSTEM_INSTANCE.md) · [Next.js](./SYSTEM_NEXTJS.md) · [런북](./SYSTEM_RUNBOOK.md)) |
| [`SYSTEM_NEXTJS.md`](./SYSTEM_NEXTJS.md) | Next.js 서버·클라이언트 경로 |
| [`PROJECT_CONTEXT.md`](./PROJECT_CONTEXT.md) | 작업 맥락·스키마 참고 |
| [`CODE_CONVENTIONS.md`](./CODE_CONVENTIONS.md) | 폴더 책임·레이어·네이밍 (ESLint로 강제) |

### 화면

| 문서 | 내용 |
|------|------|
| [`farm-hub-url.md`](./farm-hub-url.md) | `/farm` URL·탭·epoch |
| [`FARM_FIELD_MERGE_P0.md`](./FARM_FIELD_MERGE_P0.md) | 필드 통합 스플릿 |
| [`ENVIRONMENT_STATUS_POLICY.md`](./ENVIRONMENT_STATUS_POLICY.md) | 장비 경보·통신 상태. DELIN·권장 띠 제거 |
| [`HUB_STABILITY_P0.md`](./HUB_STABILITY_P0.md) | 허브 회귀 게이트 |
| [`aria-protocol.md`](./aria-protocol.md) | 폐기 스텁 → 환경 상태 정책 |
| [`UI_ARIA_PRESENCE.md`](./UI_ARIA_PRESENCE.md) | 폐기 스텁 → 환경 상태 정책 |

### UI 토큰

| 문서 | 내용 |
|------|------|
| [`UI_SURFACES.md`](./UI_SURFACES.md) | 면 종류 |
| [`UI_ELEVATION.md`](./UI_ELEVATION.md) | elevation |
| [`UI_DENSITY.md`](./UI_DENSITY.md) | 밀도 |
| [`UI_CHROMA.md`](./UI_CHROMA.md) | 채도 |
| [`UI_AFFORDANCE.md`](./UI_AFFORDANCE.md) | 버튼·히트 계약 |
| [`UI_FEEDBACK.md`](./UI_FEEDBACK.md) | ops-feedback |
| [`UI_MOTION.md`](./UI_MOTION.md) | 모션 (Phase 1) |

### UI 검증

| 문서 | 내용 |
|------|------|
| [`UI_DARK_VISIBILITY.md`](./UI_DARK_VISIBILITY.md) | 다크모드 가시성 |
| [`UI_VISUAL_QA.md`](./UI_VISUAL_QA.md) | 시각 QA |
| [`UI_SMOKE_HEALTH_COMMANDS_20260806.md`](./UI_SMOKE_HEALTH_COMMANDS_20260806.md) | Health·명령 스모크 기록 |
| [`mobile-ui-audit.md`](./mobile-ui-audit.md) | 모바일 UI audit |

### 사용설명서

| 문서 | 내용 |
|------|------|
| [`user-manual/README.md`](./user-manual/README.md) | 목차 |
| [`user-manual/`](./user-manual/) | 00–12 절 + images |

스크린샷 추가 예정: `user-manual/images/11-farm-chart.png`, `12-farm-aria.png`.

### Android

| 문서 | 내용 |
|------|------|
| [`android-app-install.md`](./android-app-install.md) | `/app` 설치 페이지 |
| [`android-native-oauth.md`](./android-native-oauth.md) | 네이티브 OAuth Phase 1 |
| [`android-push.md`](./android-push.md) | Capacitor + FCM 푸시 1차 |

## 횡단

### 배포

| 문서 | 내용 |
|------|------|
| [`CLOUD_DEPLOY.md`](./CLOUD_DEPLOY.md) | 배포 정본 |
| [`VERCEL_PREVIEW_GATE.md`](./VERCEL_PREVIEW_GATE.md) | push 전 게이트 |
| [`GITLAB_CI.md`](./GITLAB_CI.md) | GitLab / GitHub Actions |
| [`SCRIPTS.md`](./SCRIPTS.md) | npm test · verify · 스모크 |
| [`SYSTEM_RUNBOOK.md`](./SYSTEM_RUNBOOK.md) | 장애 · 배포 · 모니터링 |

### 품질

| 문서 | 내용 |
|------|------|
| [`QA_PRE_RELEASE.md`](./QA_PRE_RELEASE.md) | 출고 전 전수 체계(0~14) |
| [`QA_SHIP_GATE.md`](./QA_SHIP_GATE.md) | 출고마다·메이저·분기 |
| [`SHIP_CHECKLIST.md`](./SHIP_CHECKLIST.md) | 출고 스모크 |
| [`QA_SHIP_RUN_2026-08-05.md`](./QA_SHIP_RUN_2026-08-05.md) | 2026-08-05 실행 기록 |
| [`PERF_BASELINE.md`](./PERF_BASELINE.md) | LIVE/TTFB |
| [`WORKSPACE_NOTES.md`](./WORKSPACE_NOTES.md) | 운영 메모(스냅샷) |

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
