# 코드 컨벤션 — 폴더 책임 · 레이어 경계 · 네이밍

> 문서 허브: [`README.md`](./README.md) · 시스템: [`SYSTEM_NEXTJS.md`](./SYSTEM_NEXTJS.md) · 게이트: [`SCRIPTS.md`](./SCRIPTS.md)  
> **강제 수단:** `eslint.config.mjs`의 `layerBoundaries`(`no-restricted-imports`) · `tsc --noEmit` · `knip`  
> 적용: 2026-10 클린코드 P1. 이 문서와 코드가 다르면 **코드(`origin/main`)가 우선**이며 문서를 고친다.

---

## 1. 레이어와 의존 방향

```mermaid
flowchart LR
  APP[src/app<br/>라우팅 · RSC · server actions] --> CMP[src/components<br/>UI · 피처 hook]
  CMP --> LIB[src/lib]
  APP --> LIB
  subgraph LIB[src/lib]
    direction TB
    DATA[lib/data<br/>서버 데이터 접근] --> DOM[lib/domain<br/>순수 규칙·타입]
    FEAT[lib/farm · controllers · admin · report …<br/>피처 로직] --> DOM
    DATA --> FEAT
    UI[lib/ui · navigation · onboarding<br/>클라 UI 유틸·스토어]
    SB[lib/supabase · lib/auth]
    DATA --> SB
  end
```

| 방향 | 허용 | 금지 (ESLint error) |
|------|------|---------------------|
| `app` → `components`, `lib` | O | — |
| `components` → `lib` | O | `components` → `@/lib/supabase/*` |
| `lib` → `lib` | O | `lib/**` → `@/components/*` · `@/app/*` |
| `lib/domain` → | `lib/domain` 만 | `react` · `next*` · `server-only` · `@/lib/supabase/*` · `@/lib/data/*`(타입 포함) · `@/components` · `@/app` |

공유 타입은 `lib/domain/*-types.ts`에 둔다 (`iot-types.ts` · `barn-meta-types.ts`). `lib/data/iot.ts`·`barn-meta.ts`는 호환용으로 같은 이름을 재export하므로 기존 `@/lib/data/iot` 타입 import는 그대로 동작한다. **신규 코드는 `@/lib/domain/iot-types`를 직접 import**한다.

서버 액션을 부르는 React provider는 `components`에 둔다. 농장 라이브 리프레시는 `components/farm/farm-live-refresh.tsx`이고, `lib/navigation/farm-live-refresh-bridge.ts`는 핸들러 등록만 남긴다. lib가 액션이 필요하면 호출측이 함수를 넘긴다 (`fetchFarmPanelEnrichShared`, `registerPushDeviceIfNative`).

---

## 2. 폴더 책임

| 폴더 | 책임 | 들어가는 것 | 들어가면 안 되는 것 |
|------|------|-------------|---------------------|
| `src/app` | 라우팅·RSC·Route Handler·**Server Action** | `page.tsx` · `layout.tsx` · `route.ts` · `actions.ts` | 재사용 UI · 도메인 규칙 |
| `src/components/<feature>` | UI 컴포넌트 + **그 피처 전용 React hook**(`use-*.ts`) | JSX · hook · 피처 컨텍스트 | Supabase 직접 호출 · 순수 규칙(→ `lib`) |
| `src/components/ui` | shadcn 프리미티브 (knip ignore) | 생성 코드 | 피처 로직 |
| `src/lib/domain` | **순수** 도메인 타입·규칙·포맷. 서버/클라/Edge 어디서든 import 가능 | 키 정규화 · 상태 판정 · 집계 · 타입 · 상수 | React · Next · Supabase · `server-only` · `process.env` 외 I/O |
| `src/lib/data` | **서버 전용** 데이터 접근 | `import "server-only"` · `createClient`(server) · `cache()` 로더 · `*-shell-data` | 클라이언트 전용 코드 · UI |
| `src/lib/data/browser` | **브라우저** Supabase 조회 (anon + RLS) | `"use client"` · `fetch*Browser()` | server-only · hook (hook은 components) |
| `src/lib/<feature>` (`farm`·`controllers`·`admin`·`report`·`geo`·`onboarding`) | 피처 로직. React 없음(`farm`·`controllers`·`onboarding`은 현재 React-free) | 계산 · URL 계약 · 캐시 · wire 인코딩 | 컴포넌트 import · hook |
| `src/lib/ui` · `lib/navigation` | 클라 UI 유틸·디자인 토큰·전역 스토어·범용 hook | `motion-classes` · `dashboard-page-ui` · `use-mobile-layout` | 피처 지식 · Supabase |
| `src/lib/supabase` · `lib/auth` | 클라이언트 팩토리(server/browser/admin/rls) · 세션·권한 | — | 도메인 로직 |
| `supabase/functions` | Deno Edge (decode-batch · push-dispatch) | Edge 전용 | 앱 코드 import (tsconfig exclude) |

### 판단 기준 (새 파일을 어디에 두나)

1. Supabase/`next/*`/`server-only`를 import 하나? → 서버면 `lib/data`, 브라우저면 `lib/data/browser`.
2. React hook인가? → 피처 전용이면 `components/<feature>/use-*.ts`, 범용이면 `lib/ui`.
3. 위 둘 다 아니고 특정 피처 어휘(차트·명령·투어)인가? → `lib/<feature>`.
4. 모든 피처가 공유하는 어휘(농장 키·채널·상태 판정·알람 규칙)인가? → `lib/domain`.

---

## 3. 네이밍

| 종류 | 규칙 | 예 |
|------|------|----|
| 파일 | kebab-case | `farm-trend-history.ts` |
| React hook 파일 | `use-*.ts(x)` | `components/farm/use-barn-graphs.tsx` |
| 서버 fetch | 동사형 `get*` / `fetch*` / `list*` | `lib/data/commands.ts: listThermoCommands` |
| 브라우저 fetch | `fetch*Browser` | `lib/data/browser/command-presets.ts` |
| 서버 액션 | `*Action` | `saveCommandDefaultsAction` |
| 테스트 | 대상 옆 `*.test.ts` (`node:assert`, `npm test`) | `lib/domain/live-status.test.ts` |
| 동명 서버/순수 쌍 | 허용하되 서버는 `lib/data`, 순수는 `lib/<feature>` | `data/command-presets.ts` ↔ `farm/command-presets.ts` |

- barrel(`index.ts`) 쓰지 않는다. import는 항상 파일 직접 경로 (`@/lib/domain/farm-key`).
- import 경로는 `@/` 절대 경로. 같은 폴더 안에서만 `./` 허용.

---

## 4. 파일 크기 · 컴포넌트 분해 가이드

| 지표 | 가이드 | 현황(2026-10) |
|------|--------|---------------|
| 파일 LOC | ≤ 400 권장, 800 초과 금지(신규) | 500+ 컴포넌트 22 · lib 14 — P2 분해 대상 |
| 컴포넌트 hook 수 | ≤ 8. 넘으면 `use-*.ts`로 추출 | `trend-chart.tsx` 33 → 18 호출(ref 27 → 5, effect 6 → 0) — P2-1d 후 |
| export 수/파일 | ≤ 20 | `unified-barn-trend-series.ts`는 재export 배럴. 구현은 `unified-trend-*` (P2-2) |

분해 순서: 순수 함수 추출(→ `lib`) → hook 추출(→ `use-*.ts`) → 하위 컴포넌트 분리. 각 단계 `npm run check`.  
차트(`TrendChart`)는 추가로 `npm run snapshot:chart-markup -- --baseline <분해 전 캡처>`로 렌더 markup diff 0 을 확인한다 ([`SCRIPTS.md`](./SCRIPTS.md) § C).  
`TrendChart` 순수 계산은 `lib/farm/trend-chart-geometry.ts`(패딩·도메인·라벨 배치)와 `lib/farm/trend-chart-layout.ts`(좌표 매핑·눈금·밴드/이벤트 배치)에 두고, 컴포넌트는 클로저로 감싸 호출만 한다. 스냅샷 fixture는 line 모드만 렌더하므로 bar 모드·이벤트 레인·명령 밴드 경로는 `trend-chart-layout.test.ts`가 담당한다.  
`TrendChart`의 상태·effect는 `components/trends/use-trend-*.ts`에 역할별로 둔다: `plot-size`(ResizeObserver), `crosshair`(십자선 DOM 조작), `pin-window-remap`(줌 시 고정 카드 재배치), `lookback-gesture`(휠·핀치), `scale-edge-edit`(스케일 엣지 드래그/숫자 입력), `edge-band-labels`(알람·기준선 끝단 라벨), `pinned-tips`, `scope-gesture`, `hover`(호버 인덱스·카드 배치). hook은 옵션 객체 하나를 받고, JSX에 부착할 ref와 핸들러를 그대로 반환한다(동작 변경 없는 1:1 이동 원칙). `clearHover`만 십자선 숨김 때문에 `TrendChart`에 남긴다.  
화면 조각은 `trend-chart-legend.tsx`, `trend-chart-crosshair-chip.tsx`, `trend-y-label-chip.tsx`, `trend-chart-y-axis.tsx`, `trend-chart-edge-labels.tsx`, `trend-chart-pinned-cards.tsx`, `trend-chart-hover-card.tsx`에 둔다. 플롯 SVG(프레임·데이터·십자선·스코프 드래프트)는 `trend-chart-plot-svg.tsx`, X축 눈금 레일은 `trend-chart-x-axis.tsx`에 둔다. 데이터 지점 히트는 `trend-chart-hit.ts`, 호버 카드에 올릴 값은 `trend-chart-hover-live.ts`에 둔다. 결측 구간과 세그먼트 빌더는 `trend-chart-geometry.ts`에 둔다. 클라이언트 좌표 변환과 포인터 핸들러는 플롯 루트에 남긴다.  
통합 추세 순수 로직은 `unified-trend-split-y.ts`(값↔밴드), `unified-trend-split-y-overflow.ts`(이탈 스케일), `unified-trend-split-y-ticks.ts`(밴드 눈금), `unified-barn-trend-layout.ts`(밴드 기하), `unified-trend-y-bands.ts`(레이어·Y밴드 마스킹), `unified-trend-raw.ts`(집계·EMA), `unified-trend-build.ts`(시리즈 조립), `unified-trend-layers.ts`(레이어 선택·트림), `unified-trend-colors.ts`(색·이름)에 둔다. `unified-barn-trend-series.ts`는 임계 코리도와 공개 이름 재export만 남기고, 기존 `@/lib/farm/unified-barn-trend-series` import는 유지한다. 이 모듈은 차트를 그리지 않으므로 markup 스냅샷 대상이 아니다.  
`UnifiedBarnTrendPanel`의 경보 눈금은 `unified-barn-trend-scale-edges.ts`, 제목 마크는 `unified-barn-trend-scope-marks.tsx`, 헤더는 `unified-barn-trend-panel-header.tsx`에 둔다. 표시 창 집계는 `unified-barn-trend-window.ts`, 명령 설정 오버레이는 `unified-barn-trend-command-overlay.ts`, X 스코프 인덱스·15분 구간은 `unified-barn-trend-x-scope.ts`에 둔다. 스코프 시계열 재집계는 `unified-barn-trend-scoped.ts`, 안내 제스처의 플롯 비율은 `unified-barn-trend-guided-scope.ts`, TrendChart에 넘기는 값 조립은 `unified-barn-trend-chart.tsx`에 둔다. 줌 스택 setState와 humanize 캐시는 패널에 남긴다.  
농장 허브의 데스크톱 현장 스플릿은 `farm-field-split.tsx`, 차트 탭 슬롯은 `farm-chart-slot.tsx`에 둔다. 보기 탭은 `farm-view-toggle.tsx`에 둔다.

---

## 5. 게이트 (push 전)

```bash
cd web
npm run check          # lint → typecheck → test → knip
npm run verify:design  # 모션·밀도·어포던스 토큰
npm run build          # 더미 Supabase env로도 통과해야 함
```

GitHub Actions(`.github/workflows/web-verify.yml`)와 GitLab CI가 동일 단계를 실행한다 ([`GITLAB_CI.md`](./GITLAB_CI.md)).

---

## 6. 후속(P2) 과제

| 항목 | 이유 | 완료 조건 |
|------|------|-----------|
| ~~`lib/data/iot.ts` 타입 → `lib/domain/iot-types.ts`~~ | 완료 (P2-0, 2026-10-11). `iot.ts` 446→214줄 | — |
| ~~`lib/**` → `@/app/**`~~ | 완료 (P2-14). 런타임 3곳 주입 · `OAuthProvider`는 `lib/auth` · provider는 `components/farm`. ESLint가 `lib` → `@/app`를 막는다 | — |
| ~~`unified-barn-trend-series.ts` 구현 분리~~ | 완료 (P2-2). 배럴 2387→310줄. 구현은 `unified-trend-split-y` · `raw` · `build` · `layers` · `colors` | — |
| 500 LOC+ 핫스팟 분해 | §4 | `trend-chart.tsx` · `unified-barn-trend-panel.tsx` · `farm-page-content.tsx` |
| vitest 도입 | coverage · watch | 패키지 추가 승인 필요 |

---

## 변경 이력

| 날짜 | 내용 |
|------|------|
| 2026-10-11 | 초안 — P1: `lib/domain` 분리(38+15 test) · 피처 hook `components/`로 · `lib/data/browser` · ESLint 경계 규칙 |
| 2026-10-11 | P2-0: `iot-types.ts` · `barn-meta-types.ts` 분리, domain → data 타입 import 금지로 전환 |
| 2026-10-12 | P2-2: `unified-barn-trend-series.ts` 구현을 split-y·raw·build·layers·colors로 분리. 배럴 재export로 import 경로 유지 |
| 2026-10-12 | P2-3: 통합 추세 패널에서 경보 눈금·헤더를 분리. `unified-barn-trend-panel.tsx` 2148→1763줄 |
| 2026-10-12 | P2-4: 농장 보기 탭을 `farm-view-toggle.tsx`로 분리 |
| 2026-10-12 | P2-5: 통합 추세 패널의 창 집계·명령 오버레이·X 스코프 계산을 분리. `unified-barn-trend-panel.tsx` 1763→1566줄 |
| 2026-10-12 | P2-6: 농장 현장 스플릿과 차트 슬롯을 `farm-field-split.tsx` · `farm-chart-slot.tsx`로 분리. `farm-page-content.tsx` 798→749줄 |
| 2026-10-12 | P2-7: 추이 차트 데이터 지점 히트를 `trend-chart-hit.ts`로 분리. `trend-chart.tsx` 2022→1810줄. 포인터 핸들러는 플롯 루트에 유지 |
| 2026-10-12 | P2-8: `unified-trend-split-y.ts`에서 이탈 스케일과 밴드 눈금을 분리. 842→688줄 |
| 2026-10-12 | P2-9: 추이 차트 플롯 SVG와 X축 눈금 레일을 `trend-chart-plot-svg.tsx` · `trend-chart-x-axis.tsx`로 분리. `trend-chart.tsx` 1810→1574줄. 포인터 핸들러는 플롯 루트에 유지 |
| 2026-10-12 | P2-10: 통합 추세 패널의 스코프 재집계와 안내 제스처 비율을 분리. `unified-barn-trend-panel.tsx` 1566→1376줄. 줌 setState는 패널에 유지 |
| 2026-10-12 | P2-11: `unified-barn-trend-layout.ts`에서 레이어·Y밴드 마스킹을 `unified-trend-y-bands.ts`로 분리. 872→435줄. 기존 import는 레이아웃 재export로 유지 |
| 2026-10-12 | P2-12: 호버 카드 값과 결측·세그먼트 빌더를 분리. `trend-chart.tsx` 1574→1528줄. 포인터 핸들러는 플롯 루트에 유지 |
| 2026-10-12 | P2-13: 통합 추세 패널의 TrendChart 값 조립을 `unified-barn-trend-chart.tsx`로 분리. `unified-barn-trend-panel.tsx` 1376→1276줄. 줌 setState는 패널에 유지 |
| 2026-10-12 | P2-14: `lib`가 서버 액션을 직접 부르지 않게 한다. 패널 enrich·푸시 등록은 호출측이 액션을 주입하고, 라이브 리프레시 provider는 `components/farm/farm-live-refresh.tsx`로 옮겼다. `OAuthProvider`는 `lib/auth/oauth-provider.ts`로 옮기고 액션이 재export한다 |
