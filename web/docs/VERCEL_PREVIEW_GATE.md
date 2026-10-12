# Vercel Preview 게이트 (Git→배포 검증)

> **배포 실행:** 단일 에이전트 (`SI1/.cursor/rules/single-agent.mdc`).  
> **배포 기준 정본:** [`CLOUD_DEPLOY.md`](./CLOUD_DEPLOY.md) — `commit → push → main → Vercel 자동배포`  
> 허브 URL: [`farm-hub-url.md`](./farm-hub-url.md) · 운영 메모: [`WORKSPACE_NOTES.md`](./WORKSPACE_NOTES.md)

Git에 push되면 Vercel이 **그 커밋만** 빌드·배포한다.  
로컬 dirty / 미추적 파일은 배포본에 **없다**.

## 전제

| 항목 | 요구 |
|------|------|
| 기본 경로 | commit → push → **main** → Production 자동 배포 |
| 특수 | Vercel CLI / Redeploy — 장애·핫픽스만 (`CLOUD_DEPLOY.md`) |
| 반영 범위 | 의도한 산출물이 커밋에 **전부** 포함 (stub·반쪽 import 금지) |
| 브랜치 | 가능하면 `feature/…` → Preview → main (긴급 hotfix는 clean build 후 main) |
| Supabase | Vercel env = 로컬 `.env.local`과 **동일 프로젝트** (테스트 계정) |
| 빌드 | **clean tree**에서 `npm test` · `verify:design` · `build`. `tsconfig` `scripts` exclude |
| migration | SQL은 커밋에 넣되 **DB 적용은 별도 승인** |

## 완전 반영 체크 (push 전)

1. import 대상 파일이 같은 커밋/브랜치에 있는가 (`Module not found` 방지)  
2. 새 토큰·CSS·`motionClass`·env example이 같이 가는가  
3. UI가 stub/플레이스홀더로 남아 “작동안 함”처럼 보이지 않는가  
4. clean worktree `npm test` · `npm run verify:design` · `npm run build` PASS  
4b. 허브 URL/셸 변경 시 `npm run verify:hub` PASS ([`HUB_STABILITY_P0.md`](./HUB_STABILITY_P0.md))  
4c. **TTFB:** Preview/Production에서도 페이지 TTFB p95 **&lt; 1.5 s** 유지 ([`PERF_BASELINE.md`](./PERF_BASELINE.md)). 허브·LIVE 경로 변경 시 `measure:hub-ttfb` / 브라우저 샘플 권장  
5. 보고에 포함 산출물(허브/디자인/ARIA/…)을 명시  

## 절차

1. feature(또는 hotfix)에 **완전 세트** 커밋  
2. push → (feature면 Preview) → **main 적용** → Production  
3. 스모크 예:

```bash
cd dashboard/web
UI_VERIFY_BASE=https://<preview-or-prod>.vercel.app node scripts/farm-hub-url-manual-smoke.mjs
```

4. Production 도메인 예: `https://smart.autofankorea.com`

## 스모크

`scripts/farm-hub-url-manual-smoke.mjs` — 탭·URL·soft home.  
로컬: `UI_VERIFY_BASE=http://localhost:3000`

## 이슈 메모 (단일 에이전트가 이어서 처리)

| 이슈 | 비고 |
|------|------|
| 기간 변경 줌 리셋 UX | 디자인/차트 |
| `listMode=channel`→`graph` URL 정규화 | 허브 URL · dirty 분리 커밋 권장 |
| 델린 뱃지 | 제거됨. [`ENVIRONMENT_STATUS_POLICY.md`](./ENVIRONMENT_STATUS_POLICY.md) |
