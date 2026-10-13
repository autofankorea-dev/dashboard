# 인수인계 — 시스템 한 장

운영 DB `fkkrjljeqxpbmazfnync`. 화면 `https://smart.autofankorea.com`. 코드가 이 그림보다 우선이다.

그림은 질문마다 하나다. 선은 그 프로토콜이 끝나는 두 점만 잇는다.

---

## 1. 배선 — 무엇이 무엇에 꽂혀 있나

```text
BLDC 모터 ──RS-485── SL802B ──RS-485── SL9001 ──LAN TCP/IP── 라우터
   환기         컨트롤러         통신모듈              농장 LAN의 출구
```

측정과 명령은 이 선을 양방향으로 탄다. SL9001이 SL802B를 RS-485로 순차 읽고, 한 대 읽을 때마다 업링크 1건이 된다. 모듈당 최대 48대. 화면과 DB의 컨트롤러 키는 SL802B이다.

| 장비 | 문서의 이름 | 선 |
|------|-------------|-----|
| BLDC 모터 | 환기 구동 | 입출력 RS-485 |
| SL802B | 컨트롤러 | 입출력 RS-485 |
| SL9001 | 통신모듈 | 컨트롤러 쪽 RS-485, 라우터 쪽 LAN TCP/IP |
| 라우터 | 현장 LAN의 출구 | 3계층에서 패킷만 넘긴다. MQTT·HTTPS를 끝내지 않는다 |

---

## 2. 세션 — 대화의 양 끝은 어디인가

라우터와 인터넷은 세션 상자가 아니다. SL9001과 Mosquitto 사이, RS.py·화면과 Supabase 사이에 놓인 경로다.

```text
SL9001 ════ MQTT/TCP/IP QoS 1 ════ Mosquitto · RS.py
         topic sungil/{농장}/{축종}/raw
                                      │
                                 HTTPS/TCP/IP
                                 raw INSERT
                                      │
화면 ════ HTTPS/TCP/IP ════ Supabase · decode-batch
         뷰 조회 · 명령 INSERT
                                      │
                                 C.py 가 명령 행을 읽음
                                      │
                                 MQTT/TCP/IP QoS 1
                                 topic …/cmd
                                      │
                                   Mosquitto ════ SL9001
```

화면과 EC2 사이에는 세션이 없다. 둘은 Supabase에서만 만난다. Next.js는 wire를 해석하지 않고 MQTT를 직접 쏘지 않는다. 해석은 DB 안의 Edge `decode-batch`(약 10초)이다.

목록·카드는 최근 2시간 스칼라만 읽는다. 차트는 30일 RPC를 읽는다. 명령 행은 적용·취소 후 90일이고, `sent`가 24시간 지나면 취소로 정리된다. 기준은 [`SYSTEM_DB.md`](./SYSTEM_DB.md) §2.3 · §2.8이다.

측정은 위 세션을 위에서 아래로 지난다.

1. BLDC 모터와 SL802B, SL802B와 SL9001이 RS-485로 상태를 주고받는다.
2. SL9001이 MQTT `…/raw`를 Mosquitto에 발행한다. RS.py가 구독해 `iot_room_state_raw`에 HTTPS로 넣는다.
3. `decode-batch`가 해석하고, 화면이 HTTPS로 뷰를 읽는다.

명령은 같은 세션을 거꾸로 지난다.

4. 화면이 `ctrl_thermo_command`를 HTTPS로 INSERT한다.
5. C.py가 그 행을 읽어 MQTT `…/cmd`로 `0x0D` 또는 `0x0E`를 발행한다.
6. SL9001이 RS-485로 SL802B에 전하고, SL802B가 RS-485로 BLDC 모터에 전한다. ACK는 다시 `…/raw`로 올라오고, 화면이 접수·전송·확인을 갱신한다.

---

## 3. 변경 — 코드를 어디서 바꾸나

| 대상 | 관리 | 하는 일 |
|------|------|---------|
| 수집 EC2 | Git 없음. SSH 접속과 에이전트 | `rsd-rs`가 raw를 넣고, `rsd-c`가 명령을 내린다 |
| 저장 | Supabase `fkkrjljeqxpbmazfnync` | raw를 해석하고, 목록·차트·명령 행을 보관한다 |
| 화면 | `dashboard` Git → Vercel | 뷰를 읽고 명령을 넣는다. 운영자가 보는 화면이다 |

수집 장애와 화면 배포는 따로 나간다. 상태 확인은 SSH 없이 `/admin/ops` Health로 한다.

---

## 4. 내부 — 대분류 안은 무엇으로 나뉘나

§2의 EC2·DB·화면을 연 그림이다. 잎이 그 중분류의 핵심이다. 현장 장비는 §1이다.

```text
EC2
├─ Mosquitto      QoS 1. sungil/{농장}/{축종}/raw|cmd|epoch. 농장 식별은 토픽
├─ rsd-rs         sungil/+/+/raw → topic · payload_bytea · received_at
├─ rsd-c          pending → …/cmd → sent. 전송 창 300초. 적용은 다음 raw
└─ health check   mqtt·rs·c·mem·disk → instance_health_current. 10분 주의 · 30분 미상

DB
├─ 적재           iot_room_state_raw. 트리거가 토픽에서 농장·축종을 채움
├─ 해석           decode-batch 약 10초. 월 파티션 mesure_at. FARM02·03은 −9h
├─ 읽기           2시간 list(스칼라)·latest(채널). 차트는 30일 RPC
├─ 명령           ctrl_thermo_command. 0x0D · 0x0E 33바이트. 90일 · sent 24h
├─ 신원           admin · operator · viewer. can_read · can_command. user_can_read_farm
├─ 운영           헬스는 service_role. KST 03:00–03:50 cron. 측정 30일
└─ 알림           push-dispatch FCM. 센서 경로와 분리. 인증은 cron_secret

화면   app → components → lib
├─ app                  라우트 · Server Action. /farm 허브. 명령은 pending INSERT
├─ components           UI와 그 화면의 hook
├─ lib/data             서버가 뷰·RPC. 농장 500 · 전체 1500 · 캐시 300초. 브라우저는 data/browser
├─ lib/domain           수신 15분 정상 · 60분 주의 · 그 밖 통신두절. 키 · 차트 · 공유 타입
├─ 기능 폴더            farm URL · controllers wire · admin 헬스 · report PDF
├─ lib/auth · supabase  프로필과 user_access. 쿠키 세션 · service_role은 헬스
└─ lib/ui · navigation  토큰 · 모바일 레이아웃 · 전역 스토어
```

해석에서 축사유형이 1–10 밖이면 `iot_room_state_decode_failed`로 빠진다. 수신이 살아 있어도 측정이 60분 넘으면 화면은 주의로 내린다. 기능 폴더의 나머지는 `geo` · `monitoring` · `onboarding` · `push` · `app-install`이다.

---

## 5. 막히면 여는 문서

| 증상 | 정본 |
|------|------|
| 수집이 비거나 MQTT·EC2가 의심될 때 | [`SYSTEM_INSTANCE.md`](./SYSTEM_INSTANCE.md) |
| 목록 값·HOT 뷰·명령 행 보관 | [`SYSTEM_DB.md`](./SYSTEM_DB.md) |
| 배포, CI, 장애 순서 | [`OPS.md`](./OPS.md) |
| `/farm` URL, 환경 상태 | [`farm-hub-url.md`](./farm-hub-url.md) |
| 화면을 어떻게 쓰는지 | [`user-manual/README.md`](./user-manual/README.md) |

패킷 바이트, 테이블 전체, UI 토큰은 이 장에 두지 않는다. 업링크는 [`protocol/데이터폼.md`](./protocol/데이터폼.md), 다운링크는 [`COMMANDS.md`](./COMMANDS.md), 앱 내부 계층은 [`SYSTEM_APP.md`](./SYSTEM_APP.md)이다.
