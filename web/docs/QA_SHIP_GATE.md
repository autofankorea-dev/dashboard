# 출고 게이트 축소판 (프로필)

> 출고 때 **실제로 돌리는 짧은 게이트**. 전수 정의·태그 정본은 [`QA_RECORD.md`](./QA_RECORD.md).  
> 스모크 실행 본체는 [`QA_SHIP_GATE.md`](#출고-스모크).

## 태그 의미

| 태그 | 의미 | 프로필 |
|------|------|--------|
| **필수** | 미충족 시 원칙적으로 `NO-GO` | **출고마다**에 포함 |
| **권장** | 메이저 변경·위험 구간에서 필수화 | **메이저**에 포함 |
| **후속** | 분기·대규모 또는 잔여 개선 | **분기**에 포함 |

마스터(`QA_PRE_RELEASE`) 체크에도 동일 태그가 달려 있다. 이 문서는 **실행 순서와 증적**만 모은다.

---

## 프로필 요약

| 프로필 | 언제 | 판정 최소선 |
|--------|------|-------------|
| **출고마다** | main 배포·고객 전달 직전 | P0/P1 = 0 · 아래 필수 전부 전부 PASS |
| **메이저** | 제어·권한·데이터 파이프·허브 구조 변경 | 출고마다 + 권장 묶음 |
| **분기** | 분기 품질·대규모 리팩터·용량 확대 | 메이저 + 후속 묶음 |

---

## 출고마다 (필수)

체크 전 고정: Git commit SHA · 대상 URL(prod/preview) · 시뮬 LIVE(FARM01) · 검수자·일자.

### A. 범위·정적 (0 · 2)

- [ ] **필수** 출고 범위(포함/제외)·commit이 고정됨 — [`QA_PRE_RELEASE`](./QA_RECORD.md) 0단계
- [ ] **필수** `npm run lint` 오류 0
- [ ] **필수** `npx tsc --noEmit` (또는 프로젝트 typecheck) 오류 0
- [ ] **필수** `npm run build` 성공
- [ ] **필수** 비밀키·테스트 계정 하드코딩 없음 (코드 리뷰/검색)

### B. 스모크 · 권한 (3 · 11 · SHIP)

- [ ] **필수** [`QA_SHIP_GATE.md`](#출고-스모크) — `npm run audit:ship-checklist` + 역할별 핵심 수동 항목
- [ ] **필수** admin / operator / viewer 권한·메뉴·명령 차단이 서버까지 일치
- [ ] **필수** URL·API 직접 호출로 타 농장·운영 경로 우회 불가

### C. 데이터 표본 (4)

표본: LIVE 컨트롤러 1대 이상. 원시(시뮬/DB) → API/화면 값·단위·시각 대조.

- [ ] **필수** 온도·습도·모터(%) 최신값이 원시/저장과 일치
- [ ] **필수** 실제 `0` / 데이터 없음 / 수신 지연·단절 UI가 구분됨
- [ ] **필수** 장비 ID가 올바른 농장·축사·컨트롤러에 연결됨

### D. 명령 추적 (5)

operator 계정 · 설정온도 또는 일괄 적용 1회.

- [ ] **필수** 명령에 대상 장비·상태가 추적됨 (전송→대기→성공/실패)
- [ ] **필수** 중복 클릭으로 의도치 않은 중복 실행이 없음
- [ ] **필수** 실패·타임아웃을 성공으로 표시하지 않음
- [ ] **필수** 무권한(viewer)에서 명령이 실제로 나가지 않음

### E. 제거된 DELIN (옛 `view=aria`)

- [ ] **필수** 옛 `view=aria` 주소는 필드로 열린다
- [ ] **필수** 그 화면에 DELIN 뱃지와 권장 온·습 안내가 없다 ([`farm-hub-url.md`](./farm-hub-url.md#환경-상태-정책))
- [ ] **필수** 환경 상태 문구가 그 정책과 같다

### F. Android 배포 가능 (7 · 12)

증적: `/app` 접속 · 버전 표시 · 다운로드 가능 여부. 상세 [`ANDROID.md`](./ANDROID.md#설치).

- [ ] **필수** `https://smart.autofankorea.com/app` (또는 이번 출고 URL) 설치 페이지 동작
- [ ] **필수** APK 다운로드(비밀번호·signed URL) 성공 · 객체/버전이 **이번 출고와 맞음**
- [ ] **필수** 업로드된 APK가 최신 release 빌드임 (빌드일·`APP_APK_VERSION` 확인)
- [ ] **필수** 설치 후 로그인·푸시 권한 안내가 가능한 수준으로 동작 ([`ANDROID.md`](./ANDROID.md#푸시) 요약)

### G. 최종 (14)

- [ ] **필수** P0 = 0 · P1 = 0
- [ ] **필수** 잔여 P2에 영향·우회·담당·기한 기록
- [ ] **필수** 판정: `GO` / `CONDITIONAL GO` / `NO-GO` + 승인자

**출고마다 최소 명령 예시**

```bash
cd dashboard/web
npm run lint
npm run build
# dev + LIVE 시뮬 후
npm run audit:ship-checklist
```

---

## 메이저 (+권장)

출고마다 전부 PASS 후 추가.

- [ ] **권장** 경계·경쟁(늦은 응답·화면 이탈) 표본 — 마스터 3단계
- [ ] **권장** 비정상 데이터(누락·역순·지연) 주입 1세트 — 4단계
- [ ] **권장** 단절·재연결 후 중복 구독/값 후퇴 없음 — 5·10단계
- [ ] **권장** 배포 smoke · 롤백 절차 확인 — [`OPS.md`](./OPS.md#배포) · 12단계
- [ ] **권장** 모션 토큰·reduced-motion — `npm run verify:motion-tokens` / [`UI.md`](./UI.md#모션)
- [ ] **권장** 허브 keep-alive·URL — `npm run verify:hub` / [`farm-hub-url.md`](./farm-hub-url.md#허브-본체-안정화--p0-관측·재현-게이트)
- [ ] **권장** 성능 스냅샷 — [`QA_RECORD.md`](./QA_RECORD.md)

---

## 분기 (+후속)

메이저 전부 검토 후 추가.

- [ ] **후속** 접근성·배율·브라우저 매트릭스 전수 — 7단계
- [ ] **후속** 부하·8h/24h 장시간 — 9단계
- [ ] **후속** 백업 복원 실시험 · RPO/RTO — 12단계
- [ ] **후속** 제3자 문서만 재현 · RTM 100% — 1·13단계
- [ ] **후속** 의존성 취약점 전수 조치 주기 점검 — 2·11단계

---

## 판정 기록 (출고마다 복사)

| 항목 | 값 |
|------|-----|
| 일자 | 2026-08-28 |
| Commit | `d35e7db` (`origin/main`, Vercel Production) |
| URL | `https://smart.autofankorea.com` |
| 프로필 | 메이저 → **제품 패키징 종료** |
| 판정 | **GO** |
| P0 / P1 / P2 | P0=0 · P1=0 · P2 잔여(0/없음/단절 한 화면 표본, 권장 race·단절 재현 등)는 수용 |
| 차단 사유 | 없음. FARM01 MQTT 시뮬 종료. 사용자 유입은 도메인, 권한부여·모니터링은 ADMIN. |
| 승인자 | 사용자 (본 출고 대화) |

결함 상세 양식은 마스터 [`QA_RECORD.md`](./QA_RECORD.md) «검수 결함 기록 양식»을 사용한다.

---

## 출고 스모크

## 출고 품질 체크리스트 (단일 농장)

출고 직전 **깨지면 출고 불가**인 경로만 짧게 확인한다. 전수 UI 검수가 아니다.  
전수 체계: [`QA_RECORD.md`](./QA_RECORD.md) · **출고 실행 축소판**: [`QA_SHIP_GATE.md`](./QA_SHIP_GATE.md).

### 전제

| 항목 | 값 |
| --- | --- |
| 앱 | `cd dashboard/web && npm run dev` → `http://localhost:3000` |
| LIVE | FARM01 / P00 시뮬 uplink 가동 |
| 구성 | 임신사 1ctrl(A·팬2) · 분만사 6ctrl(A+B) · 자돈사 6ctrl(A+B) |

#### 테스트 계정

| 역할 | 이메일 | 비밀번호 |
| --- | --- | --- |
| admin | `admin@test.com` | `admin1` |
| operator | `farmer@test.com` | `farmer` |
| viewer | `viewer@test.com` | `viewer` |

### 공통

- [x] 로그인 → `/farm` 진입, FARM01 LIVE(임신/분만/자돈) 표시 — `audit:ship-checklist` (2026-07-28)
- [x] 빈 SP·위치만 농장이 제품 화면에 이질감 없이 처리 — LIVE SP만 표시·위치만 뱃지 (제품화 반영)
- [x] DevTools / Next 이슈 배지에 **hydration mismatch 없음** — Playwright Chromium cold load + 테마 토글 (2026-07-24)

### admin

- [x] `/farm` 허브: LIVE 그리드만 (위치만 농장 숨김/안내) — `audit:ship-checklist` (2026-07-24)
- [x] Farm switcher: `LIVE` / `위치만` 뱃지 (해당 시) — 제품화 반영
- [x] 헤더 **도구 → 운영** → `/admin/ops` 시스템·사용자·농장 탭 로드 — `audit:ship-checklist` (2026-07-28)
- [x] 레거시 `/admin/health/farm/:slug` → `/admin/ops?farm=…&modules=1` (proxy middleware, `--`·`:` slug 모두) — curl 307 (2026-07-27)
- [x] 테마·모바일 미리보기 토글 동작, hydration 경고 없음 (2026-07-24)

### operator

- [x] 필드 **설정** 탭에서 설정온도 변경 → **적용** 활성 → 전송 — `audit:ship-checklist` (목록 `view=list` 아코디언은 현장 병합 후 기본 경로 아님)
- [x] ACK → 현장 반영 완료(또는 동등 피드백) 체감 — `명령 등록 · 전송 대기` (2026-07-24)
- [x] 일괄 적용 UI 진입(선택·설정) 가능 — 수동 시나리오 1·5·6 (2026-07-24)
- [x] `/admin/ops` 등 운영 경로 차단 또는 `/farm`으로 복귀 — `audit:ship-checklist` (2026-07-24)

### viewer

- [x] 설정 패널 **조회 전용** 배너 — `audit:ship-checklist` (2026-07-24)
- [x] 적용/기본값 없음, 슬라이더·알람 잠금 — `audit:ship-checklist` (2026-07-24)
- [x] 일괄적용 없음 · 운영 메뉴 없음 — `audit:ship-checklist` (2026-07-24)
- [x] `/admin/ops` → `/farm` (또는 동등 차단) — `audit:ship-checklist` (2026-07-24)
- [x] 명령이 실제로 나가지 않음 — `audit:ship-checklist` (2026-07-24)

### 자동화

```bash
# dev 서버 실행 중
npm run audit:ship-checklist
node scripts/ship-gate-ce-smoke.mjs
```

`audit:ship-checklist` 결과는 `scripts/mobile-audit-output/ship-checklist-report.json`에 저장된다. `ship-gate-ce-smoke.mjs`는 목록 LIVE 표본과, 제거된 DELIN 배지가 옛 `view=aria` 주소에 없는지를 본다.

### 수동 시나리오 (실사용 경로)

자동화(`audit:ship-checklist`)로 막기 어려운 **실사용자 경로**다. Agent/CI가 대신 돌리지 않으며, **로컬 Chrome/Edge에서 담당자가 직접** 수행한다.

#### 수동 검수 전제

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

#### 1. 적용 연타 — 일괄 적용 2~3회 연속

- **역할/화면:** operator · 맵 또는 목록 · 일괄적용 ON
- **절차:** SP 선택 → 설정온도(또는 환기) 변경 → **적용**을 버튼이 잠기기 전에 2~3회 연타
- **관찰:** 적용 중 버튼 disabled · toast 1회 · Network에 control apply POST 중복 없음
- **DB(가능 시):** 동일 setpoint·동일 컨트롤러 묶음 insert가 연타 횟수만큼 배수되지 않음
- **Pass:** 명령 중복 insert 없음 · UI busy 중 재클릭 무효
- **Fail:** 동일 값으로 N배 명령 생성 또는 toast/ACK 이중 표시

#### 2. Offline 중 적용 — 전송 중 네트워크 끊김

- **역할/화면:** operator · 단건 설정 또는 일괄 적용 직전
- **절차:** DevTools Offline → 적용 → 에러/실패 피드백 확인 → Online 복귀 → **같은 값으로 재적용**
- **Pass:** 실패 메시지 명확 · UI 영구 busy 아님 · 재시도 시 정상 등록/전송 대기
- **Fail:** 스피너 고착, 재시도 불가, 성공으로 오인

#### 3. LIVE 대기 중 화면 이탈

- **역할/화면:** operator · 적용 후 설정 한눈 줄(또는 컨트롤러 덮개)에 채널 단계 표시 중
- **절차:** 큐 유지 상태에서 다른 메뉴로 이동 → `/farm` 맵·목록 재진입
- **Pass:** 큐/트래커 복구 또는 자연 종료 · 유령 busy 없음 · 재진입 후 새 적용 가능
- **Fail:** 큐 고착, 확인 전인데 완료 표시, 이후 적용 불가

#### 4. 탭 숨김 후 복귀

- **역할/화면:** operator · LIVE 폴링 중(적용 대기 또는 admin ops health 갱신)
- **절차:** Network 연 채 다른 탭으로 전환(또는 창 최소화로 `document.hidden`) 30~60초 → 폴링 정지 확인 → 탭 복귀
- **Pass:** 숨김 중 LIVE/ops 폴링이 사실상 멈춤 · 복귀 후 tick 재개
- **Fail:** 숨김 중에도 주기 요청 폭주

#### 5. 혼합 농장 채널 OFF — 레거시만 전송 + toast

- **역할/화면:** operator · 일괄적용 · 레거시(채널 없음)와 A/B 채널 컨트롤러가 섞인 SP 선택
- **절차:** 특정 채널(예: 채널 B만) 적용 → 실행
- **Pass:** 매칭/레거시만 제어 전송 · toast에 `채널 미매칭 N대 제어 제외 (적용 채널 확인)`
- **Fail:** 미매칭 장비에도 채널 명령 전송, skip 문구 누락·건수 오류

#### 6. 맵에서 알람만 일괄

- **역할/화면:** operator · **맵** · 일괄적용 · 제어 OFF · 알람만 ON
- **절차:** 알람 임계값 변경 → 적용 → toast **직후** 맵/상세 알람 슬라이더·표시값 확인
- **Pass:** toast 직후 UI가 적용값과 **즉시** 일치 (전체 refresh 대기 불필요)
- **Fail:** toast는 성공인데 슬라이더/표시가 이전 값

#### 7. 뷰어 `/admin/ops`

- **역할/화면:** viewer
- **절차:** `/farm`에서 일괄적용·운영 링크 없음 확인 → `/admin/ops` 직접 진입
- **Pass:** 일괄 UI 없음 · ops 리다이렉트(또는 `/farm` 복귀) · 설정 조회 전용
- **Fail:** ops 잔류, 적용/일괄 UI 노출

#### 8. 대량 명령(수십 건) — LIVE 폴링 폭주

- **역할/화면:** operator · 분만+자돈 등 다수 컨트롤러 SP 일괄
- **절차:** 적용 후 LIVE 대기 구간 Network를 10~20초 관찰 (동일 LIVE status URL 동시 in-flight)
- **Pass:** 동일 폴링 엔드포인트 **동시 중복 폭주 없음** (한 틱 완료 전 중첩 최소화)
- **Fail:** 동일 요청이 수 개 이상 동시 pending

#### 수동 시나리오 결과 기록

| # | 시나리오 | 결과 | 증거/비고 | 일시 |
| --- | --- | --- | --- | --- |
| 1 | 적용 연타 | PASS | 연타 후 결과 1회 | 2026-07-24 |
| 2 | Offline 적용 | PASS | Offline 즉시 `적용 실패`·네트워크 문구 → Online 재시도 ACK `명령 등록 · 전송 대기` (오버레이 autoDismiss 전에 검출) | 2026-07-24 |
| 3 | LIVE 중 이탈 | PASS | 배너 중 `/farm` 이탈 후 목록 재진입 · 적용 UI 복구 | 2026-07-24 |
| 4 | 탭 숨김 | PASS | quiet → hide → 1.5s drain 후 신규 poll 0 (`hiddenAfterDrain:0`). #8 maxInFlight 2 | 2026-07-24 |
| 5 | 채널 미매칭 | PASS | farm-scoped LIVE가 `decoded_latest`로 channels[] 포함. B-only → toast `채널 미매칭 1대` · DB `SET_CHANNEL_THERMO`×12 (B/EC02) · SP02 0건 · 시뮬 CMD applied | 2026-07-24 |
| 6 | 알람만 일괄 | PASS | toast + 맵 detail 설정 `온도 알림 하한` DOM 일치 (`targetLow=shownLow=10.5`, `sliderDomOk`) | 2026-07-24 |
| 7 | viewer ops | PASS | ship-checklist 자동화 | 2026-07-24 |
| 8 | 대량 LIVE 폴링 | PASS | maxInFlight 3 (≤4) · pollPosts 50 | 2026-07-24 |

자동화 재실행:

```bash
# dev 서버 실행 중
node scripts/verify-channel-bulk-commands.mjs
node scripts/ship-gate-ce-smoke.mjs
npm run audit:ship-checklist                     # 역할 공통 경로
```

결과는 `scripts/mobile-audit-output/` 아래 각 report JSON에 저장된다.

### 결과 기록

| 역할 | 결과 | 비고 |
| --- | --- | --- |
| admin | PASS (2026-07-24) | `audit:ship-checklist` — `/farm` LIVE 3축사 · `/admin/ops` · 테마 토글 |
| operator | PASS (2026-07-24) | ACK `명령 등록 · 전송 대기` · 일괄 시나리오 1~6·8 |
| viewer | PASS (2026-07-24) | `audit:ship-checklist` — 조회 전용 · ops 차단 · 적용 없음 |

#### Hydration 참고 (Cursor IDE 브라우저)

출고 판정 시 **일반 Chrome/Edge** 또는 Playwright(`npm run audit:ship-checklist`)를 우선한다.

| 증상 | 원인 | 판정 |
| --- | --- | --- |
| Next 이슈 배지 + diff에만 `data-cursor-ref` | Cursor IDE 브라우저가 a11y 스냅샷용 속성을 DOM에 주입 | **앱 버그 아님** — 무시 |
| 하드 네비게이션 직후(상호작용 전) 배지 + `theme-toggle` / `viewport` / `Label` | 실제 SSR·클라이언트 불일치 가능 | **조사 대상** |
| 로그인 fill 직후에만 배지 등장 | 스냅샷 주입 타이밍과 겹침 | 대개 노이즈 |

앱 측 예방: viewport store는 모듈 로드 시 `localStorage`/`matchMedia`를 읽지 않음. 테마 토글은 mount 후 DOM 동기화.

FAIL만 후속 수정 후보로 올린다.

### 관련

- 성능 기준: [`QA_RECORD.md`](./QA_RECORD.md)
- LIVE 측정: `npm run measure:live`
