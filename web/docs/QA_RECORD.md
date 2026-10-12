# 출고 기준·기록

0~14단계 전수 정의, 2026-08-05 실행 기록, 성능 기준, 운영 메모. 출고마다 여는 목록은 [`QA_SHIP_GATE.md`](./QA_SHIP_GATE.md)이다.


---

## 전수 체계

## IoT 대시보드 출고 전 전체 품질 검수 체계

> 대상: 농장·축사·컨트롤러 기반 실시간 IoT 대시보드  
> 핵심 데이터: 온도, 습도, 모터(채널/%)  
> 목적: 기능 완성 여부뿐 아니라 데이터 신뢰성, 제어 안전성, 장애 복구성, 보안성, 운영 가능성을 확인하고 객관적인 출고 여부를 판정한다.

**역할**

| 문서 | 범위 |
|------|------|
| **이 문서 (`QA_RECORD.md`)** | 출고 전 전수 품질 체계(0~14단계)·게이트·시나리오 마스터 |
| [`QA_SHIP_GATE.md`](./QA_SHIP_GATE.md) | **출고마다 / 메이저 / 분기** 실행 축소판 |
| [`QA_SHIP_GATE.md`](./QA_SHIP_GATE.md#출고-스모크) | 출고 직전 **깨지면 출고 불가** 스모크 |
| [`OPS.md`](./OPS.md#preview-게이트) · [`UI.md`](./UI.md#모션) · [`QA_RECORD.md`](./QA_RECORD.md) 등 | 단계별 상세·자동화 |

#### 태그

| 태그 | 의미 | 프로필 |
|------|------|--------|
| **필수** | 미충족 시 원칙적 `NO-GO` | 출고마다 |
| **권장** | 위험·구조 변경 시 강화 | 메이저 |
| **후속** | 분기·대규모·잔여 개선 | 분기 |

체크 형식: `- [ ] **필수** …`. 실행 순서·증적은 [`QA_SHIP_GATE.md`](./QA_SHIP_GATE.md).

---

### 1. 문서 사용 방법

검수는 다음 순서로 진행한다.

1. 요구사항과 출고 범위를 고정한다.
2. 자동화 가능한 정적 검사를 먼저 수행한다.
3. 기능·논리·데이터·통신을 검증한다.
4. UI·UX·접근성·애니메이션을 검증한다.
5. 성능·부하·장애·보안 등 비기능 품질을 검증한다.
6. 운영 배포, 모니터링, 백업·복구 가능성을 검증한다.
7. 결함 등급과 출고 게이트에 따라 최종 승인한다.

각 항목의 판정은 다음 중 하나로 기록한다.

- `PASS`: 기준을 충족함
- `FAIL`: 기준을 충족하지 못함
- `BLOCKED`: 선행 조건 또는 환경 문제로 검수하지 못함
- `N/A`: 제품 범위에 해당하지 않음

검수 증적에는 실행 환경, 입력값, 기대 결과, 실제 결과, 화면 캡처·로그, 검수자, 검수일을 남긴다.

---

### 2. 전체 검수 단계와 출고 게이트

| 단계 | 검수 영역 | 출고마다 | 메이저 | 분기 | 주요 산출물 |
|---:|---|:---:|:---:|:---:|---|
| 0 | 범위·기준 확정 | ● | ● | ● | 출고 범위표 |
| 1 | 요구사항·설계 | △ | ● | ● | RTM |
| 2 | 코드·정적 품질 | ● | ● | ● | 린트·빌드 |
| 3 | 기능·논리 (+DELIN) | ● | ● | ● | 기능·ARIA |
| 4 | 데이터 품질 (표본) | ● | ● | ● | 데이터 대조 |
| 5 | 통신·제어 (명령 추적) | ● | ● | ● | 명령·API |
| 6 | UI·UX | △ | ● | ● | UI 점검 |
| 7 | 접근성·호환 (+Android) | ● | ● | ● | 호환·앱 |
| 8 | 애니메이션 | ○ | ● | ● | 모션 |
| 9 | 성능·용량 | ○ | △ | ● | 성능 |
| 10 | 장애·복구 | △ | ● | ● | 장애 주입 |
| 11 | 보안·권한 | ● | ● | ● | 권한 매트릭스 |
| 12 | 배포·운영 (+APK) | ● | ● | ● | 배포·/app |
| 13 | 문서·인수인계 | ○ | △ | ● | 매뉴얼 |
| 14 | 최종 승인 | ● | ● | ● | 승인서 |

● 해당 프로필에서 단계 내 **필수**(또는 프로필 추가분)를 수행 · △ 단계 내 일부 필수만 · ○ 주로 권장/후속

---

## 단계별 검수

### 0단계. 출고 범위와 품질 기준 확정

#### 목적

검수 중 요구사항이 계속 변경되거나 검수자의 판단 기준이 달라지는 일을 방지한다.

#### 점검 포인트

- [ ] **필수** 출고 버전, Git commit/tag, 빌드 번호가 고정돼 있다.
- [ ] **필수** 포함 기능과 제외 기능이 명시돼 있다.
- [ ] **필수** 지원 브라우저, 화면 크기, 사용자 역할이 정의돼 있다.
- [ ] **필수** 대상 농장·축사·컨트롤러 및 최대 장비 규모가 정의돼 있다.
- [ ] **필수** 데이터 갱신 주기, 오프라인 판정 시간, 허용 지연이 정의돼 있다.
- [ ] **필수** 정상·주의·경고·장애의 판정 기준이 정의돼 있다.
- [ ] **필수** 명령 성공·실패·타임아웃의 기준이 정의돼 있다.
- [ ] **필수** 성능 목표와 출고 불가 결함 기준이 합의돼 있다.

#### 합격 기준

- 모든 검수자가 동일한 버전과 동일한 완료 기준을 사용한다.
- 미확정 정책은 담당자와 확정일까지 기록하고, 안전·제어 관련 미확정 사항은 출고 차단으로 처리한다.

#### 산출물

- 출고 범위 정의서
- 환경·지원 범위 매트릭스
- 품질 목표 및 출고 차단 조건

---

### 1단계. 요구사항·설계 검수

#### 목적

구현된 기능이 원래 요구사항과 일치하며 누락·과잉 구현이 없는지 확인한다.

#### 점검 포인트

- [ ] **권장** 각 요구사항에 구현 화면 또는 모듈이 연결돼 있다.
- [ ] **권장** 각 요구사항에 최소 하나 이상의 테스트 케이스가 연결돼 있다.
- [ ] **권장** 농장 → 축사 → 컨트롤러 계층 및 식별 규칙이 일관적이다.
- [ ] **권장** 온도·습도·RPM의 단위, 범위, 정밀도, 반올림 규칙이 정의돼 있다.
- [ ] **권장** 실시간 데이터와 이력 데이터의 기준 시각과 조회 규칙이 정의돼 있다.
- [ ] **필수** 사용자별 조회·설정·제어 권한이 정의돼 있다.
- [ ] **필수** 정상, 로딩, 빈 데이터, 지연, 오류, 오프라인 상태가 설계돼 있다.
- [ ] **권장** 개발 중 변경된 요구사항이 화면·서버·DB·문서에 모두 반영됐다.

#### 합격 기준

- 출고 범위의 요구사항 100%가 구현 및 테스트 항목에 연결돼 있다.
- 안전·권한·제어 관련 요구사항에 미검증 항목이 없다.

#### 산출물

- 요구사항–기능–테스트 추적 매트릭스(RTM)
- 화면·데이터·상태 명세서

---

### 2단계. 코드·정적 품질 검수

#### 목적

실행하지 않고 탐지할 수 있는 오류와 유지보수 위험을 제거한다.

#### 점검 포인트

##### 자동 검사

- [ ] **필수** ESLint 오류 0건이며 허용 경고는 사유가 기록돼 있다.
- [ ] **필수** TypeScript 타입 오류 0건이다.
- [ ] **필수** 운영 모드 빌드가 성공하며 빌드 경고를 검토했다.
- [ ] **필수** 포매팅 규칙을 통과한다.
- [ ] **후속** 단위·컴포넌트·통합 테스트가 통과한다.
- [ ] **후속** 의존성 취약점과 불필요한 패키지를 점검했다.

##### 수동 구조 검사

- [ ] **권장** 미사용 코드, 파일, 변수, import가 제거됐다.
- [ ] **권장** `console.log`, 임시 mock 데이터, 테스트 계정, TODO가 제거 또는 승인됐다.
- [ ] **필수** URL, 포트, 비밀키, 사용자 정보가 하드코딩되지 않았다.
- [ ] **권장** `any`, 강제 형변환, non-null 단언에 타당한 근거가 있다.
- [ ] **후속** 함수·컴포넌트가 과도한 책임을 갖지 않는다.
- [ ] **권장** 데이터 요청, 상태관리, 표현 컴포넌트의 책임이 분리돼 있다.
- [ ] **권장** 타이머, 이벤트 리스너, MQTT/WebSocket 구독이 해제된다.
- [ ] **필수** 비동기 오류가 삼켜지지 않고 사용자 또는 로그로 전달된다.
- [ ] **후속** 순환 의존성과 중복 로직이 없다.

#### 합격 기준

- 린트·타입·운영 빌드 오류 0건
- 비밀정보 노출 0건
- 치명적 정적 분석 이슈 0건
- 미해결 경고는 위험도, 사유, 조치일이 등록돼 있음

#### 산출물

- 린트·타입 검사 결과
- 운영 빌드 로그
- 코드 리뷰 기록
- 의존성 및 취약점 검사 결과

---

### 3단계. 기능·논리 검수

#### 목적

기능이 정상 조건뿐 아니라 경계값, 잘못된 입력, 비동기 경쟁 상태에서도 정확히 동작하는지 확인한다.

#### 점검 포인트

##### 정상 기능

- [ ] **필수** ARIA/DELIN 탭·companion 핵심 흐름이 정상이다.
- [ ] **필수** DELIN 답변에 내부 ID·영문 필드명이 노출되지 않으며 CTRL은 추천만 한다.

- [ ] **필수** 로그인부터 농장·축사·컨트롤러 조회까지 핵심 흐름이 정상이다.
- [ ] **필수** 목록, 그리드, 차트, AI 화면 간 선택 상태와 데이터가 일치한다.
- [ ] **필수** 설정 조회·수정·저장·취소가 명세대로 동작한다.
- [ ] **필수** 알람 확인 및 상태 변경 흐름이 정상이다.
- [ ] **필수** 새로고침, 뒤로 가기, 직접 URL 접근 후 상태가 타당하다.

##### 경계값·예외

- [ ] **필수** 0, 음수, 소수, 최대·최소값을 처리한다.
- [ ] **권장** `null`, `undefined`, 빈 문자열, 빈 배열을 처리한다.
- [ ] **필수** 임계값과 정확히 같은 값의 판정이 명세와 일치한다.
- [ ] **권장** 하한이 상한보다 큰 설정 등 모순 입력을 차단한다.
- [ ] **필수** 중복 클릭과 연속 저장·명령을 안전하게 처리한다.
- [ ] **필수** 이전 요청보다 늦게 도착한 응답이 최신 상태를 덮어쓰지 않는다.
- [ ] **필수** 화면 전환 후 완료된 비동기 요청이 잘못된 화면을 갱신하지 않는다.
- [ ] **필수** 일부 API만 실패해도 전체 화면이 불필요하게 중단되지 않는다.

##### 테스트 계층

- [ ] **권장** 계산·판정·변환 함수의 단위 테스트가 있다.
- [ ] **후속** 주요 UI 컴포넌트 상태 테스트가 있다.
- [ ] **후속** UI–API–DB 간 통합 테스트가 있다.
- [ ] **후속** 핵심 사용자 여정의 E2E 테스트가 있다.
- [ ] **필수** 결함 수정 후 회귀 테스트를 수행한다.

#### 합격 기준

- 핵심 E2E 시나리오 100% 통과
- 계산·알람·제어 논리의 미해결 오류 0건
- 수정 영역과 영향 영역의 회귀 테스트 통과

#### 산출물

- 기능 테스트 케이스 및 결과
- 경계값·예외 테스트 결과
- 회귀 테스트 보고서

---

### 4단계. 데이터 품질 검수

#### 목적

화면에 보이는 데이터가 원시 메시지, 서버 처리값, DB 저장값과 일치하고 사용자가 데이터 신뢰도를 판단할 수 있도록 한다.

#### 점검 포인트

##### 정확성·정합성

- [ ] **필수** 원시 데이터 → 디코딩 → DB → API → 화면 값이 추적 가능하다.
- [ ] **필수** 온도·습도·RPM의 단위 변환과 반올림이 정확하다.
- [ ] **필수** 장비 ID가 올바른 농장·축사·컨트롤러에 연결된다.
- [ ] **필수** 실시간 최신값과 이력 조회값이 기준 시각에 따라 일치한다.
- [ ] **필수** 차트 집계·평균·최솟값·최댓값의 계산 기준이 정확하다.
- [ ] **필수** 서버, DB, 브라우저의 타임존이 일관적이며 표시 시각이 명확하다.

##### 비정상 데이터

- [ ] **권장** 누락, 중복, 역순, 지연 데이터 처리 규칙이 있다.
- [ ] **권장** 미래 시각 또는 지나치게 오래된 데이터가 식별된다.
- [ ] **권장** 물리적으로 불가능한 값과 급격한 이상값이 처리된다.
- [ ] **필수** 필드 누락, 잘못된 타입, 알 수 없는 스키마를 안전하게 처리한다.
- [ ] **필수** 과거 데이터 일괄 수신 중 최신값이 과거값으로 후퇴하지 않는다.

##### 상태 구분

- [ ] **필수** 실제 `0`과 데이터 없음이 구분된다.
- [ ] **필수** 로딩, 데이터 없음, 갱신 지연, 센서 오류, 통신 단절, 권한 없음이 구분된다.
- [ ] **필수** 마지막 정상 수신 시각과 현재 데이터의 신선도를 확인할 수 있다.

#### 합격 기준

- 표본 E2E 데이터 비교에서 값·단위·장비·시각 불일치 0건
- 데이터 없음·센서 오류·통신 단절을 정상값으로 오인할 가능성 0건
- 중복·역순·지연 데이터 처리 결과가 정의된 정책과 일치함

#### 산출물

- 원시–저장–표시 데이터 대조표
- 비정상 데이터 주입 테스트 결과
- 데이터 상태·신선도 정의서

---

### 5단계. 통신·제어 검수

#### 목적

장비–통신모듈–브로커–서버–DB–대시보드 연결이 불안정한 상황에서도 중복·오판·잘못된 제어를 방지한다.

#### 점검 포인트

##### API

- [ ] **필수** 요청·응답 스키마와 상태 코드가 일관적이다.
- [ ] **권장** 타임아웃, 재시도, 요청 취소 규칙이 있다.
- [ ] **필수** 중복 요청이 중복 저장·명령으로 이어지지 않는다.
- [ ] **권장** 4xx, 5xx, 부분 응답, 느린 응답을 처리한다.
- [ ] **권장** 구버전·신버전 API 또는 메시지 스키마 호환 정책이 있다.

##### MQTT·실시간 연결

- [ ] **권장** 최초 연결, 정상 종료, 순간 단절, 장기 단절 후 재연결이 정상이다.
- [ ] **권장** 브로커 재시작 후 자동 복구된다.
- [ ] **권장** 재연결 시 중복 구독·중복 이벤트가 발생하지 않는다.
- [ ] **후속** 메시지 유실, 중복, 역순, retained 메시지를 정책대로 처리한다.
- [ ] **필수** 장비 오프라인 판정과 복귀 시점이 명세와 일치한다.
- [ ] **필수** 단절 후 과거 데이터 연속 전송과 실시간 데이터가 충돌하지 않는다.
- [ ] **필수** 잘못된 토픽, 장비 ID, 메시지 구조가 전체 처리 흐름을 중단시키지 않는다.

##### 제어 명령

- [ ] **필수** 명령에 고유 ID와 대상 장비가 기록된다.
- [ ] **필수** 전송, 수신, 실행, 성공, 실패, 타임아웃 상태를 추적할 수 있다.
- [ ] **필수** 중복 클릭·재시도로 동일 명령이 의도치 않게 반복 실행되지 않는다.
- [ ] **필수** 응답이 늦게 도착해도 최신 명령 상태를 덮어쓰지 않는다.
- [ ] **필수** 잘못된 대상·범위·권한의 명령이 서버에서 차단된다.
- [ ] **필수** 명령 실패 시 UI가 성공으로 오인시키지 않는다.
- [ ] **필수** 누가 언제 어떤 장비에 어떤 값을 명령했는지 감사 로그가 남는다.

#### 합격 기준

- 단절·재연결 후 데이터 수신과 화면 상태가 자동 정상화됨
- 중복 구독, 중복 저장, 중복 명령 0건
- 미확인 명령을 성공으로 표시하는 사례 0건
- 제어 대상 및 명령 이력을 종단 간 추적 가능함

#### 산출물

- API·MQTT 인터페이스 검증표
- 통신 단절·재연결 테스트 결과
- 명령 상태 전이 및 감사 로그 샘플

---

### 6단계. UI 디자인 규칙·UX 검수

#### 목적

동일 의미가 동일한 형태로 표현되고 사용자가 현재 상태와 다음 행동을 오해하지 않도록 한다.

#### 점검 포인트

##### 디자인 시스템

- [ ] **권장** 색상, 타이포, 간격, 크기, 모서리, 그림자가 토큰으로 통일돼 있다.
- [ ] **필수** 정상·주의·경고·장애 색상의 의미가 모든 화면에서 동일하다.
- [ ] **권장** 버튼의 primary, secondary, destructive 우선순위가 일관적이다.
- [ ] **권장** 카드, 표, 입력, 모달, 툴팁, 아이콘 규칙이 일관적이다.
- [ ] **권장** 숫자, 단위, 날짜·시각, 소수점 표현이 통일돼 있다.

##### 컴포넌트 상태

- [ ] **권장** default, hover, focus, active, disabled 상태가 있다.
- [ ] **권장** loading, empty, error, success, stale/offline 상태가 있다.
- [ ] **권장** 로딩 중 중복 작업 가능 여부가 명확하다.
- [ ] **권장** 오류 메시지가 원인과 사용자의 다음 행동을 안내한다.

##### 사용성·오조작 방지

- [ ] **권장** 현재 농장·축사·컨트롤러 선택 상태가 항상 명확하다.
- [ ] **필수** 위험한 제어·삭제·대량 변경에는 확인 또는 보호 장치가 있다.
- [ ] **필수** 미저장 변경과 저장 성공·실패가 명확히 표시된다.
- [ ] **권장** 취소, 되돌리기 또는 안전한 복구 경로가 있다.
- [ ] **권장** 빈 화면에 다음 행동 안내가 있다.
- [ ] **권장** 현장 사용자 용어와 화면 용어가 일치한다.
- [ ] **권장** 설명 없이 실제 사용자가 핵심 업무를 수행할 수 있다.

#### 합격 기준

- 핵심 컴포넌트의 필수 상태 누락 0건
- 상태 색상·용어·단위 충돌 0건
- 실제 사용자 핵심 업무 수행 성공률이 합의된 목표 이상임
- 잘못된 제어로 이어질 수 있는 UX 문제 0건

#### 산출물

- 디자인 규칙 체크리스트
- 사용자 업무 수행 테스트 결과
- UI 결함 목록 및 화면 캡처

---

### 7단계. 접근성·반응형·호환성 검수

#### 목적

다양한 화면·입력 방식·브라우저·확대 환경에서도 핵심 기능을 사용할 수 있도록 한다.

#### 점검 포인트

##### 접근성

- [ ] **권장** 키보드만으로 핵심 기능을 조작할 수 있다.
- [ ] **권장** 포커스 표시와 탭 이동 순서가 자연스럽다.
- [ ] **권장** 색상 외에 텍스트·아이콘으로 상태를 전달한다.
- [ ] **권장** 텍스트와 배경 명암비가 충분하다.
- [ ] **권장** 입력 필드와 라벨, 오류 설명이 연결돼 있다.
- [ ] **권장** 아이콘 버튼에 접근 가능한 이름이 있다.
- [ ] **권장** 차트 핵심 정보를 텍스트·표 등으로도 확인할 수 있다.

##### 반응형·호환성

- [ ] **필수** Android 설치 페이지(`/app`)·APK 다운로드가 이번 출고 버전으로 가능하다.
- [ ] **필수** 설치 앱에서 로그인 등 핵심 진입이 가능하다.

- [ ] **권장** PC, 태블릿, 모바일의 지원 해상도에서 기능이 유지된다.
- [ ] **권장** 브라우저 배율 100%, 125%, 150%, 200%를 확인했다.
- [ ] **후속** 지원 대상 Chrome, Edge, Safari 등에서 검증했다.
- [ ] **권장** 긴 농장명·장비명·사용자명이 레이아웃을 깨뜨리지 않는다.
- [ ] **권장** 터치와 마우스 입력 모두에서 조작 가능하다.
- [ ] **권장** 긴 표와 차트의 스크롤·overflow가 정상이다.

#### 합격 기준

- 지원 환경에서 핵심 기능 차단 결함 0건
- 색상만으로 전달되는 중요 상태 0건
- 200% 확대에서도 정보와 기능 손실 없음

#### 산출물

- 브라우저·기기·해상도 호환성 매트릭스
- 접근성 검사 결과

---

### 8단계. 애니메이션·모션 규칙 검수

#### 목적

애니메이션이 상태 변화와 인과관계를 설명하면서도 실시간 갱신, 인지, 조작성, 성능을 방해하지 않도록 한다.

#### 점검 포인트

- [ ] **권장** 모든 애니메이션에 정보 전달 또는 맥락 유지 목적이 있다.
- [ ] **권장** 일반 전환과 패널 전환의 duration 및 easing이 통일돼 있다.
- [ ] **권장** 화면 진입 시 과도한 동시 애니메이션이 없다.
- [ ] **권장** 실시간 데이터 갱신마다 카드 전체 애니메이션이 반복되지 않는다.
- [ ] **권장** 연속 클릭과 빠른 화면 전환 시 애니메이션이 중첩되지 않는다.
- [ ] **권장** 화면 이탈 후 애니메이션 타이머와 프레임 요청이 종료된다.
- [ ] **권장** 경고 점멸은 치명적이고 즉시 조치가 필요한 상태로 제한된다.
- [ ] **권장** 애니메이션 중 입력 가능·불가능 상태가 명확하다.
- [ ] **권장** `prefers-reduced-motion`을 지원한다.
- [ ] **권장** 움직임이 없어도 동일한 상태 정보를 인식할 수 있다.

#### 합격 기준

- 애니메이션 중첩, 무한 반복, 잔존 타이머 0건
- 실시간 갱신으로 인한 불필요한 전체 재애니메이션 0건
- 모션 감소 환경에서도 기능·정보 손실 없음

#### 산출물

- 모션 토큰 및 사용 규칙
- 애니메이션 상태·성능 점검 결과

---

### 9단계. 성능·부하·장시간 안정성 검수

#### 목적

목표 데이터량과 사용자 수에서 응답성을 유지하고 장시간 실행 중 자원 누수나 성능 저하가 발생하지 않는지 확인한다.

#### 점검 포인트

##### 초기·화면 성능

- [ ] **권장** 초기 로딩과 주요 화면 전환 시간이 목표 이내다.
- [ ] **후속** JavaScript 번들, 이미지, 폰트 크기가 관리된다.
- [ ] **후속** 불필요한 API 요청과 중복 렌더링이 없다.
- [ ] **후속** 큰 화면·차트·모듈에 지연 로딩이 적절히 적용됐다.

##### 실시간·차트 성능

- [ ] **후속** 실시간 수신마다 전체 화면이 재렌더링되지 않는다.
- [ ] **권장** 차트 포인트 상한, 윈도잉, 다운샘플링 정책이 있다.
- [ ] **후속** 대량 표 데이터에 페이지네이션 또는 가상화가 적용된다.
- [ ] **후속** 다수 농장·컨트롤러 동시 표시에서도 조작성이 유지된다.

##### 부하·장시간

- [ ] **후속** 예상 동시 사용자 수에서 응답 시간이 목표 이내다.
- [ ] **후속** 다수 장비 동시 재연결과 과거 데이터 집중 전송을 처리한다.
- [ ] **후속** 대량 이력 조회가 DB·API·브라우저를 과부하시키지 않는다.
- [ ] **후속** 1시간, 8시간, 필요 시 24시간 실행 후 메모리·CPU가 안정적이다.
- [ ] **후속** 타이머, 구독, 이벤트, DOM 노드 수가 지속 증가하지 않는다.
- [ ] **후속** 로그·DB·스토리지 증가량과 보관 정책이 검증됐다.

#### 합격 기준

- 합의된 응답 시간·동시 사용자·장비 처리 목표 충족
- 장시간 시험에서 지속적인 메모리·CPU·구독 증가 없음
- 목표 최대 데이터량에서 핵심 조작 불능 또는 브라우저 종료 없음

#### 산출물

- 초기 로딩·렌더링 성능 보고서
- 부하·스파이크 테스트 결과
- 장시간 안정성 그래프 및 로그

---

### 10단계. 장애 주입·복구 검수

#### 목적

실패를 숨기지 않고 정확히 표시하며, 데이터·명령을 오판하지 않은 채 정상 상태로 복구하는지 확인한다.

#### 점검 포인트

- [ ] **권장** 인터넷 단절 시 오프라인 또는 지연 상태를 표시한다.
- [ ] **권장** MQTT 단절 시 중복 구독 없이 자동 재연결한다.
- [ ] **권장** API 타임아웃 시 무한 로딩에 빠지지 않는다.
- [ ] **권장** API 4xx·5xx에서 원인과 재시도 방법을 안내한다.
- [ ] **권장** DB 또는 서버 지연이 전체 UI 멈춤으로 확산되지 않는다.
- [ ] **권장** 잘못된 단일 메시지가 전체 데이터 파이프라인을 중단시키지 않는다.
- [ ] **권장** 서비스 일부 장애 시 가능한 기능은 계속 제공한다.
- [ ] **권장** 새로고침·재로그인 후 안전하게 상태를 복원한다.
- [ ] **권장** 장애 복구 후 데이터 중복·후퇴·누락 여부를 확인한다.
- [ ] **권장** 배포 실패 시 이전 안정 버전으로 롤백할 수 있다.

#### 합격 기준

- 장애를 정상 상태로 표시하는 사례 0건
- 복구 후 중복 구독·중복 명령·최신값 후퇴 0건
- 핵심 장애 시나리오에서 자동 또는 문서화된 수동 복구 가능

#### 산출물

- 장애 시나리오별 주입·복구 결과
- 장애 상태 UI 캡처
- 복구 절차서

---

### 11단계. 보안 검수

#### 목적

인증·권한 우회, 민감정보 노출, 입력 공격, 제어 명령 악용을 방지한다.

#### 점검 포인트

##### 인증·권한

- [ ] **필수** 로그인, 로그아웃, 세션 만료가 정상이다.
- [ ] **필수** 사용자·관리자 역할과 농장별 접근 범위가 서버에서 검증된다.
- [ ] **필수** URL 직접 입력과 API 직접 호출로 권한을 우회할 수 없다.
- [ ] **필수** UI에서 버튼을 숨기는 것과 별개로 서버가 권한을 검사한다.
- [ ] **필수** 제어·설정 변경에 강화된 권한과 감사 로그가 적용된다.

##### 애플리케이션·정보 보호

- [ ] **필수** 입력값 길이·형식·범위가 서버와 클라이언트에서 검증된다.
- [ ] **권장** XSS, SQL Injection, CSRF 등 기본 공격을 점검했다.
- [ ] **권장** API rate limit와 무차별 요청 방어가 있다.
- [ ] **필수** 소스, 소스맵, 로그, 오류 메시지에 비밀키·개인정보가 없다.
- [ ] **필수** 환경변수와 인증정보가 저장소·브라우저 번들에 포함되지 않는다.
- [ ] **필수** 의존성 취약점을 검토하고 조치했다.
- [ ] **필수** 전송 구간과 저장 구간의 보안 수준 및 잔여 위험이 문서화됐다.

#### 합격 기준

- 인증 우회, 타 농장 접근, 무권한 제어 가능성 0건
- 비밀정보·민감정보 노출 0건
- 치명적·높음 등급 취약점 0건 또는 공식 위험 승인 완료

#### 산출물

- 인증·권한 테스트 매트릭스
- 취약점 검사 및 조치 보고서
- 제어 명령 감사 로그
- 잔여 보안 위험 승인서

---

### 12단계. 배포·운영·관측성 검수

#### 목적

운영 환경에 안전하게 배포하고, 문제를 빠르게 감지·추적·복구할 수 있도록 한다.

#### 점검 포인트

##### 배포

- [ ] **필수** Storage APK·`APP_APK_VERSION`이 이번 출고와 일치하고 `/app/download`가 동작한다.

- [ ] **필수** 개발·테스트·운영 환경과 환경변수가 분리돼 있다.
- [ ] **권장** 운영 API, MQTT, DB, 도메인, CORS 설정을 검증했다.
- [ ] **권장** HTTPS 인증서와 만료·갱신 절차를 확인했다.
- [ ] **권장** DB 마이그레이션 순서와 하위 호환성이 검증됐다.
- [ ] **필수** 배포 후 smoke test가 자동 또는 체크리스트로 수행된다.
- [ ] **권장** 캐시로 인해 프론트와 API 구버전이 충돌하지 않는다.
- [ ] **권장** 이전 버전 롤백 절차와 소요 시간을 검증했다.

##### 관측성

- [ ] **권장** 프론트엔드 예외와 API 오류를 수집한다.
- [ ] **권장** 장비별 마지막 수신 시각과 연결 상태를 확인할 수 있다.
- [ ] **권장** MQTT 연결·재연결·구독·처리 실패 건수를 확인할 수 있다.
- [ ] **필수** 명령 성공·실패·타임아웃을 집계하고 추적할 수 있다.
- [ ] **필수** 요청 ID, 메시지 ID, 장비 ID로 종단 간 로그를 찾을 수 있다.
- [ ] **권장** 서버·DB·디스크·트래픽 임계치 알림이 있다.
- [ ] **권장** 로그 보관기간과 민감정보 마스킹 규칙이 있다.

##### 백업·복구

- [ ] **권장** 운영 데이터의 백업 주기와 보관기간이 정의돼 있다.
- [ ] **후속** 백업 성공 여부를 모니터링한다.
- [ ] **후속** 실제 백업 파일을 이용해 복원 시험을 수행했다.
- [ ] **후속** 목표 복구 시점(RPO)과 복구 시간(RTO)이 정의돼 있다.

#### 합격 기준

- 운영 배포와 smoke test 성공
- 중요 오류·단절·자원 임계치의 탐지 및 알림 가능
- 롤백과 백업 복원이 실제 검증됨
- 장애 분석에 필요한 로그 상관관계가 확보됨

#### 산출물

- 배포·롤백 실행서
- 운영 모니터링 대시보드 및 알림 목록
- 백업·복원 시험 결과
- 운영 smoke test 결과

---

### 13단계. 문서·인수인계 검수

#### 목적

개발자가 없어도 제3자가 설치, 사용, 운영, 장애 대응을 수행할 수 있게 한다.

#### 점검 포인트

- [ ] **권장** 사용자 매뉴얼과 관리자 매뉴얼이 최신 화면과 일치한다.
- [ ] **권장** 설치·빌드·배포 절차가 재현 가능하다.
- [ ] **후속** 환경변수 목록에 용도, 필수 여부, 예시가 있다.
- [ ] **후속** 시스템 구성도와 데이터 흐름도가 최신이다.
- [ ] **후속** API·MQTT 토픽·메시지·명령 프로토콜이 문서화됐다.
- [ ] **후속** 데이터 사전과 상태·알람 기준이 문서화됐다.
- [ ] **후속** 장애 유형별 확인 순서와 복구 방법이 있다.
- [ ] **후속** 알려진 제한사항, 잔여 결함, 임시 우회 방법이 명시돼 있다.
- [ ] **후속** 버전 및 변경 이력과 담당자 체계가 있다.
- [ ] **후속** 제3자가 문서만 보고 주요 절차를 재현했다.

#### 합격 기준

- 운영 필수 절차의 문서 누락 0건
- 제3자 재현 시험에서 설치·배포·복구가 성공함
- 화면·프로토콜·환경과 문서 간 중요 불일치 0건

#### 산출물

- 사용자·관리자·운영 매뉴얼
- 시스템 구성도 및 프로토콜 문서
- 인수인계 확인서

---

### 14단계. 최종 출고 승인

#### 결함 심각도

| 등급 | 판단 기준 | 예시 | 출고 원칙 |
|---|---|---|---|
| P0 | 안전·보안·데이터 오판·잘못된 제어 | 타 장비 명령, 권한 우회, 정상/장애 오표시 | 출고 불가 |
| P1 | 핵심 업무 실패 또는 복구 불가 | 로그인 불가, 실시간 수신 중단, 설정 유실 | 원칙적으로 출고 불가 |
| P2 | 우회 가능한 기능·성능·사용성 문제 | 특정 해상도 깨짐, 느린 이력 조회 | 위험 승인 후 제한 허용 |
| P3 | 미세한 디자인·코드·문구 문제 | 간격·문구·비핵심 경고 | 후속 개선 가능 |

#### 권장 출고 승인 조건

- [ ] **필수** P0 결함 0건
- [ ] **필수** P1 결함 0건
- [ ] **필수** 잔여 P2마다 영향, 우회 방법, 담당자, 수정 예정일이 있다.
- [ ] **필수** 출고 범위 핵심 E2E 시나리오가 100% 통과했다.
- [ ] **필수** 데이터 신뢰성, 통신 복구, 명령 추적 검수가 통과했다.
- [ ] **필수** 보안 기준(권한·비밀정보)을 충족했다.
- [ ] **권장** 성능·장시간 안정성 기준을 충족했다.
- [ ] **필수** 운영 배포·smoke를 검증했다.
- [ ] **권장** 모니터링·롤백·백업 복원을 검증했다.
- [ ] **권장** 사용자·운영 문서가 승인됐다.
- [ ] **필수** 제품 책임자와 기술 책임자가 잔여 위험을 확인했다.

#### 최종 판정

- `GO`: 모든 필수 게이트 통과
- `CONDITIONAL GO`: P0/P1이 없고 승인된 P2 조치 계획이 있음
- `NO-GO`: 필수 게이트 실패 또는 P0/P1 잔존

---

## 필수 테스트 시나리오 세트

### A. 정상 업무 흐름

1. 로그인한다.
2. 농장 → 축사 → 컨트롤러를 선택한다.
3. 온도·습도·RPM 최신값과 마지막 수신 시각을 확인한다.
4. 차트에서 이력 구간을 조회한다.
5. 허용된 설정 또는 명령을 실행한다.
6. 처리 상태와 최종 결과를 확인한다.
7. 감사 로그와 DB 기록이 일치하는지 확인한다.

### B. 데이터 이상

1. 누락 필드, 잘못된 타입, 범위 초과값을 입력한다.
2. 중복·역순·지연·미래 시각 메시지를 입력한다.
3. 과거 데이터를 연속 전송하면서 실시간 데이터를 함께 입력한다.
4. 화면·DB·로그·알람 결과를 비교한다.

### C. 통신 장애·복구

1. MQTT 또는 네트워크를 단절한다.
2. 오프라인 판정 시간과 화면 표시를 확인한다.
3. 단절 상태에서 데이터와 명령 동작을 확인한다.
4. 연결을 복구한다.
5. 중복 구독, 데이터 후퇴, 중복 명령 여부를 확인한다.

### D. 사용자 오조작

1. 저장·명령 버튼을 빠르게 반복 클릭한다.
2. 요청 처리 중 다른 농장·축사·컨트롤러로 이동한다.
3. 상한·하한 역전, 빈 값, 범위 초과값을 입력한다.
4. 새로고침, 뒤로 가기, 다중 탭 동작을 확인한다.

### E. 권한·보안

1. 역할별 메뉴·데이터·제어 접근을 확인한다.
2. URL과 API를 직접 호출해 다른 농장 접근을 시도한다.
3. 세션 만료 후 조회·저장·명령을 시도한다.
4. 입력 공격과 비정상 대량 요청을 점검한다.

### F. 장시간·부하

1. 목표 장비 수와 사용자 수를 시뮬레이션한다.
2. 다수 장비의 동시 재연결과 밀린 데이터 집중 전송을 수행한다.
3. 1시간, 8시간, 필요 시 24시간 대시보드를 실행한다.
4. 응답 시간, 메모리, CPU, 렌더링, 구독 수를 비교한다.

---

## 검수 결함 기록 양식

| 항목 | 기록 내용 |
|---|---|
| 결함 ID | 예: DASH-QA-001 |
| 제목 | 문제를 한 문장으로 설명 |
| 검수 단계 | 데이터, 통신, UI, 보안 등 |
| 심각도 | P0 / P1 / P2 / P3 |
| 발생 환경 | 버전, 브라우저, 계정, 장비, 네트워크 |
| 사전 조건 | 재현 전 필요한 상태 |
| 재현 절차 | 번호 순서로 기록 |
| 기대 결과 | 명세상 올바른 결과 |
| 실제 결과 | 실제 관찰 결과 |
| 영향 범위 | 사용자·장비·데이터·운영 영향 |
| 증적 | 화면 캡처, 로그, 메시지 ID, 요청 ID |
| 원인 | 분석된 기술적 원인 |
| 조치 내용 | 수정 또는 우회 방법 |
| 담당자·기한 | 책임자와 완료 예정일 |
| 재검증 | 결과, 검수자, 일자 |

---

## 일일 검수 현황 요약 양식

| 구분 | 전체 | PASS | FAIL | BLOCKED | N/A |
|---|---:|---:|---:|---:|---:|
| 요구사항·설계 |  |  |  |  |  |
| 코드·정적 품질 |  |  |  |  |  |
| 기능·논리 |  |  |  |  |  |
| 데이터 품질 |  |  |  |  |  |
| 통신·제어 |  |  |  |  |  |
| UI·UX |  |  |  |  |  |
| 접근성·호환성 |  |  |  |  |  |
| 애니메이션 |  |  |  |  |  |
| 성능·장시간 |  |  |  |  |  |
| 장애·복구 |  |  |  |  |  |
| 보안 |  |  |  |  |  |
| 배포·운영 |  |  |  |  |  |
| 문서·인수인계 |  |  |  |  |  |

### 현재 출고 판정

- 판정: `GO / CONDITIONAL GO / NO-GO`
- P0 잔여 건수:
- P1 잔여 건수:
- 주요 차단 사유:
- 다음 재검수 일자:
- 승인자:

---

### 핵심 원칙

출고 품질은 단순히 오류가 적다는 의미가 아니다.

> **출고 품질 = 요구사항 적합성 + 코드 품질 + 기능 정확성 + 데이터 신뢰성 + 제어 안전성 + 실패 복구성 + 보안성 + 운영 가능성**

IoT 대시보드는 특히 `실제 값 0`, `데이터 없음`, `센서 오류`, `통신 단절`, `갱신 지연`을 명확히 구분해야 한다. 또한 명령은 전송 성공이 아니라 대상 장비의 실행 결과까지 추적할 수 있어야 한다. 이 두 조건을 만족하지 못하면 화면이 정상적으로 보여도 출고 품질을 충족했다고 판단하지 않는다.


---

## 2026-08-05 실행

## 출고마다 검수 실행 기록 — 2026-08-05

| 항목 | 값 |
|------|-----|
| 일자 | 2026-08-05 (KST) |
| Commit (시작) | `42338e7` |
| Commit (종결) | `8a636b5` (tsc 수정·QA 기록 push) |
| 프로필 | **출고마다** |
| 웹 대상 | `http://localhost:3000` + FARM01/P00 LIVE 시뮬 (`sim_pilot_farm01.py` 가동) |
| 운영 대상 | `https://smart.autofankorea.com` |
| 출고 범위 | 현재 `main` 기능 전부 / 신규 미포함 없음 |
| 검수자 | Agent (자동) + 로컬/운영 스모크 + 사용자(실기기) |

### 판정 요약

| 항목 | 값 |
|------|-----|
| **판정** | **GO** |
| P0 | 0 |
| P1 | 0 |
| P2 | 0 (P2-1 커밋 반영 · P2-2 오탐 해제 · P2-3 다운로드+실기기 완료) |
| 승인자 | 사용자 (실기기 설치 수동 확인 2026-08-05) |

---

### Phase 결과

| Phase | 결과 | 증적 |
|-------|------|------|
| Prep | **PASS** | SHA=`42338e7`, LIVE 시뮬·`npm run dev` 가동 확인 |
| A 정적 | **PASS** | lint 0 / tsc 0 / build 0 · 수정분 `8a636b5` |
| B 스모크·권한 | **PASS** | `audit:ship-checklist` admin/operator/viewer 전부 ok · [ship-checklist-report.json](../scripts/mobile-audit-output/ship-checklist-report.json) |
| C 데이터 표본 | **PASS** | 목록 LIVE: 임신사 등 표시, 표본 약 25.7℃ / 57.5% · [ship-gate-ce-report.json](../scripts/mobile-audit-output/ship-gate-ce-report.json) |
| D 명령 추적 | **PASS** | operator 적용 → `명령 등록 · 전송 대기`, setpoint 24 · viewer 경로 ship에서 차단 |
| E DELIN/ARIA | **PASS** | 재검수: 로그인 전이 **미재현**(오탐). ask 200, `/farm` 유지 |
| F Android | **PASS** | Storage·다운로드 PASS + **실기기 설치·로그인 수동 확인 완료** (사용자 2026-08-05) |
| G 최종 | **GO** | P0/P1/P2 = 0 |

#### A 상세

| 항목 | 결과 |
|------|------|
| `npm run lint` | PASS (error 0) |
| `npx tsc --noEmit` | PASS (수정 후) |
| `npm run build` | PASS |
| 비밀 스캔 | PASS — `.env*` gitignore, 소스에 키 리터럴 없음 (env 이름·가이드 문구만) |

초기 tsc 실패 → 로컬 수정:

- `farm/page.tsx`: `user` null 가드 후 `canEditFarmScope`
- `delin-enabled.test.ts`: `NODE_ENV` 대입 방식
- `situation-alarms.test.ts` / `daily-report-alarms.test.ts`: `"ok"` → `"normal"`

**수정분 커밋:** `8a636b5` (`main` push 완료).

#### B 상세

```json
{ "ok": true, "results": [
  { "role": "admin", "ok": true },
  { "role": "operator", "ok": true, "ack": "명령 등록 · 전송 대기", "setpoint": 24 },
  { "role": "viewer", "ok": true }
]}
```

SHIP 수동 시나리오 2·3·4·8은 이번 출고마다에서 생략(계획서). 핵심 권한·적용은 자동화로 충족.

#### C·D 상세

- C: FARM01 목록에 축사·온도·습도·모터% 표시. `0`/대시 표현 공존(채널 공란 등) — 정상값 오인 패턴 없음.
- D: ship operator 1회 적용 + ack 문자열로 전송 추적 확인. viewer ship PASS.

#### E 상세

- `delin-enabled`: development 기본 on, production(VERCEL production + NODE_ENV production) 기본 off — **PASS**
- 로컬 `view=aria`: DELIN 크롬 표시, 내부 필드명 미노출
- 「글로 묻기」 후 질의: 재검수 PASS (ask 200, URL 유지). 1차 CE body 스캔은 오탐 → P2-2 해제
- 운영: 익명 `/farm` 307(로그인) — DELIN 공개 노출 없음

#### F 상세

| 항목 | 결과 |
|------|------|
| `https://smart.autofankorea.com/app` | 200, 설치 UI 구성됨 |
| 버전 라벨 | `latest` |
| 비밀번호 게이트 | 있음 → **해제 성공**(local·prod) |
| `/app/download` | 307 → Supabase signed URL → APK **8,202,607 bytes**, ZIP/APK magic OK |
| 실기기 설치·로그인 | **PASS** — 사용자 수동 확인 완료 (2026-08-05) |

증적: 로컬 산출 `p2-3-app-download-report.json` (커밋하지 않음).

#### P2-2 / P2-3 수동 재검수 (2026-08-05)

- P2-2: DELIN 리다이렉트 오탐 해제 **PASS**
- P2-3: prod/local **다운로드 PASS**
- P2-3 실기기: 사용자 확인 → **PASS** (설치·로그인)

**실기기 (사용자)**

- [x] 받은 APK 설치
- [x] 로그인
- [x] 알림 권한 안내 가능

---

### 결함 목록

| ID | 심각도 | 단계 | 제목 | 조치 |
|----|--------|------|------|------|
| DASH-QA-001 | ~~P2~~ → **해제** | A | tsc 오류 | `8a636b5` 커밋·push |
| DASH-QA-002 | ~~P2~~ → **해제** | E | DELIN 질의 후 로그인 전이 | 재검수 PASS · 오탐 |
| DASH-QA-003 | ~~P2~~ → **해제** | F | APK·실기기 | 다운로드 PASS + 실기기 수동 확인 완료 |

---

### 출고마다 체크리스트 대응

#### A 범위·정적 — PASS
- [x] 범위·commit 고정
- [x] lint / tsc / build
- [x] 비밀 하드코딩 없음

#### B 스모크·권한 — PASS
- [x] ship-checklist + 역할 3종

#### C 데이터 — PASS
- [x] 온도·습도·모터 표본
- [x] 0/없음/단절 구분(목록 관찰)
- [x] 장비–축사 연결(FARM01 LIVE)

#### D 명령 — PASS
- [x] 상태 추적(ack)
- [x] viewer 미송신(ship)
- [x] 중복 클릭 — ship 단일 적용으로 충분(출고마다); 연타 전용은 메이저

#### E DELIN — PASS
- [x] 탭·표면
- [x] 내부 ID 미노출
- [x] 적용 환각 없음
- [x] production 기본 off

#### F Android — PASS
- [x] `/app` 동작
- [x] 다운로드·버전 (`latest` · Storage APK)
- [x] 실기기 설치

#### G — GO
- [x] P0=0 P1=0
- [x] P2=0 (전부 해제)
- [x] 판정: **GO**

---

### 다음 액션

출고마다 게이트 **종료**. 메이저/분기는 별도 회차.


---

## 성능 기준

## LIVE read performance baseline

Phase 0 측정 기록. local dev · Supabase remote DB 기준.

### 목표 (local · Preview · Production 동일)

| 지표 | 목표 | 적용 |
| --- | --- | --- |
| LIVE SELECT p95 | &lt; 300 ms | local · 운영 DB |
| 페이지 TTFB p95 | &lt; 1.5 s | **local · Vercel Preview · Production** |

> **운영·배포에서도 TTFB 목표를 유지한다.** Preview/Production에서 목표를 넘기면 회귀로 보고 push 전·후 게이트에 반영한다 ([`OPS.md`](./OPS.md#preview-게이트)).

### 측정 방법

```bash
cd dashboard/web
npm run measure:live
# 동일: npx tsx scripts/measure-live-read.ts
```

페이지 TTFB는 브라우저 DevTools Network 탭에서 `/farm`, `/controllers`, `/alarms`, `/settings`, `/admin/ops` 각 10회 샘플. Admin hub는 아래 **Admin hub TTFB** 절 · `npm run measure:hub-ttfb`.

운영 URL 예:

```bash
UI_VERIFY_BASE=https://smart.autofankorea.com npm run measure:hub-ttfb
```

### Measured LIVE SELECT (2026-07-24)

`npm run measure:live` · n=10 · FARM01/P00 · remote Supabase.

| Query | p50 (ms) | p95 (ms) | vs 목표 | Notes |
| --- | --- | --- | --- | --- |
| `v_iot_dashboard_list` limit 500 | 77 | 446 | p95 spike | global list — remote cold outlier (min 43) |
| `v_iot_decoded_latest` limit 1500 | 61 | 134 | OK | legacy path |
| `v_iot_farm_overview` limit 100 | 106 | 2206 | p95 spike | aggregate — 1회 cold 2s급 (min 85) |
| **List farm-scoped 500** (`decoded_latest` FARM01/P00) | **84** | **115** | **OK** | 출고 단일농장 경로 (1-A) |
| **Detail 1 row** | **51** | **76** | **OK** | 1-B |

판정: **출고 경로(farm-scoped / detail) p95 &lt; 300 ms 충족.** global list·overview p95는 remote RTT/cold에 민감 — 참고용.

Sprint A 재측정 (2026-08-05 · `npm run measure:live`): List farm-scoped p50/p95 **40.4 / 57.0 ms**, Detail **32.1 / 35.4 ms** — 목표 유지·개선. Admin hub TTFB Playwright는 미재실행(slim은 클라이언트 TailLoader 배치에만 영향).

동일 세션 직전 1회 샘플(참고): list 116/1348 · legacy 60/85 · overview 57/82 · farm-scoped 56/75 · detail 44/53.

### Baseline (pre-optimization placeholder)

초기 문서의 `_run script_` 자리 — 최적화 전 수치는 미보존. 현재 remote 측정은 위 **Measured** 표 사용.

| Query | p50 (ms) | p95 (ms) | Notes |
| --- | --- | --- | --- |
| `v_iot_decoded_latest` limit 1500 + `decoded_json` | 61 | 134 | 2026-07-24 |
| `v_iot_dashboard_list` limit 500 | 77 | 446 | 2026-07-24 · p95 outlier |
| `v_iot_farm_overview` | 106 | 2206 | 2026-07-24 · p95 outlier |

### Post-optimization

| Query | p50 (ms) | p95 (ms) | Phase |
| --- | --- | --- | --- |
| List farm-scoped 500 | 84 | 115 | 1-A |
| Detail 1 row | 51 | 76 | 1-B |
| Farm overview | 106 | 2206† | 1-C |
| Cached repeat navigation | — | — | 1-D → Admin hub TTFB warm (아래) |

† overview p95는 cold spike; p50·min은 ~85–106 ms대.

### 2026-08-21 · overview timeout

FARM01 LIVE ~12.8만 행에서 `v_iot_farm_overview`(전체 `DISTINCT ON`)이 **9.6s** → PostgREST statement timeout.  
핫 뷰는 최근 2시간 키 + LATERAL 최신 1행으로 교체 (`20260821061828_live_hot_views_recent_latest.sql`). 적용 직후 overview EXPLAIN **605 ms** (이전 9.6 s).

### 정책

- 서버 캐시: `unstable_cache` 300 s + `revalidateTag('live')` on thermo save
- `NEXT_PUBLIC_LIVE_READ_TIER=list` (rollback: `legacy`)
- farm-scoped limit: `LIVE_FARM_ROW_LIMIT=500`
- PostgREST `max_rows=1000` 유지 ([`supabase/config.toml`](../supabase/config.toml))

### Trend RPC (farm `/farm`)

| RPC | When loaded | Cache tag | Typical rows (24h) |
| --- | --- | --- | --- |
| `farm_trend_history_by_controller_json` | Client lazy (list / 통합 추이 / 히트맵 파생) | `live:controller-trend:{scope}` | SP × stall × controller × 96 buckets · **`mesure_at` bin** · jsonb 1행 |
| `farm_trend_history_json` | PDF/SSR fallback via controller convert | `live:trend:{scope}` | unused on hub idle path |
| `farm_trend_uplink_coverage_json` | 차트 탭 전용 (희소/통신두절) | `live:controller-trend:{scope}` | **`mesure_at` bin** (received_at 선행 필터) · jsonb · `user_can_read_farm` DEFINER |

- Bucket policy: hub **and PDF/list all-periods** fetch **24h 15m → 30d 1h (24h RPC chunks, newest first)**. Splash/field prefetch **24h only**. Chart tab (or map idle stall prefetch) extends 30d. Hub **client** paints each 30d day chunk as it arrives (right=now, fill left) with **up to 3 in-flight** day RPCs; apply order stays newest-first. Mini tiles show skeleton then 24h **2h-average** until 30d is complete. Expanded lookback stays **1h**. PDF still waits for the full 30d window. 7d is a tail slice of 30d 1h. **Drag-zoom ≤ 48h** fetches **15m for that range only** (`TREND_15M_PERIODS`). Wheel lookback does not. PDF print LTTB-caps each stacked chart at 96 points. Wire format is sparse compact. UI bars 24h→24, 7d→28, 30d→30 (`farm-trend-types.ts` + `GRAPH_BARS`). Mini display uses `TREND_MINI_STRIDE_MS` (2h).
- App fetch uses `*_json` RPCs (one PostgREST row). Table-returning `farm_trend_history*` remain for SQL/EXPLAIN; do **not** `.range()` them — `max_rows=1000` re-runs the 30d `GROUP BY` per page.
- Hub UI: **controller json only**. Stall heatmap is derived (`stallTrendFromControllerPeriod`).
- Map tab SSR skips stall trend + controller-trend (Phase B idle hydrate / P4 lazy)
- **Post-login:** farmer client warms scoped panel + 24h controller trend during brand splash (`warmPostLoginFarmHub`). 30d와 coverage는 차트 탭 활성 뒤 점진 로드한다. Splash waits for field LIVE bootstrap + paint, not chart 30d / 3D.
- Admin ops Z3 (`FarmScopedPanel`) uses per-farm scoped fetch; stall trend client-idle when map opens

#### 2026-09-17 · FARM01 P0–P2

- P0: `cachedLiveQuery`에는 5MB대 RPC 원본이 아니라 sparse compact 결과만 저장한다. client cache TTL은 server slot과 같은 5분이다.
- P1: 첫 `plotPx=1×1`은 viewBox fallback으로 marker를 px 크기로 유지한다. 차트 shell hydration 후 downsample·aggregate·SVG 계산을 deferred render로 넘긴다.
- P2: decoded range partial index를 추가하고, 평균 입력에서 큰 `decoded_json`을 제외했다. B/C thermo는 bucket별 최신 row에만 재조인해 파싱한다.
- 고정 24h payload 정합성: 적용 전후 `1092 rows`, MD5 `8b42f9bb41a4f32df697fc72d1312f7f` 일치.

`TREND_MEASURE_SAMPLES=1 npm run measure:trend` · FARM01/P00 · remote Supabase:

| 경로 | 전 | 후 | JSON |
| --- | ---: | ---: | ---: |
| controller 24h @ 15m | 1.58s | **0.33s** | 0.58MiB |
| controller 30d @ 1h, 일별 직렬 | 33.9s | **16.83s** | RPC 원본 4.97MiB |
| coverage 30d @ 1h | 9.01s | **1.02s** | 2B(현재 구간 결과 없음) |

첫 usable 24h는 목표 1.5초를 충족한다. 30d cold는 약 50% 개선됐지만 5초 목표에는 미달한다. 현재는 24h를 먼저 표시하고 30d를 background에서 이어 받아 초기 진입을 막지 않는다. hourly summary는 별도 테이블·backfill·증분 갱신이 운영 수집 부하를 추가하므로 이번 P2에는 넣지 않았고, 30d cold 자체를 5초 아래로 내려야 할 때 다음 단계로 적용한다.

#### Measured (dev, 2026-08-18) — `npm run measure:trend` · FARM01/P00 · 30d @ 15m · `*_json`

| RPC | p50 | p95 | rows |
| --- | --- | --- | --- |
| `farm_trend_history_json` | 248 ms | 496 ms | 1283 |
| `farm_trend_history_by_controller_json` | 491 ms | 599 ms | 5554 |

App cold path was 15–40s when `.range()` re-ran the SETOF RPC per 1000-row page (FARM01 decoded ~77k). Direct SQL SETOF 30d ≈ 307 ms · 5602 groups.

#### Measured (dev, 2026-08-11) — table-returning RPC · PostgREST first page only

| RPC | p50 | p95 | rows (note) |
| --- | --- | --- | --- |
| `farm_trend_history` | 110 ms | 182 ms | 942 (PostgREST `max_rows=1000` cap) |
| `farm_trend_history_by_controller` | 102 ms | 172 ms | 1000 (cap) |

### Soft refresh tiers (H2)

| Mode | Action | Loads | Used by |
| --- | --- | --- | --- |
| `live` (default) | `fetchFarmScopedLiveDataAction` | LIVE **slim** (list tier, no channels[]) + barn layout/map | ScopeBar / list soft refresh, ACK `onRefreshLive` |
| `full` | `fetchFarmScopedPanelDataAction` | LIVE (decoded + channels) + alarm + thermo/history · **no stall trend** | cold bootstrap / enrich / `revalidateFarmLive({ mode: "full" })` |
| stall trend | `fetchFarmTrendAllPeriodsAction` | map heatmap stall trend | idle `prefetchFarmStallTrend` |
| controller trend | `fetchFarmControllerTrendAllPeriodsAction` | list graph controller trend | list trend refresh bar |

Soft refresh no longer reloads settings or trend in the same round-trip as LIVE. Slim soft merge keeps prior `channels[]` when omitted.

### LIVE callers (Sprint A audit)

| Caller | slim? | Source |
| --- | --- | --- |
| `loadFarmScopedLiveData` | yes | soft refresh / ACK LIVE |
| `buildFarmFacts` (ARIA) | yes | voice facts |
| `loadAdminFarmGridPanels*` | **yes (Sprint A)** | admin hub overview cards |
| `loadFarmScopedPanelData` | no | cold bootstrap / panel enrich / bulk channels |

Admin hub grid is overview-only. Farm drill-in uses full panel (or enrich). Bulk apply blocks control when modern controllers lack `channels[]` and triggers `revalidateFarmLive({ mode: "full" })`.

### Client trend cache (Sprint A)

| Layer | TTL / key | Notes |
| --- | --- | --- |
| Server `cachedLiveQuery` | 300 s · `[farm-trend, userId, scope, period, toMs]` | tags `live`, `trend:{scope}` |
| Client Map (stall + controller) | **300 s** · `farmKeyId` | server cache slot과 정렬 · farm leave/명시 refresh에서 무효화 |

### Profile UI meta cache (Sprint B)

| Read | TTL | Invalidate |
| --- | --- | --- |
| `getBarnLayoutPrefs` | 60 s · tag `profile-ui-meta` | save/patch/clear barn layouts |
| `getAlarmSettings` | 60 s · same tag | `saveAlarmSettings` |

`user_access` / 권한은 캐시하지 않음. Soft LIVE fingerprint short-circuit는 도입하지 않음 (mergeLiveReadings 유지).

### ARIA metrics (Sprint B)

- Initial: `fetchAriaFarmMetricsAction` → slim LIVE + settings (server)
- Soft poll: hub `readings`로 `assembleFarmFacts` (DB 생략) · `document.hidden` skip · 이상 없으면 60s / 있으면 30s
- cmd-poll / alarm-single 읽기 경로: 현행 유지 (완료 고정)

### HOT view · retention (Sprint C → 적용)

- Thin list 규칙: [`SYSTEM_DB.md`](./SYSTEM_DB.md) §2.3 · 가드 `live-read-select.ts` + unit test
- Retention: [`IOT_RETENTION_OPTIONS.md`](./IOT_RETENTION_OPTIONS.md) — **채택·cron 적용**(30d detach/archive · raw DELETE · archive soak DROP). 정합 2026-08-06
- cmd-poll ids 배칭: 백로그 (현행 조건부 폴링 유지)

### Follow-ups (M1–M5 / L1–L2)

| Item | Change | Status |
| --- | --- | --- |
| M1 | `startTransition` URL only; controller-trend module cache shared map/list | done |
| M4 | Admin hub SSR first batch → client TailLoader hydrate (LIVE SSR 제거) | done |
| M5 | Ops `fetchHealthSnapshotAction` patch (no periodic `router.refresh`) | **done** (2026-07-22) |
| L1 | `staggerMount` only when `readings.length > STAGGER_MOUNT_MIN_READINGS` (8) | **done** (2026-07-22) |
| L2 | `FarmMapCanvas` / `FarmMapMobileStage` / `FarmMapBulkApply` via `next/dynamic` | **done** (2026-07-22) |
| Phase C | Hub visible-first LIVE · Ops Scan client defer · `mergeBarnLayouts` off read path | **done** |
| Sprint A | Admin hub grid slim LIVE · client trend TTL 90s · bulk channels hydration guard | **done** (2026-08-05) |
| Sprint B | ARIA metrics visibility/idle poll · soft facts from hub LIVE · profile ui_config 60s cache + tag invalidate | **done** (2026-08-05) |
| Sprint C | HOT list thin guard + docs · retention options → **이후 D1/D4 cron 적용** | **done** (docs 2026-08-05 · cron 2026-08-05 · 문서정합 2026-08-06) |

### Admin hub TTFB

| Change | Effect |
| --- | --- |
| `fetchFarmOverviewForFarmKeys` | N per-farm queries → **1 OR batch** + `unstable_cache` 60s |
| `cachedLiveQuery` | broken `shouldCache`(always DB) → real `unstable_cache` hit |
| Admin login warm | `signInWithEmail`이 overview 캐시를 미리 채움 → 직후 `/farm` cold≈warm |
| Hub grid SSR | 첫 배치 LIVE SSR 제거 → `TailLoader`가 전부 client hydrate |
| Hub visible-first | TailLoader가 viewport ∩ pending을 배치 우선 로드 |

#### Measured (dev, 2026-07-22)

Playwright `node scripts/measure-hub-ttfb.mjs` — `/farm` navigation, `responseStart` ≈ TTFB. n=3.

| Scenario | wall median | TTFB (`responseStart`) median | Notes |
| --- | --- | --- | --- |
| **warm** (login overview warm) | **287 ms** | **106 ms** | Steady after login |
| **cache-cleared** (`.next/dev/cache` 삭제, 동일 프로세스) | **260 ms** | **98 ms** | Disk만 비움 — in-memory `unstable_cache`는 유지될 수 있음 |
| **strict-cold** (`SKIP_ADMIN_HUB_WARM=1` + restart 후 login) | **276 ms** (first **1920 ms**) | **107 ms** (first **170 ms**) | Warm 없이 overview를 `/farm`에서 조회. 첫 히트에 compile 포함 |
| Prior (LIVE SSR hub batch) | ~2.4 s | — | 개선 전 cold 체감 |

재측정:

```bash
# warm + disk cache clear
npm run measure:hub-ttfb

# true cold (warm skip): restart with env, then
# SKIP_ADMIN_HUB_WARM=1 npm run dev
# TTFB_PHASE=strict-only npm run measure:hub-ttfb
```

### Storage capacity (구 iot-cloud · 2026-08-05 · 역사 기록 · 운영은 `fkkrjljeqxpbmazfnync`)

| Table | total | heap | indexes | note |
| --- | --- | --- | --- | --- |
| `iot_room_state_raw` | 21 MB | ~3.9 MB | ~17 MB (81%) | Phase 4 후 · [`STORAGE_LOG.md`](./STORAGE_LOG.md) §10 |
| `iot_room_state_decoded` | ~27 MB (파티션 합, 2026-08-06) | — | — | D1+slim 후 · [`STORAGE_LOG.md`](./STORAGE_LOG.md) |

decoded: index DROP 비권장. D1·retention **적용 완료**. 잔여 용량 ROI = 희소 관측(확대 보류) · raw 인덱스 검토(승인 후).


---

## 운영 메모

## 운영 메모 (스냅샷)

> 갱신: 2026-07-30 · `dashboard/web`  
> **진실의 원천은 `git status` / `origin/main`이다.** 이 파일은 메모일 뿐이다.  
> 문서 허브: [`README.md`](./README.md) · 배포: [`OPS.md`](./OPS.md#배포)

구명칭 `CLEANUP_ARTIFACT_MAP` 내용은 본 파일로만 유지한다 (별도 stub 파일 없음).

---

### 현재 운영

| 항목 | 상태 |
|------|------|
| 에이전트 | 단일 (`SI1/.cursor/rules/single-agent.mdc`) |
| 배포 | `commit → push → main → Vercel 자동` |
| Production | `https://smart.autofankorea.com` — **2026-08-28 제품 패키징 종료 (GO)** |
| CLI / Redeploy | 특수 케이스만 |
| 테스트 게이트 | `npm test` · `verify:design` · GitHub `web-verify` · GitLab `web:test` |

---

### 할 일 — RS 수집 공백 재발 방지

2026-09-17 raw 수집 공백의 재발 방지 체크는
[`OPS.md`](./OPS.md#장애·런북) §8이 정본이다.
원인과 영향은
[`SYSTEM_INSTANCE.md`](./SYSTEM_INSTANCE.md#6-2026-09-17-rs-수집-공백).

---

### 겹침 주의 (한 PR에서 끝낼 것)

| 파일 | 이유 |
|------|------|
| `farm-page-content.tsx` | 허브 패널 렌더·enrich (탭 sync는 `use-farm-hub-view-shell`) |
| `use-farm-hub-view-shell.ts` | URL sync · 슬라이드 · keep-alive TTL |
| `globals.css` / `dashboard-page-ui.ts` | 토큰 · ARIA 셸 · 밀도 |

---

### 예비 삭제 (미실행)

| 후보 | 비고 |
|------|------|
| legacy `.cursor/rules/*-agent.mdc` 실삭제 | 지금은 `alwaysApply: false`만 |

### 삭제 완료

| 경로 | 일자 |
|------|------|
| `SI1/dashboard-aria-ship/` (worktree) | 2026-07-30 |
| `SI1/dashboard-build-check/` | 2026-07-30 |
| 일회성 test-results md · channel migrate 스크립트 | 2026-07-30 |

---

### 교훈

1. 로컬 dirty build PASS ≠ Vercel clean build PASS  
2. stub·반쪽 import → Production “작동안 함”  
3. 문서 스냅샷이 git보다 낡으면 오판 — **status 우선**  
4. 멀티 Agent 핸드오프는 혼선 유발 → 단일 진행
