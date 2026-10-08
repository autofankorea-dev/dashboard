# Android 푸시 1차 (Capacitor + FCM)

> **범위:** Android Capacitor 앱 + FCM 잠금화면 알람.  
> **제외:** iOS / Apple Developer / APNs · SMS/VOICE 대기열(테이블 제거 2026-08-28) · PWA Web Push.

## 구조

```
farm_module_alarm (active)
        ↓ trigger enqueue_module_alarm_push
  push_outbox (pending)
        ↓ Edge push-dispatch (cron)
  FCM HTTP v1 → Android Capacitor
        ↑
  user_push_device (앱 로그인 후 토큰 등록)
```

| 층 | 구현 |
|----|------|
| L1–L2 | 기존 decode · View · ack (변경 없음) |
| L3 | `user_push_device` · `push_outbox` · `push-dispatch` |
| L4 | Capacitor Android · `server.url` = 배포 Next |

iPhone은 Safari 모바일 웹만 (푸시 없음). iOS Capacitor는 이후 단계.

## DB (운영 `fkkrjljeqxpbmazfnync`)

Migration: [`supabase/migrations/20260803120000_user_push_and_outbox.sql`](../supabase/migrations/20260803120000_user_push_and_outbox.sql)

운영 프로젝트에 `user_push_and_outbox` 스키마가 포함되어 있다. 구 `iot-cloud`(`ompufmezugftzoergdbn`) 적용 기록(2026-08-03)은 **폐기 프로젝트** 이력이다.

## Edge Secrets · 배포

`push-dispatch` **배포됨** (`verify_jwt=false`, cron_secret 자체 인증).  
Cron: `push-dispatch-30s` (30초) — decode-batch와 동일 Bearer(`iot_decode_config.cron_secret`).

**아직 필요 (Dashboard Secrets):**

권장(한 개로 통일 — 키 붙여넣기 깨짐 방지):

| Secret | 값 |
|--------|-----|
| `FCM_SERVICE_ACCOUNT_JSON` | 서비스 계정 JSON **전체** 한 줄 (`web/fcm-service-account.oneline.txt` 내용) |

또는 기존 3개:

| Secret | 설명 |
|--------|------|
| `FCM_PROJECT_ID` | `sungil-iot-dashboard` |
| `FCM_CLIENT_EMAIL` | `firebase-adminsdk-...@sungil-iot-dashboard.iam.gserviceaccount.com` |
| `FCM_PRIVATE_KEY` | JSON의 `private_key` 전체(BEGIN/END 포함). 줄바꿈이 깨지면 `invalid_grant` / PKCS 오류 |

`FCM_SERVICE_ACCOUNT_JSON`이 있으면 위 3개보다 **우선** 사용합니다.## Firebase / google-services.json

1. Firebase Console에서 Android 앱 추가 — package `com.autofankorea.dashboard`
2. 받은 `google-services.json`을 `android/app/google-services.json`에 배치  
   (git 무시 · 템플릿: `android/app/google-services.json.example`)
3. FCM용 서비스 계정 키 → Edge Secrets

## Capacitor 빌드

```bash
cd web
cp .env.example .env.local   # Next용
# (선택) CAPACITOR_SERVER_URL=https://your-deploy.example
npm run cap:sync
npm run cap:open             # Android Studio
```

- `capacitor.config.ts`의 `server.url`이 WebView가 로드하는 대시보드 URL
- 1차 배포: APK 사이드로드 또는 Play 내부 테스트
- 설치 안내 링크: [`/app`](./android-app-install.md) (`https://smart.autofankorea.com/app`)

## 웹 동작

- Capacitor Android에서만 [`PushDeviceRegistrar`](../src/components/layout/push-device-registrar.tsx)가 토큰을 `user_push_device`에 upsert
- 알림 탭 → `payload.href` (기본 `/farm?lsind=&item=`)로 이동
- 브라우저·iPhone 웹: 등록 스킵 · 기존 벨 UI만

## 검증 체크리스트

1. Migration 적용 후 `user_push_device` · `push_outbox` · RLS 확인
2. Android 실기기 로그인 → `user_push_device` row 생성
3. `farm_module_alarm` active INSERT → `push_outbox` pending → `push-dispatch` → 잠금화면
4. 알림 탭 → `/farm` 딥링크
5. 동일 `alarm_id`+토큰 재발송 없음 (UNIQUE)
6. `npm run lint` · `npm test` · `npm run build`
7. iPhone Safari: 푸시 없음 · 웹 벨만

## 롤백

- cron/webhook 중지 · `push-dispatch` undeploy
- 트리거/`push_outbox`/`user_push_device` DROP은 **승인 후**
- 웹은 Capacitor 없이도 동작 (등록 코드 no-op)

## 환경변수 이름 (값 없음)

웹: `.env.example`  
Edge: 위 FCM_* secrets  
로컬 Capacitor: `CAPACITOR_SERVER_URL` (선택)
