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

## 4. 막히면 여는 문서

| 증상 | 정본 |
|------|------|
| 수집이 비거나 MQTT·EC2가 의심될 때 | [`SYSTEM_INSTANCE.md`](./SYSTEM_INSTANCE.md) |
| 목록 값·HOT 뷰·명령 행 보관 | [`SYSTEM_DB.md`](./SYSTEM_DB.md) |
| 배포, CI, 장애 순서 | [`OPS.md`](./OPS.md) |
| `/farm` URL, 환경 상태 | [`farm-hub-url.md`](./farm-hub-url.md) |
| 화면을 어떻게 쓰는지 | [`user-manual/README.md`](./user-manual/README.md) |

패킷 바이트, 테이블 전체, UI 토큰은 이 장에 두지 않는다. 업링크는 [`protocol/데이터폼.md`](./protocol/데이터폼.md), 다운링크는 [`COMMANDS.md`](./COMMANDS.md), 앱 내부 계층은 [`SYSTEM_APP.md`](./SYSTEM_APP.md)이다.
