# UI Motion System (Phase 1)

PC·모바일·브라우저 공통 **motion token + L2 preset** 레이어.  
Phase 1은 **규칙·프리셋·검증**까지 — 컴포넌트 전면 마이그레이션은 Phase 2~3.

관련 디자인 문서: [UI_DENSITY.md](./UI_DENSITY.md) · [UI_ELEVATION.md](./UI_ELEVATION.md) · [UI_CHROMA.md](./UI_CHROMA.md) · [UI_FEEDBACK.md](./UI_FEEDBACK.md)

## 아키텍처

```
L1  motion-tokens.ts + globals.css :root (--motion-*)
      ↓
L2  motion-classes.ts + globals.css (.ui-motion-*)
      ↓
     motion-preset.ts (intent → className)
      ↓
L3  컴포넌트 (button, dialog, farm/* …)
```

| 파일 | 역할 |
|------|------|
| `src/lib/ui/motion-tokens.ts` | duration·easing·distance·intent 매핑 |
| `src/lib/ui/motion-classes.ts` | Tailwind + surface class 프리셋 |
| `src/lib/ui/motion-preset.ts` | `motionPresetForIntent("enter")` 헬퍼 |
| `src/app/globals.css` | `@keyframes` · `.ui-motion-*` surfaces |
| `scripts/verify-motion-tokens.mjs` | TS ↔ CSS 동기 검증 |

검증: `npm run verify:motion-tokens`

---

## L1 — Duration

| Token | ms | 용도 |
|-------|-----|------|
| `fast` | 120 | hover, focus, chip, badge |
| `normal` | 200 | dialog, dropdown, toast enter, fade |
| `moderate` | 280 | panel expand, collapsible, stagger |
| `emphasis` | 360 | heat morph, 강조 전환 |
| `exit` | 150 | toast/modal exit |
| `viewCrossfade` / `view` | 150 | map ↔ list opacity |

## L1 — Easing

| Token | curve | 용도 |
|-------|-------|------|
| `standard` | decel-accel | 일반 transition |
| `enter` | decelerate | 등장 |
| `exit` | accelerate | 퇴장 |
| `emphasis` | soft bounce | morph·강조 |

## L1 — Distance

| Token | px |
|-------|-----|
| `sm` | 4 |
| `md` | 8 |
| `lg` | 16 |
| `slidePercent` | 28 (`--motion-distance-slide: 28%`, 캐러셀 전용) |

Stagger step: **40ms** (`motionStaggerStepMs`) — PC·모바일 동일.

---

## L2 — Intent → Preset

| Intent | Duration | Easing | Preset / Surface |
|--------|----------|--------|------------------|
| `micro` | fast | standard | `motionClass.microInteractive` |
| `surface` | normal | standard | `motionClass.surfaceRing` |
| `enter` | normal | enter | `ui-motion-enter-fade` |
| `exit` | exit | exit | `ui-motion-exit-fade` |
| `layout` | moderate | standard | `ui-motion-panel-expand` |
| `emphasis` | emphasis | emphasis | `farm-heat-morph` |
| `view` | view | standard | `motionClass.viewCrossfade` |

### 코드 예

```tsx
import { motionClass } from "@/lib/ui/motion-classes";
import { motionPresetForIntent } from "@/lib/ui/motion-preset";

// Micro hover
<button className={cn(motionClass.microInteractive, "rounded-lg px-3")} />

// Enter fade surface
<div className={motionPresetForIntent("enter")} />

// Panel expand (data-open 토글)
<div className={motionClass.panelExpand} data-open={open}>
  <div className={motionClass.panelExpandInner}>{children}</div>
</div>

// Stagger — index * motionStaggerStepMs
<div
  className={motionClass.staggerIn}
  style={{ animationDelay: `${index * 40}ms` }}
/>

// shadcn portal
<DialogContent className={cn(motionClass.portalEnter, motionClass.durationNormal)} />
```

---

## L2 — Surface classes (globals.css)

| Class | 용도 |
|-------|------|
| `ui-motion-enter-fade` | fade in |
| `ui-motion-exit-fade` | fade out |
| `ui-motion-enter-slide-up` | slide + fade in |
| `ui-motion-panel-expand` | `grid-template-rows` expand |
| `ui-motion-panel-expand-inner` | expand inner clip |
| `ui-motion-stagger-in` | stagger item (필드 컨트롤러 격자) |
| `ui-motion-toast` | toast enter/exit |
| `ui-motion-modal-backdrop` / `ui-motion-modal-panel` | bulk modal |
| `ui-motion-command-overlay` / `ui-motion-command-card` | command pipeline · 설정값 편집 팝업 |
| `settings-collapsible-*` | 설정 collapsible |
| `farm-heat-morph` | 그리드 확대 morph |
| `cover-reveal-flip-play` / `cover-reveal-ghost-fade-play` / `cover-reveal-glyph-play` / `cover-reveal-fill-play` | 필드 덮개 걷힘. 명칭·번호는 헤더와 자리를 맞춰 변환 없음. 채움은 카드 테두리로 흡수. 값 글자는 온습 구간 테두리로 흩어지며, 구간은 한 번만 옅은 glow (`cover-reveal-band-glow`) |
| `cover-reveal-*-reverse` / `ghost-fade-in` / `band-glow-out` / `humidity-out` | 덮개 다시 가림 — 걷힘의 역재생. 채움은 테두리에서 차오르고, 값 글자는 구간에서 가운데로 모인다. 명칭·번호는 채움 위에 유지 |
| `cover-reveal-humidity-in` | 덮개에 없던 상대 채널 막대 등장 |
| `farm-chart-plot-reveal` | 차트 탭 좌→우 clip reveal |
| `farm-chart-tip-in` / `farm-chart-tip-out` | 차트 상호작용 오버레이(호버·핀 카드, 빈 지표 안내, 줌 드래프트, 기준선 강조) 등장/퇴장 |
| `farm-chart-crosshair` | 십자선·칩 opacity (fast 토큰) |
| `farm-chart-envelope-in` / `farm-chart-line-soft-in` / `farm-chart-marker-pop` | 클라우드·라인·점 등장 |
| `farm-chart-brush-window` | 기간 브러시 윈도우 transition |
| `farm-chart-band-guide-in` / `farm-chart-band-guide-out` | 분할 가이드 점선 등장/퇴장 |
| `farm-chart-scope-shell` / `farm-chart-panel-shell` | 차트 탭 레이아웃 등장 |
| `farm-view-tab-pill` | 보기 탭·채널 A/B/C 초록 패딩 left/width 슬라이드 |
| `farm-detail-carousel` | 컨트롤러 상세 캐러셀 클립 컨테이너 |
| `farm-detail-slide-enter-next` / `enter-prev` | 캐러셀 enter (버튼 방향에서 진입) |
| `farm-detail-slide-exit-next` / `exit-prev` | 캐러셀 exit (반대쪽으로 퇴장, enter와 겹침) |
| `farm-detail-slide-next` / `farm-detail-slide-prev` | enter 별칭 (하위 호환) |
| `header-tools-panel` / `header-tools-icon` | 헤더 도구 — TopBar 상시 가로 아이콘 (상세 패널 앵커) |
| `barn-list-panel-shell` | 목록 패널 (domain, Phase 2) |

---

## Do / Don't

**Do**

- `motionClass.*` · `motionPresetForIntent()` · `.ui-motion-*` 만 사용
- `transition-[property]` 로 속성 명시
- enter 200ms / exit 150ms 비대칭 유지
- `prefers-reduced-motion` — 토큰이 0ms로 자동 축소

**Don't**

- `transition-all`
- `duration-300`, `duration-500` 등 임의 Tailwind duration
- 모바일만 다른 ms (레이아웃만 다르게)
- hover마다 다른 easing

---

## PC · 모바일 · 브라우저

| 항목 | 정책 |
|------|------|
| duration / easing | **동일** |
| bottom sheet | `motionClass.sheetEnter` + `durationEmphasis` (접힘·펼침 360ms). 차트로 옮기기: 탭 전환 280ms + 인지 360ms 뒤 시트 접힘 360ms |
| portal (dialog) | `motionClass.portalEnter` + `durationNormal` |
| scroll-driven | 모바일 `auto` (투어·vv 대응), duration은 동일 |
| preview frame | `[data-viewport-preview="mobile"]` — duration 동일, max-height만 조정 |

---

## Chart motion budget (bundle C · H2)

| 규칙 | 내용 |
|------|------|
| Duration | 차트 surface는 `fast`/`normal`/`moderate`/`emphasis`/`exit`만. 오버레이(습도 슬롯 만남 → 위젯 높이 팽창)는 `moderate` 두 단계 |
| Infinite | hover-ring · scope-handle-pulse는 **정적** |
| Amplitude | enter `scale ≥ 0.85` (토큰 `--motion-chart-scale-from: 0.92`) · exit `0.94` · **overshoot ≤ 1.08 금지**. 미니칸→펼침은 FLIP `transform` + `clip-path`/`opacity`(emphasis/moderate 토큰). |
| Rotate | `farm-chart-*` 키프레임에서 `rotate()` 금지 |
| Spring | 다단 bounce(1.12→0.97) 제거 — enter/exit 2키프레임 |
| Stagger | 리터럴 ms 대신 `--motion-duration-fast` 배수 |
| Glow | 라인 글로우 라이트 `0.12` / 다크 `0.28` |
| Blur | 레이어 enter/exit blur 없음 |

검증: `npm run verify:motion-css` (리터럴 ms · infinite · **amplitude**)

---

## Documented motion exceptions (bundle D)

의도적으로 토큰/`infinite` 규칙을 벗어나는 surface. 신규 예외는 여기와 `verify-motion-css` allowlist에 함께 추가.

| Surface | 이유 |
|---------|------|
| `.ui-motion-soft-refresh-bar` | 진행 인디케이터 (1.2s loop) |
| `.login-splash-logo` | 스플래시 입장 `--motion-duration-presence` (1200ms, 구 2s) — easing=`emphasis` |
| `.login-splash-dot` | 로그인 스플래시 점 점멸 (장주기) — easing=`standard` |
| `.farm-tour-accent` | 온보딩 스포트라이트 (장주기) — easing=`standard` |
| `.farm-ctrl-focus` | 컨트롤러 포커스 펄스 2s×2 — easing=`enter` |
| `.health-dag-*` edge flow | 헬스 DAG 흐름 표시 |

**토큰 정렬 (투어·로그인)**: 리터럴 `cubic-bezier` / `ease-*` 제거.  
hole=`moderate`+`emphasis`, tip=`normal`+`enter`, exit=`exit`+`enter`. accent glow=`--channel-hum`.

톤 경계: [`UI_ARIA_PRESENCE.md`](./UI_ARIA_PRESENCE.md) (H5, 뱃지만).

---

## Channel color tokens

| CSS var | Tailwind | 용도 |
|---------|----------|------|
| `--channel-fan-intake/exhaust/supply` | `channel-fan-*` | 모터 A/B/C 시리즈 |
| `--status-warn` / `--status-danger` | `status-warn` 등 | 알람 참조선·심각도 |
| `--chart-guide` | — | 차트 가이드(상·하한) |

차트 SVG는 `TREND_CHART_COLORS` / `SEV_COLOR`가 `var(--…)`를 사용한다 (T3).

공용 클래스: `dashboardUi.channelTint*` / `chartLayerGroup*` / `opsStatus.info`.  
신규 채널·정보 UI는 `sky`/`rose`/`amber`(모터) 하드코딩 금지 — `channel-*` 또는 `opsStatus`/`primary` 사용.  
경고(주의)만 `amber` 유지.

**DELIN 뱃지 (H5)**: 필드 우측 하단만(차트 숨김). 오브·도크 모션 없음. 상세=`UI_ARIA_PRESENCE.md`.

**규칙**: 새 UI는 `motionIntent` / `motionClass`만 사용. 임의 `duration-N`·`transition-all`·차트 리터럴 ms 금지.

---

## Phase roadmap

| Phase | 범위 | 상태 |
|-------|------|------|
| **0** | L1 tokens, CSS vars | ✅ |
| **1** | L2 presets, intent map, verify script, this doc | ✅ |
| **2** | ui/* shadcn + farm domain 마이그레이션 | ✅ |
| **3** | ESLint guard, Playwright motion snapshots | ✅ |

### Phase 2 적용 요약

**ui/** — `button`, `badge`, `tabs`, `input`, `checkbox`, `table`, `select`, `dialog`  
→ `microInteractive` / `microHover` / `portalEnter` + easing

**farm/** — `farm-page-content` 탭, `farm-map-canvas`/`mobile-stage` 카드,  
`barn-table` refresh ring, `bulk-apply` 스위치, `barn-controller-mobile-sheet` 트랙,  
툴바·기간 토글·패널 닫기·피커·게이지 pill·목록 SP 칩 등  
→ 임의 `duration-300` / `transition-all` 제거, L2 preset 치환

### Phase 3 가드레일

| 명령 | 역할 |
|------|------|
| `npm run lint` | `no-restricted-syntax` — `transition-all`, `duration-N` (non-motion), `sky-*`/`rose-*` |
| `npm run verify:motion-classes` | src 전체 문자열 스캔 (ESLint 보완) |
| `npm run verify:motion-css` | farm-chart 리터럴 ms · infinite 가드 |
| `npm run verify:ui-colors` | `sky`/`rose` 유틸 + 차트 레거시 hex (`#ef4444` 등) 회귀 가드 |
| `npm run verify:ui-density` | 인라인 `1.75rem`/`1.625rem` 금지 |
| `npm run verify:ui-elevation` | `hover:shadow-*` · `bg-card`+`shadow-lg` 금지 |
| `npm run audit:motion-reduced` | CSS reduce 정적 검수 + Playwright 런타임 (BASE 가용 시) |
| `npm run verify:motion` | tokens + classes + css + reduced 일괄 |
| `npm run verify:design` | motion + ui-colors + density + elevation |

런타임 강제: `STRICT_MOTION_RUNTIME=1 npm run audit:motion-reduced`  
또는 `npm run audit:motion-reduced:ci` (`--strict`, CI 권장)

#### T5 — 색·채널 회귀

- Tailwind: `sky-*` / `rose-*` / `violet-*` / `orange-*` → `channel-temp|hum|motor|info` 또는 `primary` / status
  (주의·경고 UI의 `amber-*` / `--status-warn`은 허용)
- 차트 SVG: `TREND_CHART_COLORS` / `--status-*` / `--channel-*` (리터럴 `#ef4444` `#0ea5e9` `#10b981` `#22c55e` 금지)
- 브러시 양호도: `comfortScoreToColor` → `--status-ok|warn|danger` + `color-mix`
- allowlist: `oauth-buttons.tsx`(카카오 브랜드색)
- reduced-motion: ARIA dock·차트 hover-ring·slide-up 셀렉터도 정적 검수

#### T2 — UI density

- `docs/UI_DENSITY.md` — `comfortable` / `compact`, `--density-*`, 헤더 토글
- 타이포·컨트롤: `dashboardTypography` / `dashboardControl` / `dashboardUi` → CSS 변수
- `opsTypography`·차트 내부는 별도(이미 조밀)

#### Elevation

- `docs/UI_ELEVATION.md` — canvas → recessed → card → overlay (2~3단)
- `dashboardElevation` 프리셋 · `verify:ui-elevation` (`hover:shadow-*` 금지)
- 라이트: `shadow-sm` + ring · 다크: `shadow-none` · overlay만 `shadow-md`+

#### H3 — 데이터 퍼스트 채도

- `docs/UI_CHROMA.md` — 크롬 낮음 / 채널·알람 고채도
- `dashboardChroma` · 헤더·탭·scope·스켈레톤·emptyState

#### H4 — 운영 피드백

- `docs/UI_FEEDBACK.md` — `ops-feedback` 톤 · 파이프라인 step 0..3
- toast / command overlay / bulk banner 통일
- `npm run audit:motion-reduced:ci` (`--strict`)

헤더에서 밀도 토글 스모크 + `npm run verify:design`

---

## 동결 · 유지보수 (시스템 1.0)

H1–H5 완료. **새 장식 모션·임의 hue 추가 금지.**  
변경은 버그 수정·토큰 정렬·문서화된 예외만. 고급감 갭·수동 QA: [`UI_VISUAL_QA.md`](./UI_VISUAL_QA.md).

색 가드: `sky` / `rose` / `violet` / `orange`(온도) Tailwind 유틸 → `channel-*` / `primary` / `status-*`.  
주의(경고)만 `amber` / `--status-warn` 유지.

---

## prefers-reduced-motion

`globals.css` `@media (prefers-reduced-motion: reduce)`:

- `--motion-duration-*` → `0ms`
- `.ui-motion-*` animation/transition 비활성화
- `.ui-motion-panel-expand`, `.barn-list-panel-shell`, `[data-farm-view-panel]` transition off
