# 집 PC FARM01 LIVE 시뮬

회사 MQTT/RS/`Operation/simulator` 원본 없이, 이 저장소만으로 FARM01/P00 LIVE를 올린다.

## 무엇을 하는가

`simulator/sim_pilot_farm01.py --mqtt` 가 v0x0C **83바이트**를 MQTT 브로커로 보낸다. 호스트·포트·topic은 환경변수 `MQTT_HOST`, `MQTT_PORT`, `MQTT_TOPIC`이다. 미설정 시 호스트는 `127.0.0.1`이고, 운영 브로커 주소는 문서와 코드에 두지 않는다. RS/C/command_ack는 클라우드가 처리한다. `/cmd`를 구독해 thermo를 덮어쓴 뒤 즉시 `/raw`를 한 번 더 올린다.

대상 컨트롤러(과거 FARM01 실측 키): `SP02:01:01`, `SP03:01:01`~`06`, `SP05:01:01`~`06`.

기본은 컨트롤러마다 온·습 시나리오를 **20초**씩 순환한다(위상만 어긋남). `--mqtt`만 켜면 적용된다. 알람 띠 안(정상)·띠 가장자리(주의)·띠 밖(위험)을 한 화면에 같이 보여 필드 덮개·생성 칸의 알람 색을 확인한다. 생성에서 권장 토글을 켜면 유형 이탈·안전망 색도 대조할 수 있다.

차트용 이력은 같은 시나리오를 **6시간** 칸으로 `iot_room_state_decoded`에 덮어 썼다(당시 구 DB 실측 · 이 농장만. raw는 그대로). 2026-08-27에 경보 JSON(10.0/43.6)까지 맞춰 다시 씀. 24시간·7일·30일 차트에서 계단이 보이도록. 현재 운영 DB는 `fkkrjljeqxpbmazfnync`이다.

파일럿도 현장과 같이 **83바이트**(습도 뒤 저온·고온 경보 4바이트, 설정·측정 온도 원점 500=0℃). 디코더는 예전 79바이트(원점 0)도 받는다. 패킷 시각이 서울 벽시계를 UTC 초처럼 넣은 경우(+9h) Edge가 측정 시각을 보정한다. 파일럿 unix는 UTC라 이 보정은 타지 않는다.

실측 규격(파일럿 `wire_ver=12` / 83바이트 live):

| 항목 | FARM01 파일럿 |
|------|----------------|
| topic | 환경변수 `MQTT_TOPIC`. 미설정 시 시뮬레이터 기본 topic |
| tempsC | 프로브 4개, 원점 500 |
| 경보 | 저온 10.0℃ / 고온 43.6℃ |
| Channel A | `EC03` + 출력 + thermo 25.0/2.0/10/80 |
| Channel B | `EC02` + 출력 + thermo 24.0/1.5/5/90 (`SP02`는 없음) |
| Channel C | 비움 |

## 실행

`web/.env.local` 에 `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` 가 있어야 한다.

```bash
cd dashboard
python simulator/sim_pilot_farm01.py --self-test
python simulator/sim_pilot_farm01.py --mqtt          # 시나리오 순환 (20초)
python simulator/sim_pilot_farm01.py --mqtt --once
```

확인: 로컬 `http://localhost:3000/farm?lsind=FARM01&item=P00` 또는 배포본.

## 영향

| 항목 | 내용 |
|------|------|
| DB | 운영 `fkkrjljeqxpbmazfnync` `iot_room_state_raw` INSERT + decode |
| MQTT/EC2 | 사용 안 함 |
| 명령 downlink | **없음** — MQTT `…/cmd` 미구독. 아래 파이프라인 참고 |
| 충돌 | 현장 모듈이 같은 FARM01을 올리면 값이 섞임. 현재 FARM01 raw는 2026-08-14 이후 끊김 |

`--write` 없이 실행하면 INSERT 하지 않는다.

## 명령 왕복 (미구현)

요청 경로: `로컬 시뮬 → MQTT → EC2(RS/C/command_ack) → DB → 대시보드`.

| 단계 | 담당 | 현재 집 시뮬 |
|------|------|----------------|
| `/raw` publish | 통신모듈 / sim | DB 직접 INSERT (EC2 RS 우회) |
| `/cmd` subscribe | sim_fleet | 없음 |
| pending→sent | EC2 C.py | 시뮬과 무관 |
| sent→applied | EC2 command_ack | uplink thermo 4값 일치 필요 |

FARM01 실측(2026-08-11): `SET_CHANNEL_THERMO` pending→sent ≈1.3s, sent→applied ≈4s. 채널 A=`EC03` / B=`EC02`. 지금은 pending/sent 0, raw도 8/14 이후 없음.

