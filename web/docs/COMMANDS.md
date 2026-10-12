# 다운링크 명령

현행 패킷은 A/B/C 통합 `0x0D`와 경보 `0x0E`이다. 명령 행 90일 보존·stale sent 24시간은 [`SYSTEM_DB.md`](./SYSTEM_DB.md) §2.8이다.

FARM02 ACK는 원인 가설만 확정됐다. 코드 패치와 실명령 스모크는 아직이다. 증거는 아래 FARM02 부록에 있다.


---

## A/B/C 통합 0x0D

## A/B/C 통합 명령 — 다운링크 v0x0D

> 과거 0x0D 호환 규격입니다. 새 A/B/C·알람 설정은 채널만 변경하더라도 [0x0E 고정 33바이트](#저온·고온-경보-0x0e)를 사용합니다. 아래 29바이트 형식은 이미 등록된 기존 명령 처리용으로 남깁니다.

작성일: 2026-10-07. 펌웨어 담당측 구현을 위한 서버 송신 규격이다. 펌웨어 변경은 이번 작업 범위에 포함하지 않는다.

### 변경 요약

기존에는 채널별 `0x0C` 15바이트 명령을 각각 생성·발행했다. 이제 채널 설정 적용 시 컨트롤러별 DB 명령 1건(`SET_CHANNELS_THERMO`)과 MQTT 패킷 1건을 만든다. A/B/C 어느 항목을 눌러도 전체 채널 편집 화면이 열린다. 변경한 채널만 적용 마스크에 포함한다.

컨트롤러가 서로 다르면 메시지도 별개다. 서로 다른 컨트롤러를 한 패킷에 넣지 않는다. 채널 없는 기존 `SET_CTRL_THERMO` 및 이미 등록된 `SET_CHANNEL_THERMO`는 기존 15바이트 형식을 유지한다.

### 토픽과 전체 길이

```text
sungil/{lsind_regist_no}/{item_code}/cmd

[공통 메타데이터 6B][A 7B][B 7B][C 7B][CRC16 2B] = 29B
```

모든 바이트 위치는 **전체 MQTT payload 시작 기준, 0부터** 센다. payload는 JSON이나 hex 문자열이 아닌 바이너리다. 농장·통신모듈 식별은 기존 토픽과 라우팅 규칙을 따른다.

| 위치 | 길이 | 필드 | 규칙 |
|---|---:|---|---|
| 0 | 1 | 버전 | `0x0D` — 기존 `0x0C`와 구분 |
| 1 | 1 | flags | 현재 `0x00`, 예약 비트 |
| 2 | 1 | 축사 유형 | SP01~SP10 → 1~10 |
| 3 | 1 | 축사 번호 | 1~32 |
| 4 | 1 | 컨트롤러 번호 | 1~10 |
| 5 | 1 | 적용 채널 마스크 | bit0=A, bit1=B, bit2=C; 나머지 0 |
| 6–12 | 7 | A채널 | 아래 채널 구조 |
| 13–19 | 7 | B채널 | 아래 채널 구조 |
| 20–26 | 7 | C채널 | 아래 채널 구조 |
| 27–28 | 2 | CRC16 | Little-endian |

채널 마스크는 1~7이며 0은 허용하지 않는다. A/B/C 전부는 `0x07`, B만은 `0x02`, A/C는 `0x05`다. 마스크에 없는 슬롯은 7바이트 전부 `0xFF`이며 수신측은 해당 채널의 기존 설정을 유지한다. 채널 순서는 항상 A→B→C이고, 일부 채널만 포함하더라도 전체 길이는 29바이트다.

### 채널 블록 — 7바이트

| 블록 내 위치 | 길이 | 필드 | 인코딩·범위 |
|---|---:|---|---|
| 0 | 1 | 장비코드 | EC01~EC99 → 1~99 |
| 1–2 | 2 | 설정온도 | u16 LE, ℃×10, 0~300 |
| 3–4 | 2 | 온도편차 | u16 LE, ℃×10, 5~100 |
| 5 | 1 | 최소환기율 | 0~100% 정수 |
| 6 | 1 | 최대환기율 | 0~100% 정수, 최소 ≤ 최대 |

**다운링크 온도는 500 오프셋을 사용하지 않는다.** 25℃ → 250 (`FA 00`), 편차 2℃ → 20 (`14 00`)이다. 기존 다운링크의 온도 인코딩과 같다. 업링크 raw의 온도 원점 규칙과 구분해야 한다.

### CRC

- CRC16-CCITT-FALSE
- polynomial `0x1021`, init `0xFFFF`, refin/refout=false, xorout=`0x0000`
- 계산 대상: payload의 **0~26번, 총 27바이트**
- 전송 순서: CRC low byte, high byte

### 펌웨어 검증용 예시

주소: SP01 / 축사01 / 컨트롤러03. A/B/C 모두 변경.

| 채널 | 장비 | 설정온도 | 편차 | 환기 |
|---|---|---:|---:|---|
| A | EC01 | 25℃ | 2℃ | 10~100% |
| B | EC02 | 24℃ | 1.5℃ | 20~80% |
| C | EC03 | 23.5℃ | 3℃ | 30~90% |

```text
0D 00 01 01 03 07
01 FA 00 14 00 0A 64
02 F0 00 0F 00 14 50
03 EB 00 1E 00 1E 5A
41 16
```

CRC 수치는 `0x1641`. TypeScript와 Python에서 동일 패킷을 검증했다.

수신측은 길이·버전·flags·마스크·주소·CRC·선택 채널의 장비코드와 값 범위를 검증한 후 적용해야 한다. CRC 오류 또는 유효하지 않은 선택 채널이 있으면 전체 명령을 거부하는 규칙을 권장한다. 적용 채널 중 하나만 바뀌어도 서버는 전체 명령 완료로 판정하지 않는다.

### 반영 확인·재전송

- 한 패킷 발행 후 최대 60초 대기, 3초 간격 상태 확인.
- 미확인 시 **같은 전체 패킷 1회 재전송**, 다시 최대 60초 대기.
- `sent_at` 이후 수신한 LIVE에서 **마스크에 포함된 모든 채널의 네 설정값**이 일치해야 `applied`.
- 일부 채널 일치·채널 누락·다른 장비코드·이력 raw만으로는 완료하지 않는다.
- 재전송은 중복 도착할 수 있으므로 동일 값 재적용이 안전해야 한다. 패킷에 명령 UUID나 순번은 포함하지 않는다.
- TTL은 기존 생성 후 300초 정책을 유지한다. 발행 전 DB 대기 명령의 TTL이며 MQTT 메시지 만료 필드가 아니다.
- 기존 MQTT QoS=1, retain=true 설정을 유지한다. 재접속 시 retained 명령이 전달될 수 있다.

### 서버 저장·배포

`ctrl_thermo_command` 한 행에 `action=SET_CHANNELS_THERMO`, `channel=NULL`, `eqpmn_code=NULL`로 저장한다. `payload_json.command_channels`에 선택한 채널의 camelCase 값을 넣는다. 기존 NOT NULL 설정 컬럼에는 첫 선택 채널 값을 호환용으로 저장하며, 새 명령의 실제 소비·판정은 반드시 `command_channels`를 사용한다. 전송 후 `payload_json`에는 같은 채널 데이터와 `wire_hex` 등 감사 정보가 남는다.

DB migration은 `supabase/migrations/20261007043332_combined_channel_command.sql`. 기존 RLS와 구형 명령은 유지한다.

AWS 운영 저장소의 기존 미커밋 변경을 보존하기 위해 이번 추가분을 `ops/rsd/combined-channel-command.patch`로 기록했다. 적용 기준은 조사 당시 운영 파일이며, 범용 Git HEAD에 무조건 적용하는 패치가 아니다. 재적용 전 파일·패치 검증이 필요하다. 회귀 검증용 Python 테스트는 같은 디렉터리의 `test_combined_command.py`다.

### 범위

이번 변경은 A/B/C 제어 설정 통합이다. raw의 저온·고온 알람 기준값 소비 및 알람값 전송은 포함하지 않는다. 펌웨어 구현·실제 장비 적용 검증은 담당측 작업이며, 서버 테스트에서 실제 장비 명령을 발행하지 않았다.


경보 포함 확장 명령은 [COMMANDS.md](#저온·고온-경보-0x0e)의 0x0E 33바이트를 참고하세요. 채널 전용 0x0D는 그대로 유지합니다.


---

## 저온·고온 경보 0x0E

## 저온·고온 경보 명령 프로토콜 (0x0E)

화면의 사용자 프로필 알림 상·하한은 사용하지 않습니다. 컨트롤러 raw의 `alarmLowTempC`, `alarmHighTempC`를 현재 경보값으로 표시하고, 수정값은 `SET_CONTROLLER_SETTINGS` 명령으로 전송합니다. 경보는 A/B/C 공통이며 습도 사용자 알림은 제거했습니다. 기존 프로필 데이터는 보존하되 조회·저장·판정에 사용하지 않습니다.

### MQTT 패킷

- Topic: `sungil/{lsind_regist_no}/{item_code}/cmd`
- Payload: 바이너리 **33바이트**. JSON은 DB 감사 기록용입니다.
- 버전: **0x0E**. 새 A/B/C·알람 설정은 채널만 변경하더라도 모두 고정 33바이트입니다. 이미 등록된 0x0C(15B), 0x0D(29B)와 채널 정보가 없는 레거시 컨트롤러 명령은 호환 경로를 유지합니다.
- UI 경보 개별 적용: 채널 마스크 0, 경보만 적용합니다.
- 일괄 적용에서 채널+경보를 함께 선택: 컨트롤러마다 A/B/C+경보를 하나의 0x0E 패킷으로 보냅니다.

오프셋은 **0부터 시작**, 16비트 필드는 **Little-endian**입니다.

| 오프셋 | 크기 | 필드 | 값/의미 |
|---|---:|---|---|
| 0 | 1 | Version | `0x0E` |
| 1 | 1 | Flags | `0x00`=경보 미적용, `0x01`=저온·고온 쌍 적용. 나머지 비트=0 |
| 2 | 1 | 축사유형 | SP01~SP10 → 1~10 |
| 3 | 1 | 축사번호 | 1~32 |
| 4 | 1 | 컨트롤러번호 | 1~10 |
| 5 | 1 | Channel mask | A=bit0, B=bit1, C=bit2. 경보만 변경하면 0 |
| 6~12 | 7 | A 블록 | 기존 0x0D와 같은 위치/형식 |
| 13~19 | 7 | B 블록 | 기존 0x0D와 같은 위치/형식 |
| 20~26 | 7 | C 블록 | 기존 0x0D와 같은 위치/형식 |
| 27~28 | 2 | 저온 경보 | uint16, ℃×10. Flags=0이면 `FF FF` |
| 29~30 | 2 | 고온 경보 | uint16, ℃×10. Flags=0이면 `FF FF` |
| 31~32 | 2 | CRC16 | 바이트 0~30 대상, CRC16/CCITT-FALSE, LE |

채널 블록: `[EC 코드 1B][설정온도×10 2B][온도편차×10 2B][최저환기 1B][최고환기 1B]`.
마스크가 꺼진 블록은 `FF` 7바이트이며 **적용하지 않습니다**. 경보만 변경할 때 A/B/C 21바이트는 전부 FF입니다. 컨트롤러 공통 경보를 각 채널에 중복 적용하지 않습니다.

Flags=0이면 바이트 27~30은 `FF FF FF FF`이며 경보값으로 해석·적용·반영 비교하지 않습니다. 필드를 생략하거나 패킷을 줄이지 않습니다. CRC에는 미적용 FF 영역도 포함합니다. Flags=0, mask=0은 변경 대상이 없으므로 서버·DB에서 거부합니다.

| 적용 대상 | Flags (byte 1) | 채널 마스크 (byte 5) | 미적용 영역 |
|---|---|---|---|
| A만 | `00` | `01` | B/C 블록과 경보 4B=FF |
| B만 | `00` | `02` | A/C 블록과 경보 4B=FF |
| C만 | `00` | `04` | A/B 블록과 경보 4B=FF |
| A/B/C만 | `00` | `07` | 경보 4B=FF |
| 경보만 | `01` | `00` | A/B/C 블록=FF |
| B+경보 | `01` | `02` | A/C 블록=FF |
| A/B/C+경보 | `01` | `07` | 없음 |

마스크 `03`=A/B, `05`=A/C, `06`=B/C도 동일 규칙입니다. 선택한 채널은 7바이트 블록 전체를 전송하고, 경보를 변경하면 저온·고온 쌍 전체를 전송합니다.

CRC: polynomial `0x1021`, initial `0xFFFF`, refin=false, refout=false, xorout=`0x0000`. CRC 저장은 하위 바이트 먼저입니다.

### 값 규칙

- 경보 입력: **0~100℃**, **0.1℃ 단위**, **저온 < 고온**. 화면·서버 액션·DB·AWS 인코더에서 같은 규칙으로 검증합니다.
- 예: 10℃ → 100 → `64 00`, 43.6℃ → 436 → `B4 01`.
- 다운링크는 **500 오프셋을 더하지 않습니다**. 기존 raw 업링크 온도 인코딩과 구별해야 합니다.
- 채널 설정 규칙은 이전과 같습니다: 설정온도 0~30℃, 편차 0.5~10℃(각 0.1 단위), 환기 0~100%(정수), 최저≤최고, EC01~EC99.
- raw 업링크 프로토콜과 경보 필드 위치는 변경하지 않습니다. 이번 변경은 다운링크 확장과 소비 경로 변경입니다.

### 기준 패킷

SP01 / 축사01 / 컨트롤러03, 저온10℃ / 고온43.6℃:

경보만 변경 (mask=0, CRC=`0x546D`):
```
0e0101010300ffffffffffffffffffffffffffffffffffffffffff6400b4016d54
```

A/B/C+경보 (mask=7, CRC=`0xCC2D`):
- A EC01: 설정25℃, 편차2℃, 환기10~100%
- B EC02: 설정24℃, 편차1.5℃, 환기20~80%
- C EC03: 설정23.5℃, 편차3℃, 환기30~90%
```
0e010101030701fa0014000a6402f0000f00145003eb001e001e5a6400b4012dcc
```

B만 변경 (Flags=0, mask=2, CRC=`0x9A3B`, 값은 위 B와 동일):
```
0e0001010302ffffffffffffff02f0000f001450ffffffffffffffffffffff3b9a
```

`ops/rsd/fixed-0e-vectors.json`의 유효한 플래그·마스크 15개 조합은 TypeScript/Python 테스트에서 동일 hex·길이·CRC를 검증합니다.

### 반영 확인 / UI

- 2026-10-08 실패 복구: 실패 행은 클릭 잠금을 즉시 해제하고 작은 실패 아이콘으로 표시합니다. 패널 안내의 ‘다시 설정’으로 통합카드를 열 수 있습니다. 실패 명령 대상 입력은 마지막 raw 수신값으로 복원하며 수신 시각을 표시합니다. ‘이전 요청값 불러오기’는 편집값만 복원하고 자동 전송하지 않습니다. 수정·확인 후 ‘변경값 적용’으로 새 명령을 생성합니다. 새 명령이 등록되면 이전 실패 안내는 종료합니다. 통신 지연 중에도 설정 열기·편집은 허용하고 전송 가능 여부는 기존 연결·권한 검증을 유지합니다.
- `ack timeout`은 ‘반영 확인 시간 초과’로 표시합니다. 장비 미적용을 단정하지 않으며, MQTT·네트워크 전송 오류와 구분합니다. 명령 등록 자체가 실패한 경우에는 기존 입력 유지 정책을 적용합니다.

- 상태: `pending` → `sent` → `applied` 또는 `failed`.
- 동일 농장·모듈·컨트롤러에서 **sent_at 이후 수신한 LIVE raw**를 비교합니다. Flags=1이면 저온/고온 값이 요청과 일치해야 applied입니다(허용오차 0.05℃). Flags=0이면 경보값은 비교하지 않습니다.
- 함께 선택한 모든 채널의 EC 코드와 설정값도 일치해야 합니다. 일부 채널 일치나 이전 raw로 완료 처리하지 않습니다.
- 장비 수신값과 전송 입력값을 분리합니다. 전송 중·패널 재진입에는 접수된 값을 유지하지만, 명령 적용 실패 시 해당 채널·경보 입력을 최신 raw 수신값으로 되돌리고 상세 LIVE를 재조회합니다. 다른 채널의 미전송 편집은 유지하며, 실패 이후 다시 편집할 수 있습니다. 경보 명령의 호환용 DB thermo 컬럼은 채널 설정에 표시/적용하지 않습니다.
- 컨트롤러 내 접수/전송/확인 3단계를 사용합니다. 중앙 로딩 카드는 추가하지 않습니다.
- 덮개의 경보 전송 진행 라벨은 ‘알람’입니다. A/B/C 또는 경보 행을 누르면 같은 ‘채널 · 알람 설정’ 카드가 열립니다. 표에서 값을 선택하고 하단 공용 −/+ 스테퍼(직접 입력·길게 누르기 지원)로 편집합니다. ‘변경값 적용’ 하나로 확인 후 컨트롤러당 0x0E 33바이트 한 건을 보냅니다. 변경된 채널 블록만 마스크에 넣으며, 알람은 변경 시 저온·고온 쌍으로 전송합니다.
- 경보값 미수신: ‘경보값 미수신 / 환경 확인 필요’. 임의의 기본값으로 정상 판정하지 않습니다.
- 습도 측정값은 유지하며, 사용자 습도 알림 및 생육 권장 판정은 제거합니다.
- 집계 차트/일보의 장비 경보 가이드는 모든 대상의 경보값이 같을 때만 표시합니다. 다른 값은 평균내지 않습니다. 현재 기준을 과거 경보 이력으로 해석하지 않습니다.
- 대기 TTL=300초, 메시지별 ACK 대기=60초, 재시도1회 정책은 유지합니다. TTL은 DB 대기명령 유효시간이며 이번 패킷에 들어가지 않습니다.
- 펌웨어 수정은 범위 밖입니다. 펌웨어 담당자가 0x0E 수신·적용을 구현한 뒤 실제 장비 왕복 확인이 필요합니다. 테스트용 명령을 실제 MQTT에 발행하지 않았습니다.

### 적용 / 검증

- 2026-10-08 고정 패킷 전환: `20261007073914_fixed_0e_optional_alarm.sql`을 운영 DB에 적용했습니다. 채널만 변경하는 `SET_CONTROLLER_SETTINGS`를 허용하고 무변경·명시적 null 경보·잘못된 채널 배열을 거부합니다. SQL 제약조건 테스트는 롤백했습니다.
- AWS 변경 파일: `wire_command.py`, `command_ack.py`. 재현 패치: `ops/rsd/fixed-0e-command.patch` (기존 장비 경보 패치 적용본 기준). 백업: `/home/ubuntu/SI1/ec2_v2/rs/backups/fixed-0e-20261008`. 두 서비스 재시작 후 active 확인.
- Python 관련 테스트 28건 통과, AWS 사전 검사 17건 통과. MQTT 발행과 DB 반영은 테스트 더블로 대체하여 실제 테스트 명령은 발행하지 않았습니다.
- 보안 advisor에는 기존 뷰·함수·테이블 관련 항목이 남아 있습니다. 이번 함수는 SECURITY INVOKER 및 고정 search_path를 유지하며 해당 경고 대상에 포함되지 않습니다.

- 운영 DB: `fkkrjljeqxpbmazfnync`. 이전 명령 마이그레이션은 다른 프로젝트에 적용됐으므로 운영 적용 기록으로 사용하지 않습니다.
- 운영 DB migration: `20261007054030_reconcile_operating_alarm_commands.sql`. 누락된 0x0D/0x0E 검증과 목록 경보 컬럼을 함께 설치하며, 소수 경보값의 정규식도 수정합니다. 기존 마이그레이션 뒤에도 적용 가능합니다.
- 2026-10-07 운영 검증: 목록 15건의 경보값과 같은 decoded 행의 값 불일치 0건, authenticated 역할 조회 15건 모두 경보값 포함, AWS REST 조회 HTTP 200(10.0/43.6 소수값 포함).
- `supabase/tests/operating_alarm_commands.sql`: 0x0D/0x0E 정상·범위·정밀도·중복채널 검증과 실제 테이블 제약조건 검증 통과. 테스트 트랜잭션은 롤백하며 MQTT 명령을 남기지 않습니다.
- AWS: rescue-ubuntu-root의 `/home/ubuntu/SI1/ec2_v2/rs` C.py / wire_command.py / command_ack.py 적용
- 운영 백업: `/home/ubuntu/SI1/ec2_v2/rs/backups/device-alarm-20261007050143`
- 운영 서비스 rsd-c / rsd-rs active, NRestarts=0
- Python 테스트 36건 통과; 프론트엔드 단위 테스트 77개 파일 통과; PC/모바일 합성 화면에서 입력 유지·재진입·실패·통신/환경 분리를 검증
- 실제 운영 raw에서 경보값(10 / 35, 10 / 43.6)을 확인


---

## 부록 — Phase A 관측

## ctrl_thermo_command — Phase A 관측 (2026-08-06)

> **범위:** 읽기 전용 · DELETE/cron 없음  
> **Canvas:** `ctrl-thermo-command-phase-a.canvas.tsx`  
> **다음:** Phase B 보관·`sent` TTL 정책 합의

---

### A1 · Status 분포

| status | n | % | older 7d | older 30d |
|--------|---|---|----------|-----------|
| applied | 1828 | 90.7% | 1501 | 0 |
| sent | 182 | 9.0% | 0 | 0 |
| cancelled | 5 | 0.2% | 5 | 0 |
| pending / failed | **0** | — | — | — |

CHECK 허용: `pending|sent|applied|failed|cancelled` — 실데이터는 뒤 세 값(+미사용 pending/failed).

총 **2015행** · ~1.9 MB · 기간 2026-07-14 ~ 08-06.

### A1 · `sent` 체류 (stale)

| 지표 | 값 |
|------|-----|
| sent_n | 182 (전부 `sent_at` 있음) |
| avg / p50 / p90 / max 연령 | **91.7h / 44.2h / 161.7h / 161.7h** |
| ≥1h / ≥24h / ≥48h | **182 / 182 / 80** |
| `ttl_sec` | 전부 **300** (5분) — C 전송 창 · **DB 자동 cancel 없음** |

→ TTL(5분)을 훨씬 지난 **좀비 sent**. ACK(`command_ack`: LIVE thermo 일치 → applied) 미발생.

농장별 sent: FARM01 **125** · FARM02 **57** (FARM02는 applied **0** — 전량 sent만).

### A2 · action · 일별

| action | n |
|--------|---|
| SET_CHANNEL_THERMO | 1694 |
| SET_CTRL_THERMO | 321 |

| day KST | n | applied | sent | cancelled |
|---------|---|--------|------|-----------|
| 07-24 | 1204 | 1199 | 0 | 5 | QA 스파이크 |
| 07-30 | 250 | 200 | 50 | 0 |
| 07-31 | 30 | 0 | 30 | 0 |
| 08-04 | 195 | 100 | 95 | 0 |
| 08-05 | 34 | 27 | 7 | 0 |
| 08-06 | 25 | 25 | 0 | 0 |

### A3 · 상태 사전

| status | 의미 |
|--------|------|
| pending | (스키마 허용) 미전송 대기 — 현재 미사용 |
| sent | C가 MQTT/전송 완료 · applied 대기 |
| applied | uplink thermo가 명령값과 일치 (D/command_ack) |
| failed | (스키마 허용) 전송/적용 실패 — 현재 미사용 |
| cancelled | 취소 |

전이: insert → **sent** → **applied** · 또는 **cancelled**.

### A4 · 소비자 맵

| 소비자 | 창/limit | 비고 |
|--------|----------|------|
| 적용 API · ACK 폴링 | 단건 id | `controllers/actions.ts` |
| 명령 이력 UI | limit **20** | `commands.ts` |
| thermo settings map | limit **500** | LIVE fallback |
| Health C 그래프 | **24h** | `fetch-command-health` |
| EC2 C.py | pending/sent poll | downlink |
| command_ack | sent → applied | RS raw 경로 |
| health_command_checkpoint | FK CASCADE | 실패 검수 |

### Phase A 결론 (정책 제안용 · 미확정)

1. **용량:** 30일 초과 0 · 당장 DELETE 급하지 않음.  
2. **위생:** `sent` 182건은 TTL 5분 대비 **전원 ≥24h stale** → Phase B에서 **expired/cancelled 정리** 검토 가치 큼 (삭제보다 상태 전이 권장).  
3. **FARM02:** applied 0 · sent만 → ACK/시뮬/실장비 정합 별도 점검.  
4. **보관:** B0 관측 유지 가능 · HOT 90일 등은 Phase B 합의.


---

## 부록 — Phase C 적용

## ctrl_thermo_command — Phase C (C1+C2 적용)

> **전제:** Phase B **P1 확정** (2026-08-06)  
> **C1·C2 적용일:** 2026-08-06 (구 `iot-cloud`) · **현재 운영 DB:** `fkkrjljeqxpbmazfnync` (구 프로젝트 폐기)

---

### 1. 목적

- stale `sent` (≥24h) → `cancelled` + 사유 `stale_sent_24h` (소급 + 일 1회)
- HOT `applied`/`cancelled` **90일** 초과 → hard DELETE (배치 + 일 1회)

### 2. C1 적용 결과

| 항목 | 결과 |
|------|------|
| dry-run | 182건 (FARM01 125 / FARM02 57) |
| 함수 | `public.cancel_stale_thermo_sent(age_hours default 24)` SECURITY DEFINER |
| 소급 1회 | `cancelled: 182` |
| 재실행 | `cancelled: 0` (멱등) |
| cron | `cancel-stale-thermo-sent-daily` · `0 19 * * *` UTC · jobid 8 |
| 적용 후 분포 | applied 1828 · cancelled 187 · **sent 0** |
| C.py | `status=eq.pending`만 poll → cancelled 재전송 없음 |

### 3. C2 적용 결과

| 항목 | 결과 |
|------|------|
| dry-run 90d | **0건** (oldest ≈ 2026-07-14) |
| 함수 | `public.cleanup_ctrl_thermo_hot(retention_days default 90, batch_limit default 5000)` |
| 1회 실행 | `deleted: 0` |
| cron | `cleanup-ctrl-thermo-hot-90d-daily` · `15 19 * * *` UTC · jobid 9 |
| FK | `health_command_checkpoint.command_id` **ON DELETE CASCADE** |
| 대상 외 | `pending` / `sent` / `failed` 삭제 안 함 |

### 4. 파일

| 구분 | 경로 |
|------|------|
| C1 migration | `supabase/migrations/20260806110000_ctrl_thermo_cancel_stale_sent.sql` |
| C2 migration | `supabase/migrations/20260806111500_ctrl_thermo_cleanup_hot_90d.sql` |
| 정책 | [`SYSTEM_DB.md`](./SYSTEM_DB.md) §2.8 |

### 5. 영향

| 영역 | 영향 |
|------|------|
| DB | C1 UPDATE · C2 DELETE(HOT만) · RLS 유지 |
| C.py | pending만 조회 · 변경 불필요 |
| UI/Health | cancelled 표시 · 90일 후 HOT 이력 소실(의도) · checkpoint CASCADE |
| Edge | 불필요 |

### 6. 롤백

```sql
SELECT cron.unschedule('cancel-stale-thermo-sent-daily');
SELECT cron.unschedule('cleanup-ctrl-thermo-hot-90d-daily');
-- DROP FUNCTION public.cancel_stale_thermo_sent(integer);
-- DROP FUNCTION public.cleanup_ctrl_thermo_hot(integer, integer);
-- 소급 cancelled / 이미 DELETE된 HOT 행 복구는 비권장
```


---

## 부록 — 키·인덱스

## ctrl_thermo_command — P0/P1 키·인덱스 (적용)

> **적용일:** 2026-08-06 · 구 `iot-cloud` (현재 운영은 `fkkrjljeqxpbmazfnync` · 구 프로젝트 폐기)  
> **판단:** J1=A, J2=A, J3=A, J4=A, J5=DROP `idx_ctrl_thermo_command_target`, J6=A(앱 select 미변경), J7=B  
> **migration:** `supabase/migrations/20260806120000_ctrl_thermo_keys_and_indexes.sql`

### P0 생성 컬럼

| 컬럼 | 규칙 |
|------|------|
| `controller_key` | `{stall_ty}:{stall_no}:{eqpmn_no}` |
| `channel_key` | `{controller_key}\|{CHANNEL}\|{EQPMN_CODE}` · SET_CTRL은 NULL |

소스 오브 트루스 = 기존 stall/channel 컬럼. LIVE·`command_ack`와 동일 문자열.

### P1 인덱스

| 인덱스 | 용도 |
|--------|------|
| `idx_ctrl_thermo_command_sent_at` | sent 부분 · ACK/stale |
| `idx_ctrl_thermo_command_address` | 농장+실주소 이력 |
| `idx_ctrl_thermo_command_channel_key` | 채널 키 조회 |
| `idx_ctrl_thermo_command_controller_key` | 컨트롤러 키 조회 |
| ~~`idx_ctrl_thermo_command_target`~~ | **DROP** (ctrl_idx 레거시) |

### 검증 (적용 직후)

- `controller_key` NULL = 0  
- `channel_key` non-null ≈ SET_CHANNEL 건수  
- SET_CTRL → `channel_key` NULL  

### 앱 노출 (J6=B · 2026-08-06)

- `THERMO_COMMAND_SELECT`에 `controller_key`, `channel_key` 포함
- `mapThermoCommandRow`는 DB `controller_key` 우선 · `channelKey` 매핑
- Health C select·`targetLabel`에 키 우선 표시
- UI 대상 라벨에 채널 슬롯 표시 (`formatCommandTarget`)


---

## 부록 — FARM02 ACK

## FARM02 ACK 점검 (읽기 전용 · 2026-08-06)

> **상태:** 원인 가설 확정(증거 있음) · 코드 패치/실명령 스모크는 **미실행**  
> **관련:** Phase A `applied 0` · C1로 과거 sent 57건 → `cancelled(stale_sent_24h)`

---

### 증상

| 항목 | FARM01 | FARM02 |
|------|--------|--------|
| `applied` | 1828 | **0** (전 기간) |
| `cancelled` | 130 (그중 stale 다수) | **57** (전부 과거 sent→C1) |
| `sent` 현재 | 0 | 0 |
| LIVE `v_iot_decoded_latest` | 수신 중 (예: 2026-08-06) | **last_rx ≈ 2026-08-04 23:01** · 행 2건만 |

대상 장비: MOD-1 · SP07:01:01 / SP07:01:02 · 채널 A/B/C · 전부 `SET_CHANNEL_THERMO` · `eqpmnCode=EC15`.

---

### 증거 (매칭 실패 ≠ 키 버그)

명령 예 (sent 후 stale cancel):

- setpoint **24.0** · deviation **3.5~7.0** · minVent **25** · maxVent **75~95**
- payload에 `wire_hex` 존재 → **C.py는 전송까지 완료** (가설 A 약함)

동일 시점 전후 LIVE thermo (SP07):

- setpoint **52~75** · deviation **~55** · minVent **25** · maxVent **100**
- `eqpmnCode` **EC15** → ACK 키 형식(`SP07:01:xx|A|EC15`)과 **일치**

→ `command_ack.thermo_matches_command` 기준이면 **값 불일치로 applied 불가** (가설 B/D 중 **B: 장비가 명령값을 반영하지 않음**이 주원인).

추가:

- 마지막 LIVE **23:01** 이후에도 명령이 **23:53**까지 전송됨 → 이후에는 uplink 자체가 없어 ACK 경로 단절.
- FARM02 LIVE가 **약 2일 정지** → 현재도 ACK 검증 불가(신규 스모크 전 수신 복구 필요).

---

### 가설 판정

| ID | 내용 | 판정 |
|----|------|------|
| A | downlink 미도달 / C 미전송 | **낮음** (payload·sent_at·wire 존재) |
| B | 전송됐으나 장비/시뮬이 값 미반영 | **주원인** (LIVE≪명령값) |
| C | 키/채널 불일치로 fetch 실패 | **낮음** (EC15·SP07 정합) |
| D | 스케일/필드 오차만 | **부분** — 편차가 커서 단순 반올림 이슈 아님 |

코드상 channel 명령은 exact key만 보고 fallback 없음(`find_thermo_for_command`) — 이번 케이스에서는 키가 맞아 **패치 우선순위 아님**.

---

### Health C / 이력 스모크 (데이터·코드)

| 체크 | 결과 |
|------|------|
| 전역 `sent` | **0** → `c.cmd.sent_stuck` critical 잔존 없음 |
| 24h 창 | **applied 25만** (FARM01) · cancelled/stale는 창 밖 |
| `classifyCommandFailure` | `cancelled`는 실패 아님 → stale를 “sent 미 applied”로 안 올림 |
| 최신 이력 20 | FARM01 `applied` 위주 |

브라우저 Prod 로그인 스모크는 미실시(인증 필요). 데이터 기대값은 위와 일치.

---

### 다음 (승인 후)

1. FARM02 **uplink 복구** 확인 (RS/시뮬/현장) — last_rx가 오늘로 올 것  
2. 복구 후 **실명령 1건** 스모크 (setpoint 소폭) → sent→applied 여부  
3. 여전히 미반영이면 **현장/시뮬 제어 경로** 이슈로 이관 (대시보드 ACK 코드 변경 보류)

---

### 재확인 (2026-08-06 · 승인 1번)

| 항목 | 결과 |
|------|------|
| LIVE last_rx | 여전히 **2026-08-04 ~23:01** (age ≈ **1d 3h**) |
| raw | `last_raw` 동일 시각 · **08-04 이후 신규 패킷 없음** (48h 창에 과거분 141행만) |
| 실명령 1건 | **미실행** (수신 복구 전제 미충족 · 무의미한 downlink 방지) |
