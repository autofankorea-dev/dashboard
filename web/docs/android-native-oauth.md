# Android 네이티브 OAuth (Google + 카카오) — Phase 1

> **범위:** Capacitor Android 앱에서 Google / 카카오 네이티브 SDK → Supabase `signInWithIdToken`.  
> **브라우저:** 기존 `signInWithOAuth` 유지 (`oauth-buttons.tsx`가 플랫폼 분기).

## 흐름

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

## 환경변수

`.env.local` / Vercel (이름은 `.env.example` 참고):

| 이름 | 용도 |
|------|------|
| `NEXT_PUBLIC_GOOGLE_WEB_CLIENT_ID` | Google **웹** 클라이언트 ID (Android에서도 server client ID로 사용) |
| `NEXT_PUBLIC_KAKAO_NATIVE_APP_KEY` 또는 `KAKAO_NATIVE_APP_KEY` | 카카오 **네이티브 앱 키** (`capacitor.config` + Android placeholder) |

`android/local.properties` (git 제외)에도 동일 키를 둘 수 있다:

```properties
KAKAO_NATIVE_APP_KEY=<네이티브앱키>
```

## 콘솔 설정 (에이전트가 대신 로그인할 수 없음 — 계정 소유자 작업)

### Google Cloud / Firebase (`sungil-iot-dashboard`)

1. [Google Cloud Credentials](https://console.cloud.google.com/apis/credentials) 또는 Firebase 프로젝트 설정.
2. **OAuth 클라이언트 ID (웹 애플리케이션)** 생성 → `NEXT_PUBLIC_GOOGLE_WEB_CLIENT_ID`에 넣기.
3. **OAuth 클라이언트 ID (Android)** 생성  
   - 패키지: `com.autofankorea.dashboard`  
   - 디버그 키스토어 SHA-1은 로컬에서 추출해 Android OAuth 클라이언트에 등록한다. 값은 문서에 적지 않는다.
   - 릴리즈 APK는 서명 키스토어 SHA-1을 추가로 등록.
4. Firebase에 SHA-1 등록 후 `google-services.json` 재다운로드 (현재 `oauth_client`가 비어 있음).
5. Supabase Dashboard → Auth → Providers → Google: Web client ID / secret 확인.

### 카카오 — 웹(모바일 브라우저) + 네이티브 앱 동시 사용

코드는 이미 플랫폼별로 갈라진다 (`oauth-buttons.tsx`).

| 환경 | 경로 | 쓰는 키 |
|------|------|---------|
| PC/모바일 **브라우저** (`/login`) | Supabase `signInWithOAuth` → 카카오 인가 페이지 | **REST API 키** |
| **Android 앱** (Capacitor) | 카카오 SDK → `signInWithIdToken` | **네이티브 앱 키** (`aud`) |

한 Supabase 프로젝트에서 둘 다 쓰려면 Client ID에 **쉼표로 두 키**를 넣는다.

#### 1) 카카오 디벨로퍼스 (앱: Dashboard / SUN 등)

**공통**
1. [제품 설정] → **카카오 로그인** → 사용 **ON**
2. **OpenID Connect** **ON** (앱 id_token 필수)
3. 동의 항목: 닉네임, (선택) 계정 이메일

**REST API 키** (웹 OAuth용)
1. [앱] → [플랫폼 키] → **REST API 키** 선택
2. **카카오 로그인 Redirect URI**에 등록 (한 줄, 끝 슬래시 없이):
   ```
   https://ompufmezugftzoergdbn.supabase.co/auth/v1/callback
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

#### 2) Supabase Dashboard

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
`https://ompufmezugftzoergdbn.supabase.co/auth/v1/callback`

#### 3) 검증 체크리스트

1. **PC Chrome** `https://smart.autofankorea.com/login` → 카카오 → 동의 → `/farm` 또는 `/pending`
2. **휴대폰 브라우저** 동일 URL → 동일 (웹 OAuth, REST 키)
3. **설치 앱** → 카카오 → 카톡 있으면 앱 로그인, 없으면 계정 웹뷰 → 대시보드  
   - `Unacceptable audience` → Supabase Client ID에 네이티브 키 누락  
   - KOE033(웹만) → Client ID가 네이티브만 있거나 Redirect URI 불일치
4. 같은 카카오 계정이면 웹·앱 모두 같은 Supabase user로 이어지는 경우가 많다 (이메일/식별자 정책에 따름)

#### 4) 로컬 개발

- 웹: `npm run dev` → `http://localhost:3000/login` (카카오 Redirect는 여전히 **Supabase callback**이라 REST URI 추가 등록 불필요)
- 앱: Capacitor `server.url`이 프로덕션이면 배포 JS·env를 따름. 네이티브 키는 `cap sync` + APK에 포함

### Google Android 주의

- `SocialLogin.login`에 `scopes`를 넘기지 않는다.  
  넘기면 `You CANNOT use scopes without modifying the main activity` 가 난다.  
  email/profile/openid는 플러그인 기본값으로 충분하다.

## 빌드

```bash
# 웹 배포에 Google/Kakao env 반영 후
npm run cap:sync
# Android Studio에서 APK 빌드·설치
npm run cap:open
```

## 검증

1. 앱 로그인 화면에서 Google → 계정 선택 UI(Credential Manager) → `/farm` 또는 `/pending`.
2. 카카오 → 카카오톡 앱(또는 계정) 로그인 → 동일.
3. 브라우저에서는 기존처럼 시스템/탭 OAuth.

## 롤백

- `oauth-buttons` 네이티브 분기 제거 또는 Feature로 감싸기.
- 플러그인 uninstall + `cap sync`.
- 패치 파일 삭제 시 카카오는 `idToken` 미반환으로 네이티브 경로 실패.
