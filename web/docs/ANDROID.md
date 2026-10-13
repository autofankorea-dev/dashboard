# Android

설치 페이지, 네이티브 OAuth, FCM 푸시. iOS Capacitor는 이후다.


---

## 설치

## Android 앱 설치 페이지 (`/app`)

> 고정 링크: `https://smart.autofankorea.com/app`  
> 다운로드: `https://smart.autofankorea.com/app/download` (비밀번호 쿠키 후 Storage signed URL 302)

### 흐름

```
카톡 등 → /app
  → 설치 비밀번호
  → APK 다운로드 (/app/download)
  → Supabase Storage (app-releases / sungil-iot.apk) signed URL
  → 폰에 설치 → 계정 로그인 → 알림 허용
```

Play 스토어 없이 **도메인 링크 + APK 사이드로드**용입니다.

### 환경변수 (이름만)

| 변수 | 설명 |
|------|------|
| `APP_INSTALL_PASSWORD` | `/app` 잠금 해제 |
| `APP_INSTALL_COOKIE_SECRET` | (선택) 쿠키 서명 |
| `APP_APK_VERSION` | 안내 문구용 버전 표시 |
| `APP_APK_BUCKET` | 기본 `app-releases` |
| `APP_APK_OBJECT_PATH` | 기본 `sungil-iot.apk` |
| `SUPABASE_SERVICE_ROLE_KEY` | signed URL 발급 |

### Storage

- 버킷: `app-releases` (private) — migration `20260804100000_storage_app_releases.sql`
- 객체: `sungil-iot.apk`
- 공개 read 정책 없음. Next 서버만 service_role로 짧은 signed URL 발급

#### APK 업로드 (Dashboard 또는 CLI)

1. release APK 빌드
2. Supabase Dashboard → Storage → `app-releases` → `sungil-iot.apk` 업로드(덮어쓰기)
3. (선택) Vercel `APP_APK_VERSION` 갱신

### 관련 코드

- `src/app/app/page.tsx` — 설치 UI (`/public/app_logo3.png` 앱 아이콘)
- `src/app/app/download/route.ts`
- `src/lib/app-install/gate.ts`
- 미인증 공개: `src/lib/supabase/middleware.ts` 의 `/app`

홈 화면 아이콘은 APK 리소스(`android/.../mipmap-*`)에 포함된다.  
`scripts/generate-app-icon.py`가 `app_logo3.png`를 **safe zone(~62%)** 안에 배치해 스쿼클/원형 마스크에 글자·로고가 잘리지 않게 한다.  
`/app`에서 받는 APK를 새 아이콘으로 맞추려면 스크립트 실행 → release/debug 빌드 후 Storage `sungil-iot.apk`를 다시 업로드한다.


---

## 네이티브 OAuth

## Android 네이티브 OAuth (Google + 카카오) — Phase 1

> **범위:** Capacitor Android 앱에서 Google / 카카오 네이티브 SDK → Supabase `signInWithIdToken`.  
> **브라우저:** 기존 `signInWithOAuth` 유지 (`oauth-buttons.tsx`가 플랫폼 분기).

### 흐름

```
[앱 로그인 버튼]
   ├─ Android: SocialLogin(Google) / KakaoLogin → id_token
   │            → supabase.auth.signInWithIdToken
   │            → finalizeNativeOAuthLogin → /auth/enter
   └─ Web:     getOAuthSignInUrl → /auth/callback (기존)
```

| 제공자 | 플러그인 | 토큰 |
|--------|----------|------|
| Google | `@capgo/capacitor-social-login` | `idToken` |
| 카카오 | `@chuseok22/capacitor-kakao-login` (+ patch: `idToken` 반환) | `idToken` (OIDC 필수) |

패치: `patches/@chuseok22+capacitor-kakao-login+0.3.0.patch` (`postinstall`로 적용)

### 환경변수

`.env.local` / Vercel (이름은 `.env.example` 참고):

| 이름 | 용도 |
|------|------|
| `NEXT_PUBLIC_GOOGLE_WEB_CLIENT_ID` | Google **웹** 클라이언트 ID (Android에서도 server client ID로 사용) |
| `NEXT_PUBLIC_KAKAO_NATIVE_APP_KEY` 또는 `KAKAO_NATIVE_APP_KEY` | 카카오 **네이티브 앱 키** (`capacitor.config` + Android placeholder) |

`android/local.properties` (git 제외)에도 동일 키를 둘 수 있다:

```properties
KAKAO_NATIVE_APP_KEY=<네이티브앱키>
```

### 콘솔 설정 (에이전트가 대신 로그인할 수 없음 — 계정 소유자 작업)

#### Google Cloud / Firebase (`sungil-iot-dashboard`)

1. [Google Cloud Credentials](https://console.cloud.google.com/apis/credentials) 또는 Firebase 프로젝트 설정.
2. **OAuth 클라이언트 ID (웹 애플리케이션)** 생성 → `NEXT_PUBLIC_GOOGLE_WEB_CLIENT_ID`에 넣기.
3. **OAuth 클라이언트 ID (Android)** 생성  
   - 패키지: `com.autofankorea.dashboard`  
   - 디버그 키스토어 SHA-1은 로컬에서 추출해 Android OAuth 클라이언트에 등록한다. 값은 문서에 적지 않는다.
   - 릴리즈 APK는 서명 키스토어 SHA-1을 추가로 등록.
4. Firebase에 SHA-1 등록 후 `google-services.json` 재다운로드 (현재 `oauth_client`가 비어 있음).
5. Supabase Dashboard → Auth → Providers → Google: Web client ID / secret 확인.

#### 카카오 — 웹(모바일 브라우저) + 네이티브 앱 동시 사용

코드는 이미 플랫폼별로 갈라진다 (`oauth-buttons.tsx`).

| 환경 | 경로 | 쓰는 키 |
|------|------|---------|
| PC/모바일 **브라우저** (`/login`) | Supabase `signInWithOAuth` → 카카오 인가 페이지 | **REST API 키** |
| **Android 앱** (Capacitor) | 카카오 SDK → `signInWithIdToken` | **네이티브 앱 키** (`aud`) |

한 Supabase 프로젝트에서 둘 다 쓰려면 Client ID에 **쉼표로 두 키**를 넣는다.

##### 1) 카카오 디벨로퍼스 (앱: Dashboard / SUN 등)

**공통**
1. [제품 설정] → **카카오 로그인** → 사용 **ON**
2. **OpenID Connect** **ON** (앱 id_token 필수)
3. 동의 항목: 닉네임, (선택) 계정 이메일

**REST API 키** (웹 OAuth용)
1. [앱] → [플랫폼 키] → **REST API 키** 선택
2. **카카오 로그인 Redirect URI**에 등록 (한 줄, 끝 슬래시 없이):
   ```
   https://fkkrjljeqxpbmazfnync.supabase.co/auth/v1/callback
   ```
3. **카카오 로그인 Client Secret** 발급 후 상태 **ON**  
   → 이 값이 Supabase **Client Secret**이다. (네이티브 앱 키가 아님)

**네이티브 앱 키** (Android SDK용)
1. [앱] → [플랫폼 키] → **네이티브 앱 키** (또는 Android 플랫폼)
2. 패키지: `com.autofankorea.dashboard`
3. 키 해시  
   - 디버그 키 해시는 로컬 디버그 키스토어에서 추출해 카카오 콘솔에만 등록한다. 값은 문서에 적지 않는다.  
   - 릴리즈/Play 서명 SHA면 해당 키 해시 추가
4. 로컬·Vercel·`android/local.properties`에  
   `KAKAO_NATIVE_APP_KEY` / `NEXT_PUBLIC_KAKAO_NATIVE_APP_KEY` = 네이티브 앱 키

##### 2) Supabase Dashboard

[Authentication] → [Providers] → **Kakao** → Enabled ON

| 필드 | 넣을 값 |
|------|---------|
| Client ID (REST API Key 칸) | `<REST_API_키>,<네이티브_앱_키>`  
  **앞=웹 OAuth, 뒤=앱 id_token aud** (순서 권장: REST 먼저). 실제 키 값은 문서에 적지 않는다. |
| Client Secret | REST 키 화면의 **카카오 로그인 Client Secret 코드만** |
| Allow users without an email | ON 권장 (비즈 앱이 아니거나 이메일 미동의 시) |

잘못된 예:
- Client Secret에 네이티브 앱 키를 넣음 → 웹 OAuth 실패
- Client ID에 네이티브만 넣음 → 웹 KOE033 / 브라우저 로그인 불가
- Client ID에 REST만 넣음 → 앱 `Unacceptable audience in id_token`

Callback URL(복사만, 카카오에 이미 등록):  
`https://fkkrjljeqxpbmazfnync.supabase.co/auth/v1/callback`

##### 3) 검증 체크리스트

1. **PC Chrome** `https://smart.autofankorea.com/login` → 카카오 → 동의 → `/farm` 또는 `/pending`
2. **휴대폰 브라우저** 동일 URL → 동일 (웹 OAuth, REST 키)
3. **설치 앱** → 카카오 → 카톡 있으면 앱 로그인, 없으면 계정 웹뷰 → 대시보드  
   - `Unacceptable audience` → Supabase Client ID에 네이티브 키 누락  
   - KOE033(웹만) → Client ID가 네이티브만 있거나 Redirect URI 불일치
4. 같은 카카오 계정이면 웹·앱 모두 같은 Supabase user로 이어지는 경우가 많다 (이메일/식별자 정책에 따름)

##### 4) 로컬 개발

- 웹: `npm run dev` → `http://localhost:3000/login` (카카오 Redirect는 여전히 **Supabase callback**이라 REST URI 추가 등록 불필요)
- 앱: Capacitor `server.url`이 프로덕션이면 배포 JS·env를 따름. 네이티브 키는 `cap sync` + APK에 포함

#### Google Android 주의

- `SocialLogin.login`에 `scopes`를 넘기지 않는다.  
  넘기면 `You CANNOT use scopes without modifying the main activity` 가 난다.  
  email/profile/openid는 플러그인 기본값으로 충분하다.

### 빌드

```bash
# 웹 배포에 Google/Kakao env 반영 후
npm run cap:sync
# Android Studio에서 APK 빌드·설치
npm run cap:open
```

### 검증

1. 앱 로그인 화면에서 Google → 계정 선택 UI(Credential Manager) → `/farm` 또는 `/pending`.
2. 카카오 → 카카오톡 앱(또는 계정) 로그인 → 동일.
3. 브라우저에서는 기존처럼 시스템/탭 OAuth.

### 롤백

- `oauth-buttons` 네이티브 분기 제거 또는 Feature로 감싸기.
- 플러그인 uninstall + `cap sync`.
- 패치 파일 삭제 시 카카오는 `idToken` 미반환으로 네이티브 경로 실패.


---

## 푸시

## Android 푸시 1차 (Capacitor + FCM)

> **범위:** Android Capacitor 앱 + FCM 잠금화면 알람.  
> **제외:** iOS / Apple Developer / APNs · SMS/VOICE 대기열(테이블 제거 2026-08-28) · PWA Web Push.

### 구조

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

### DB (운영 `fkkrjljeqxpbmazfnync`)

Migration: [`supabase/migrations/20260803120000_user_push_and_outbox.sql`](../supabase/migrations/20260803120000_user_push_and_outbox.sql)

운영 프로젝트에 `user_push_and_outbox` 스키마가 포함되어 있다. 구 `iot-cloud`(`ompufmezugftzoergdbn`) 적용 기록(2026-08-03)은 **폐기 프로젝트** 이력이다.

### Edge Secrets · 배포

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

### Capacitor 빌드

```bash
cd web
cp .env.example .env.local   # Next용
# (선택) CAPACITOR_SERVER_URL=https://your-deploy.example
npm run cap:sync
npm run cap:open             # Android Studio
```

- `capacitor.config.ts`의 `server.url`이 WebView가 로드하는 대시보드 URL
- 1차 배포: APK 사이드로드 또는 Play 내부 테스트
- 설치 안내 링크: [`/app`](#설치) (`https://smart.autofankorea.com/app`)

### 웹 동작

- Capacitor Android에서만 [`PushDeviceRegistrar`](../src/components/layout/push-device-registrar.tsx)가 토큰을 `user_push_device`에 upsert
- 알림 탭 → `payload.href` (기본 `/farm?lsind=&item=`)로 이동
- 브라우저·iPhone 웹: 등록 스킵 · 기존 벨 UI만

### 검증 체크리스트

1. Migration 적용 후 `user_push_device` · `push_outbox` · RLS 확인
2. Android 실기기 로그인 → `user_push_device` row 생성
3. `farm_module_alarm` active INSERT → `push_outbox` pending → `push-dispatch` → 잠금화면
4. 알림 탭 → `/farm` 딥링크
5. 동일 `alarm_id`+토큰 재발송 없음 (UNIQUE)
6. `npm run lint` · `npm test` · `npm run build`
7. iPhone Safari: 푸시 없음 · 웹 벨만

### 롤백

- cron/webhook 중지 · `push-dispatch` undeploy
- 트리거/`push_outbox`/`user_push_device` DROP은 **승인 후**
- 웹은 Capacitor 없이도 동작 (등록 코드 no-op)

### 환경변수 이름 (값 없음)

웹: `.env.example`  
Edge: 위 FCM_* secrets  
로컬 Capacitor: `CAPACITOR_SERVER_URL` (선택)
