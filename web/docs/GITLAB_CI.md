# GitLab CI

`.gitlab-ci.yml`은 `dashboard/` 저장소 루트에 있으며 `web/` Next.js 앱을 검증한다.

## Jobs

| Job | 용도 | 실패 시 |
| --- | --- | --- |
| `web:install` | `npm ci` | 파이프라인 중단 |
| `web:lint` | ESLint | 파이프라인 중단 |
| `web:test` | `npm test` — `src/**/*.test.ts` (protocol · hub URL 등) | 파이프라인 중단 |
| `web:verify-design` | `npm run verify:design` (motion + map density) | 파이프라인 중단 |
| `web:knip` | dead files · deps · duplicates | 파이프라인 중단 |
| `web:build` | `next build --webpack` (더미 Supabase env) | 파이프라인 중단 |
| `web:audit` | Playwright UI audit (선택) | `allow_failure: true` |

## Knip

- 설정: `knip.config.ts` — `src/app`·`src/**/*.test.ts`·`scripts/*`를 entry로 둔다. ignore: 미연결 디자인 헬퍼. `buffer`는 webpack 폴리필이라 `ignoreDependencies`. `scripts/archive/**`는 entry에 넣지 않는다.
- CI: `npm run knip` — files/dependencies/duplicates만 게이트
- 로컬 점진 정리: `npm run knip:exports` — unused export 전체 목록

## Playwright audit (`web:audit`)

로그인·LIVE 데이터가 필요하므로 **더미 env만으로는 실패**한다.  
GitLab **CI/CD Variables** (masked)에 아래를 설정한 뒤, 변수 `CI_PLAYWRIGHT_AUDIT=true` 일 때만 job이 실행된다.

| Variable | 용도 |
| --- | --- |
| `CI_PLAYWRIGHT_AUDIT` | `true` — audit job 활성화 |
| `NEXT_PUBLIC_SUPABASE_URL` | 테스트 Supabase URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role (audit 계정 비밀번호 동기화) |

테스트 계정: `scripts/test-accounts.mjs` 참고 (`admin@test.com`, `farmer@test.com`, `viewer@test.com`).

로컬과 동일하게 dev 서버 기동 후 audit 스크립트를 실행한다:

```bash
cd web
npm run dev
# 다른 터미널
npm run audit:operator-apply
npm run audit:farm-command
npm run audit:health-drilldown
```

## GitHub

원격이 GitHub(`autofankorea-dev/dashboard`)인 경우 [`../../.github/workflows/web-verify.yml`](../../.github/workflows/web-verify.yml)이  
`npm test` · `verify:design` · `build`를 push/PR에서 실행한다.

## GitHub mirror (구 메모)

`.gitlab-ci.yml`은 GitLab 파이프라인 전용이다. GitHub Actions는 위 workflow를 사용한다.
