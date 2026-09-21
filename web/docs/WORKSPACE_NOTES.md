# 운영 메모 (스냅샷)

> 갱신: 2026-07-30 · `dashboard/web`  
> **진실의 원천은 `git status` / `origin/main`이다.** 이 파일은 메모일 뿐이다.  
> 문서 허브: [`README.md`](./README.md) · 배포: [`CLOUD_DEPLOY.md`](./CLOUD_DEPLOY.md)

구명칭 `CLEANUP_ARTIFACT_MAP` 내용은 본 파일로만 유지한다 (별도 stub 파일 없음).

---

## 현재 운영

| 항목 | 상태 |
|------|------|
| 에이전트 | 단일 (`SI1/.cursor/rules/single-agent.mdc`) |
| 배포 | `commit → push → main → Vercel 자동` |
| Production | `https://smart.autofankorea.com` — **2026-08-28 제품 패키징 종료 (GO)** |
| CLI / Redeploy | 특수 케이스만 |
| 테스트 게이트 | `npm test` · `verify:design` · GitHub `web-verify` · GitLab `web:test` |

---

## 할 일 — RS 수집 공백 재발 방지

2026-09-17 Supabase HTTPS INSERT `ReadTimeout`으로 `rsd-rs`가 정체돼
`17:14~18:49 KST` raw 수집 공백이 발생했다. RS 재시작으로 서비스는
복구됐지만 clean session·메모리 큐 구조와 EBS 스냅샷 부재로 해당 구간은
복구하지 못했다.

- [ ] RS SQLite WAL durable Outbox
- [ ] MQTT 수신과 Supabase 전송 worker 분리
- [ ] 재시작 replay·idempotency·용량 상한 검증
- [ ] Outbox oldest age·disk·DB write 경보
- [ ] 운영 대형 SQL `EXPLAIN`·timeout·실행 범위 가드

상세 원인·영향·완료 조건:
[`incidents/20260917-rs-supabase-outage.md`](./incidents/20260917-rs-supabase-outage.md)

---

## 겹침 주의 (한 PR에서 끝낼 것)

| 파일 | 이유 |
|------|------|
| `farm-page-content.tsx` | 허브 패널 렌더·enrich (탭 sync는 `use-farm-hub-view-shell`) |
| `use-farm-hub-view-shell.ts` | URL sync · 슬라이드 · keep-alive TTL |
| `globals.css` / `dashboard-page-ui.ts` | 토큰 · ARIA 셸 · 밀도 |

---

## 예비 삭제 (미실행)

| 후보 | 비고 |
|------|------|
| legacy `.cursor/rules/*-agent.mdc` 실삭제 | 지금은 `alwaysApply: false`만 |

## 삭제 완료

| 경로 | 일자 |
|------|------|
| `SI1/dashboard-aria-ship/` (worktree) | 2026-07-30 |
| `SI1/dashboard-build-check/` | 2026-07-30 |
| 일회성 test-results md · channel migrate 스크립트 | 2026-07-30 |

---

## 교훈

1. 로컬 dirty build PASS ≠ Vercel clean build PASS  
2. stub·반쪽 import → Production “작동안 함”  
3. 문서 스냅샷이 git보다 낡으면 오판 — **status 우선**  
4. 멀티 Agent 핸드오프는 혼선 유발 → 단일 진행
