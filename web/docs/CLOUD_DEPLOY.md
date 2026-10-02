# Dashboard 배포 — RS-DB-C (Vercel)

> **EC2 Cloud Agent 범위 밖** — 이 앱은 Vercel이 배포한다.  
> EC2(RS+C): `https://github.com/SIJackLee/rsd` → `CLOUD_DEPLOY.md`  
> 게이트 상세: [`VERCEL_PREVIEW_GATE.md`](./VERCEL_PREVIEW_GATE.md)  
> 문서 허브: [`README.md`](./README.md)

---

## 배포 기준 (정본)

**기본 경로 — Git만으로 Production 반영**

```
commit → push → main 적용 → Vercel 자동 배포
```

| 단계 | 내용 |
|------|------|
| 1. commit | 의도한 산출물 **전부** 커밋 (로컬 dirty ≠ 배포) |
| 2. push | 원격에 반영 (`feature/…` 또는 승인된 `main`) |
| 3. main 적용 | `main`에 머지·push (Production 트리거) |
| 4. Vercel | `main` 감지 → `web/` Root로 build·배포 |

- Production 도메인 예: `https://smart.autofankorea.com`
- **배포본 = Git 커밋만**. 미추적·미푸시 파일은 Vercel에 없다.
- push 전: clean tree `npm test` · `npm run verify:design` · `npm run build` (가능하면).
- **TTFB:** Production·Preview에서도 페이지 TTFB p95 **&lt; 1.5 s** 유지 ([`PERF_BASELINE.md`](./PERF_BASELINE.md) · [`VERCEL_PREVIEW_GATE.md`](./VERCEL_PREVIEW_GATE.md)).

### 특수 케이스 — Vercel CLI

장애 복구·핫픽스 검증·대시보드에서 Git 연동이 막혔을 때만 CLI를 쓴다.  
**일상 배포의 기본이 아니다.**

```bash
# 예: 프로젝트 링크·상태 확인 (로컬에서)
cd dashboard/web
npx vercel whoami
npx vercel ls
# Production 강제 redeploy 등은 사용자 승인 후
```

CLI로 Production을 건드리면 **이후 기준 커밋과 어긋날 수 있음** → 가능하면 같은 변경을 Git `main`에 되맞춰 둔다.

---

## RS-DB-C에서 dashboard 역할

| Before | After |
|--------|-------|
| `iot_room_state_decoded` (D.py INSERT) | `v_iot_raw_live` → TS decode |
| burst merge | `iot-raw-live.ts` — controllerKey별 최신 row |

EC2는 `RS.py`만 raw INSERT. decode·LIVE UI는 **이 앱** (`web/src/lib/data/*`).

---

## Supabase migration (1회, 별도 승인)

```
web/supabase/migrations/20260614000000_rs_live_views.sql
```

```sql
SELECT count(*) FROM public.v_iot_raw_live;
```

---

## Vercel 프로젝트 설정

| 설정 | 값 |
|------|-----|
| Repo | `github.com/autofankorea-dev/dashboard` |
| Vercel | `autofankorea-dev/dashboard` |
| Supabase | `fkkrjljeqxpbmazfnync` |
| Branch (Production) | `main` |
| Root Directory | `web` |
| Functions | `icn1` (서울). 브이월드·카카오 서버 조회. 기본 `iad1`이면 지적 구획이 비어 보임 |

`main` push → 자동 build. 대시보드 **Redeploy** / CLI는 특수 케이스.

로컬 검증:

```bash
cd web
npm ci
npm test
npm run verify:design
npm run build
npm run lint
```

---

## 변경 이력

| 날짜 | 내용 |
|------|------|
| 2026-09-28 | GitHub·Vercel `autofankorea-dev/dashboard`, Supabase `fkkrjljeqxpbmazfnync` |
| 2026-08-21 | 모델 구획: Vercel Functions `icn1`(서울). `web/vercel.json` |
| 2026-06-14 | RS-DB-C raw LIVE 조회 |
| 2026-06-14 | Cloud Agent 지침 제거 (EC2 전용으로 분리) |
