# dashboard/web/docs — 문서 유일 위치

> **앱(제품) 문서는 전부 이 폴더에만 둔다.**  
> `web/` 루트·`scripts/`·`dashboard/docs/` 에 md를 새로 만들지 말 것.  
> 배포: `commit → push → main → Vercel` · 규칙: `SI1/.cursor/rules/single-agent.mdc`  
> 코드 반영: **`git status` / `origin/main`이 문서보다 우선**

목차는 시스템 계층이고, 각 항목은 정본 하나다. 품질만 출고 게이트와 기준·기록으로 나뉜다.

---

## R 수집

| 항목 | 정본 | 내용 |
|------|------|------|
| 인스턴스 | [`SYSTEM_INSTANCE.md`](./SYSTEM_INSTANCE.md) | EC2 · MQTT · RS/C · 로컬 시뮬 · 2026-09-17 수집 공백 원인 |
| 업링크 | [`protocol/데이터폼.md`](./protocol/데이터폼.md) | 정책 전문 · wire `ver=0x0C` |
| 다운링크 | [`COMMANDS.md`](./COMMANDS.md) | `0x0D` · `0x0E` · thermo 이력 · FARM02 ACK |

## S 저장

| 항목 | 정본 | 내용 |
|------|------|------|
| 스키마 | [`SYSTEM_DB.md`](./SYSTEM_DB.md) | 운영 DB · HOT 뷰 §2.3 · 명령 행 보존 §2.8 |
| 보존 | [`IOT_RETENTION_OPTIONS.md`](./IOT_RETENTION_OPTIONS.md) | 30일 채택안 · 행 수 계획 · 희소 쿼리 |
| 용량 기록 | [`STORAGE_LOG.md`](./STORAGE_LOG.md) | decoded·raw·슬림·기타 테이블 실측 |

## C 앱

| 항목 | 정본 | 내용 |
|------|------|------|
| 서버·클라 | [`SYSTEM_APP.md`](./SYSTEM_APP.md) | 코드 계약 · 총론 · Next.js · 작업 맥락 |
| 화면 | [`farm-hub-url.md`](./farm-hub-url.md) | `/farm` URL · 필드 통합 · 환경 상태 · 허브 회귀 |
| UI 토큰 | [`UI.md`](./UI.md) | 면 · 단 · 밀도 · 채도 · 어포던스 · 피드백 · 모션 |
| UI 검증 | [`UI_QA.md`](./UI_QA.md) | 다크 · 시각 QA · 스모크 · 모바일 audit |
| 사용설명서 | [`user-manual/README.md`](./user-manual/README.md) | 00–12. 이미지 `user-manual/images/` |
| Android | [`ANDROID.md`](./ANDROID.md) | 설치 · OAuth · 푸시 |

## 횡단

| 항목 | 정본 | 내용 |
|------|------|------|
| 인수인계 | [`HANDOVER.md`](./HANDOVER.md) | 현장 BLDC·SL802B·SL9001·라우터 · 수집/명령 · 막히면 여는 문서 |
| 배포·장애 | [`OPS.md`](./OPS.md) | 배포 · Preview 게이트 · CI · 스크립트 · 런북 |
| 출고 게이트 | [`QA_SHIP_GATE.md`](./QA_SHIP_GATE.md) | 출고마다·메이저·분기 · 스모크 |
| 출고 기준·기록 | [`QA_RECORD.md`](./QA_RECORD.md) | 전수 체계 · 2026-08-05 실행 · 성능 · 운영 메모 |

---

## 이 폴더 밖에 두는 것 (문서 아님)

| 경로 | 이유 |
|------|------|
| `web/README.md` | npm/GitHub용 실행 안내 → 여기로 링크 |
| `web/AGENTS.md` · `CLAUDE.md` | 에디터 도구용 포인터만 |
| `web/src/**/*.test.ts` | 유닛 테스트 (문서가 아님 · `npm test`) |
| `web/scripts/` | verify·audit·measure 스크립트 ([`OPS.md`](./OPS.md)) |
| `Operation/docs` | 파이프라인·펌웨어 (별 영역) |

## 문서 · 테스트 · 참고 배치

| 종류 | 위치 |
|------|------|
| 제품·배포·시스템·UI | **`web/docs/`** (본 README) |
| 프로토콜·데이터폼 | **`web/docs/protocol/데이터폼.md`** |
| 운영자 매뉴얼 | **`web/docs/user-manual/README.md`** |
| 유닛 테스트 | `web/src/**/*.test.ts` · `web/supabase/functions/**/*.test.ts` |
| 게이트·스모크 | `web/scripts/` · [`OPS.md`](./OPS.md) · [`QA_SHIP_GATE.md`](./QA_SHIP_GATE.md) |

```bash
cd dashboard/web
npm test && npm run verify:design && npm run build
```
