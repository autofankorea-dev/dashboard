# 출고 품질 체크리스트 (단일 농장)

출고 직전 **깨지면 출고 불가**인 경로만 짧게 확인한다. 전수 UI 검수가 아니다.  
전수 체계: [`QA_PRE_RELEASE.md`](./QA_PRE_RELEASE.md) · **출고 실행 축소판**: [`QA_SHIP_GATE.md`](./QA_SHIP_GATE.md).

## 전제

| 항목 | 값 |
| --- | --- |
| 앱 | `cd dashboard/web && npm run dev` → `http://localhost:3000` |
| LIVE | FARM01 / P00 시뮬 uplink 가동 |
| 구성 | 임신사 1ctrl(A·팬2) · 분만사 6ctrl(A+B) · 자돈사 6ctrl(A+B) |

### 테스트 계정

| 역할 | 이메일 | 비밀번호 |
| --- | --- | --- |
| admin | `admin@test.com` | `admin1` |
| operator | `farmer@test.com` | `farmer` |
| viewer | `viewer@test.com` | `viewer` |

## 공통

- [x] 로그인 → `/farm` 진입, FARM01 LIVE(임신/분만/자돈) 표시 — `audit:ship-checklist` · `scripts/archive/ship-p0-gate-smoke` (2026-07-28)
- [x] 빈 SP·위치만 농장이 제품 화면에 이질감 없이 처리 — LIVE SP만 표시·위치만 뱃지 (제품화 반영)
- [x] DevTools / Next 이슈 배지에 **hydration mismatch 없음** — Playwright Chromium cold load + 테마 토글 (`scripts/archive/ship-p0-gate-smoke`, 2026-07-24)

## admin

- [x] `/farm` 허브: LIVE 그리드만 (위치만 농장 숨김/안내) — `audit:ship-checklist` (2026-07-24)
- [x] Farm switcher: `LIVE` / `위치만` 뱃지 (해당 시) — 제품화 반영
- [x] 헤더 **도구 → 운영** → `/admin/ops` 시스템·사용자·농장 탭 로드 — `audit:ship-checklist` (2026-07-28)
- [x] 레거시 `/admin/health/farm/:slug` → `/admin/ops?farm=…&modules=1` (proxy middleware, `--`·`:` slug 모두) — curl 307 (2026-07-27)
- [x] 테마·모바일 미리보기 토글 동작, hydration 경고 없음 — `scripts/archive/ship-p0-gate-smoke` 테마 (2026-07-24)

## operator

- [x] 필드 **설정** 탭에서 설정온도 변경 → **적용** 활성 → 전송 — `audit:ship-checklist` (목록 `view=list` 아코디언은 현장 병합 후 기본 경로 아님)
- [x] ACK → 현장 반영 완료(또는 동등 피드백) 체감 — `명령 등록 · 전송 대기` (2026-07-24)
- [x] 일괄 적용 UI 진입(선택·설정) 가능 — 수동 시나리오 1·5·6 (2026-07-24)
- [x] `/admin/ops` 등 운영 경로 차단 또는 `/farm`으로 복귀 — `audit:ship-checklist` (2026-07-24)

## viewer

- [x] 설정 패널 **조회 전용** 배너 — `audit:ship-checklist` (2026-07-24)
- [x] 적용/기본값 없음, 슬라이더·알람 잠금 — `audit:ship-checklist` (2026-07-24)
- [x] 일괄적용 없음 · 운영 메뉴 없음 — `audit:ship-checklist` (2026-07-24)
- [x] `/admin/ops` → `/farm` (또는 동등 차단) — `audit:ship-checklist` (2026-07-24)
- [x] 명령이 실제로 나가지 않음 — `audit:ship-checklist` (2026-07-24)

## 자동화

```bash
# dev 서버 실행 중
npm run audit:ship-checklist
```

결과는 `scripts/mobile-audit-output/ship-checklist-report.json`에 저장된다.

## 수동 시나리오 (실사용 경로)

자동화(`audit:ship-checklist`)로 막기 어려운 **실사용자 경로**다. Agent/CI가 대신 돌리지 않으며, **로컬 Chrome/Edge에서 담당자가 직접** 수행한다.

### 수동 검수 전제

| 항목 | 값 |
| --- | --- |
| 앱 | `npm run dev` · `http://localhost:3000` |
| LIVE | FARM01 / P00 시뮬 uplink 가동 |
| 계정 | 시나리오 1~6·8 → operator `farmer@test.com` / 시나리오 7 → viewer `viewer@test.com` |
| 도구 | DevTools → **Network** (필요 시 Supabase `thermo_commands` 조회) |
| 판정 | 시나리오별 Pass 기준을 **전부** 충족할 때만 PASS. FAIL만 수정 후보로 올린다 |

**권장 실행 순서:** 7(권한·빠름) → 1 → 5 → 6 → 2 → 3 → 4 → 8(부하)

**증거 수집**

| 수단 | 용도 |
| --- | --- |
| Network 패널 | 적용 POST 중복, LIVE/ops 폴링 정지·폭주 |
| Toast / 적용 진행 | 채널 미매칭 문구, 설정 행 채움·덮개 접수·전송·확인 |
| UI 즉시 값 | 알람 슬라이더·표시값 (맵 알람만 일괄) |
| DB(가능 시) | 적용 연타 시 `thermo_commands` insert 배수 여부 |

### 1. 적용 연타 — 일괄 적용 2~3회 연속

- **역할/화면:** operator · 맵 또는 목록 · 일괄적용 ON
- **절차:** SP 선택 → 설정온도(또는 환기) 변경 → **적용**을 버튼이 잠기기 전에 2~3회 연타
- **관찰:** 적용 중 버튼 disabled · toast 1회 · Network에 control apply POST 중복 없음
- **DB(가능 시):** 동일 setpoint·동일 컨트롤러 묶음 insert가 연타 횟수만큼 배수되지 않음
- **Pass:** 명령 중복 insert 없음 · UI busy 중 재클릭 무효
- **Fail:** 동일 값으로 N배 명령 생성 또는 toast/ACK 이중 표시

### 2. Offline 중 적용 — 전송 중 네트워크 끊김

- **역할/화면:** operator · 단건 설정 또는 일괄 적용 직전
- **절차:** DevTools Offline → 적용 → 에러/실패 피드백 확인 → Online 복귀 → **같은 값으로 재적용**
- **Pass:** 실패 메시지 명확 · UI 영구 busy 아님 · 재시도 시 정상 등록/전송 대기
- **Fail:** 스피너 고착, 재시도 불가, 성공으로 오인

### 3. LIVE 대기 중 화면 이탈

- **역할/화면:** operator · 적용 후 설정 한눈 줄(또는 컨트롤러 덮개)에 채널 단계 표시 중
- **절차:** 큐 유지 상태에서 다른 메뉴로 이동 → `/farm` 맵·목록 재진입
- **Pass:** 큐/트래커 복구 또는 자연 종료 · 유령 busy 없음 · 재진입 후 새 적용 가능
- **Fail:** 큐 고착, 확인 전인데 완료 표시, 이후 적용 불가

### 4. 탭 숨김 후 복귀

- **역할/화면:** operator · LIVE 폴링 중(적용 대기 또는 admin ops health 갱신)
- **절차:** Network 연 채 다른 탭으로 전환(또는 창 최소화로 `document.hidden`) 30~60초 → 폴링 정지 확인 → 탭 복귀
- **Pass:** 숨김 중 LIVE/ops 폴링이 사실상 멈춤 · 복귀 후 tick 재개
- **Fail:** 숨김 중에도 주기 요청 폭주

### 5. 혼합 농장 채널 OFF — 레거시만 전송 + toast

- **역할/화면:** operator · 일괄적용 · 레거시(채널 없음)와 A/B 채널 컨트롤러가 섞인 SP 선택
- **절차:** 특정 채널(예: 채널 B만) 적용 → 실행
- **Pass:** 매칭/레거시만 제어 전송 · toast에 `채널 미매칭 N대 제어 제외 (적용 채널 확인)`
- **Fail:** 미매칭 장비에도 채널 명령 전송, skip 문구 누락·건수 오류

### 6. 맵에서 알람만 일괄

- **역할/화면:** operator · **맵** · 일괄적용 · 제어 OFF · 알람만 ON
- **절차:** 알람 임계값 변경 → 적용 → toast **직후** 맵/상세 알람 슬라이더·표시값 확인
- **Pass:** toast 직후 UI가 적용값과 **즉시** 일치 (전체 refresh 대기 불필요)
- **Fail:** toast는 성공인데 슬라이더/표시가 이전 값

### 7. 뷰어 `/admin/ops`

- **역할/화면:** viewer
- **절차:** `/farm`에서 일괄적용·운영 링크 없음 확인 → `/admin/ops` 직접 진입
- **Pass:** 일괄 UI 없음 · ops 리다이렉트(또는 `/farm` 복귀) · 설정 조회 전용
- **Fail:** ops 잔류, 적용/일괄 UI 노출

### 8. 대량 명령(수십 건) — LIVE 폴링 폭주

- **역할/화면:** operator · 분만+자돈 등 다수 컨트롤러 SP 일괄
- **절차:** 적용 후 LIVE 대기 구간 Network를 10~20초 관찰 (동일 LIVE status URL 동시 in-flight)
- **Pass:** 동일 폴링 엔드포인트 **동시 중복 폭주 없음** (한 틱 완료 전 중첩 최소화)
- **Fail:** 동일 요청이 수 개 이상 동시 pending

### 수동 시나리오 결과 기록

| # | 시나리오 | 결과 | 증거/비고 | 일시 |
| --- | --- | --- | --- | --- |
| 1 | 적용 연타 | PASS | Playwright `scripts/archive/manual-scenarios-13562-smoke.mjs` — 연타 후 결과 1회 | 2026-07-24 |
| 2 | Offline 적용 | PASS | Offline 즉시 `적용 실패`·네트워크 문구 → Online 재시도 ACK `명령 등록 · 전송 대기` (오버레이 autoDismiss 전에 검출) | 2026-07-24 |
| 3 | LIVE 중 이탈 | PASS | 배너 중 `/farm` 이탈 후 목록 재진입 · 적용 UI 복구 | 2026-07-24 |
| 4 | 탭 숨김 | PASS | quiet → hide → 1.5s drain 후 신규 poll 0 (`hiddenAfterDrain:0`). #8 maxInFlight 2 | 2026-07-24 |
| 5 | 채널 미매칭 | PASS | farm-scoped LIVE가 `decoded_latest`로 channels[] 포함. B-only → toast `채널 미매칭 1대` · DB `SET_CHANNEL_THERMO`×12 (B/EC02) · SP02 0건 · 시뮬 CMD applied | 2026-07-24 |
| 6 | 알람만 일괄 | PASS | toast + 맵 detail 설정 `온도 알림 하한` DOM 일치 (`targetLow=shownLow=10.5`, `sliderDomOk`) — `ONLY=6 node scripts/archive/manual-scenarios-13562-smoke.mjs` | 2026-07-24 |
| 7 | viewer ops | PASS | ship-checklist 자동화 | 2026-07-24 |
| 8 | 대량 LIVE 폴링 | PASS | `scripts/archive/ship-p0-visibility-poll-smoke.mjs` — maxInFlight 3 (≤4) · pollPosts 50 | 2026-07-24 |

자동화 재실행 (일회성 스모크는 `scripts/archive/`):

```bash
# dev 서버 실행 중
node scripts/archive/manual-scenarios-13562-smoke.mjs
ONLY=6 node scripts/archive/manual-scenarios-13562-smoke.mjs   # #6 슬라이더 DOM만
node scripts/verify-channel-bulk-commands.mjs
node scripts/archive/ship-p0-visibility-poll-smoke.mjs   # #4 · #8
node scripts/archive/ship-p0-gate-smoke.mjs              # P0 hydration·테마·적용·LIVE 축사
npm run audit:ship-checklist                     # 역할 공통 경로
```

결과는 `scripts/mobile-audit-output/` 아래 각 report JSON에 저장된다.

## 결과 기록

| 역할 | 결과 | 비고 |
| --- | --- | --- |
| admin | PASS (2026-07-24) | `audit:ship-checklist` — `/farm` LIVE 3축사 · `/admin/ops` · `scripts/archive/ship-p0-gate-smoke` 테마 |
| operator | PASS (2026-07-24) | ACK `명령 등록 · 전송 대기` · 일괄 시나리오 1~6·8 |
| viewer | PASS (2026-07-24) | `audit:ship-checklist` — 조회 전용 · ops 차단 · 적용 없음 |

### Hydration 참고 (Cursor IDE 브라우저)

출고 판정 시 **일반 Chrome/Edge** 또는 Playwright(`npm run audit:ship-checklist`)를 우선한다.

| 증상 | 원인 | 판정 |
| --- | --- | --- |
| Next 이슈 배지 + diff에만 `data-cursor-ref` | Cursor IDE 브라우저가 a11y 스냅샷용 속성을 DOM에 주입 | **앱 버그 아님** — 무시 |
| 하드 네비게이션 직후(상호작용 전) 배지 + `theme-toggle` / `viewport` / `Label` | 실제 SSR·클라이언트 불일치 가능 | **조사 대상** |
| 로그인 fill 직후에만 배지 등장 | 스냅샷 주입 타이밍과 겹침 | 대개 노이즈 |

앱 측 예방: viewport store는 모듈 로드 시 `localStorage`/`matchMedia`를 읽지 않음. 테마 토글은 mount 후 DOM 동기화.

FAIL만 후속 수정 후보로 올린다.

## 관련

- 성능 기준: [`PERF_BASELINE.md`](./PERF_BASELINE.md)
- LIVE 측정: `npm run measure:live`
