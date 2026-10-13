# UI 토큰

면, 단, 밀도, 채도, 어포던스, 피드백, 모션. 검증 기록은 [`UI_QA.md`](./UI_QA.md).


---

## 면

## UI Surfaces (종류 · Glass 전 정본)

대시보드 UI는 축(H1–H5)과 **면 종류**를 같이 본다.  
Elevation 단(0~3)만으로는 덮개·히트맵·델린·시트가 한 덩어리로 섞인다.

관련: [단](#단) · [채도](#채도) · [밀도](#밀도) · [모션](#모션) · [피드백](#피드백) · [환경 상태](./farm-hub-url.md#환경-상태-정책) · [어포던스](#어포던스)  
코드: `dashboardElevation` · `dashboardUi` · `dashboardChroma` · `dashboardHubSurface` · `dashboardAffordance` (`src/lib/ui/dashboard-page-ui.ts`)  
프리미티브: `src/components/ui/` · 농장: `src/components/farm/`

Glass(서리·투시)는 **이 표의 종류를 고른 뒤에만** 넣는다. 신규 글로우·무한 펄스·H6는 별도 승인.

### 이미 있는 축 (바꾸지 않음)

| 축 | 규칙 | 토큰 |
|----|------|------|
| Brand | 선택·CTA만 | `--primary` |
| Status | 정상·주의·위험 | `--status-ok\|warn\|danger` + `-ink`. `--destructive` = `--status-danger` (폼·삭제) |
| Ink | 본문 → 보조 → 힌트 → 장식 | `--foreground` · `--muted-foreground` · `--tertiary-foreground` · `--quaternary-foreground` |
| Channel | 온·습·모터·정보·명령 | `--channel-temp\|hum\|motor\|info\|command` |
| Density | 목록 readout · 맵 `--density-map-value*` · 덮개 `valueLg` | `dashboardTypography` / `dashboardReadout` |
| Elevation | 0 바탕 · 1 우물 · 2 카드 · 3 오버레이 | `dashboardElevation` |
| Motion | L1 `--motion-*` · L2 `motionClass` | `UI.md` |
| Chroma | 크롬 낮음 · 데이터·알람 높음 | `dashboardChroma` |
| Affordance | 명령·도구·선택군·칩·히트면·잉크 | `dashboardAffordance` |
| Fill | 우물=`--muted` 믹스 · 회색 컨트롤=`--secondary` · 대기 버튼=`--control`(primary 12%+secondary) · 켜짐=`--control-active`(22%) | `--secondary`는 muted 복제 금지. `--control`은 `.dark`에서 oklch 재지정 금지(믹스 상속) |

### 면 종류 (8)

| 코드 | 이름 | 하는 일 | 대표 | 면 | 색 |
|------|------|---------|------|----|----|
| **A** | Chrome | 찾아가기 | 탑바, 뷰 탭, 하단 내비, 헤더 도구 | 바탕·border | 대기 `--control` · 선택 `--control-active`. status 솔리드 금지 |
| **B** | Document | 본문 그릇 | `SectionCard`, 설정 카드, `dashboardElevation.card` | 단 2 | `bg-card`. 안에 카드 겹쌓기 금지 |
| **C** | Well | 격자 우물 | 필드 그리드 배경, `hubSurface.well` | 단 1 | `--surface-well` |
| **D** | Tile | 한 컨트롤러/축사 칸 | `FarmMapCard`, `hubSurface.tile` | 단 2 | `bg-card` + 약한 ring. 열리면 테두리에 판정색 |
| **E** | Status film | 판정을 면으로 | 덮개, 왼쪽 현황 | 타일 **위** | `--status-*`만. 채널색 금지 |
| **F** | Overlay | 떠서 가림 | Dialog, 시트, 드롭다운, FAB 패널 | 단 3 | `bg-popover`. 기존 `backdrop-blur`는 여기만 |
| **G** | Feedback | 적용 결과 | 토스트, 명령 오버레이, 적용 큐 | 단 3 float | `opsFeedbackTone` |
| **H** | Presence | 델린만 | 뱃지 | 예외 | status 톤. 덮개에 복제 금지 |

숫자·차트 잉크는 면이 아니다. 채널/status 토큰으로 **글자·선·셀**만 칠한다.

- **정상(ok) 타일**: 수치에 채널색 허용 (`text-channel-temp|hum|…`).
- **주의·위험·끊김 타일**: 수치는 `controllerEnvMetricTextClass` → `--status-*-on-canvas` / muted. 채널 구분은 ℃·% 등 단위 라벨로. 덮개 글자만 `--status-*-ink`.
- **차트 시리즈**: `TREND_CHART_COLORS` = `var(--channel-*)`. 알람 점선만 `var(--status-warn)`. 모터는 `TREND_CHART_COLORS_PRINT` hex(status와 동일 hex 금지).

### 컴포넌트 맵

| 묶음 | 경로 | 기본 종류 |
|------|------|-----------|
| 프리미티브 | `components/ui/` (Button, Card, Dialog, Input, Select, Slider, Table, Tabs, Tooltip…) | A 컨트롤 · B 카드 · F 대화 |
| 허브 셸 | `farm-dashboard-shell`, `dashboard-viewport-shell`, 탑바 | A |
| 필드 격자 | `barn-table`, `farm-field-status-grid`, `farm-map-card` | C 우물 + D 타일 |
| 덮개 | `controller-env-cover`, `cover-reveal-overlay` | **E** |
| 차트 | `farm-chart-view`, `trend-chart`, `severity-heatmap` | B + 데이터 잉크 |
| 시트 | `barn-panel-bottom-sheet`, 모바일 시트 | F |
| 명령 | `command-pipeline-overlay`, 필드 덮개 채널 스트립, 설정 한눈 행 채움, 명령 프리셋 칩·생성 카드 | G. 생성·행 편집 채널 묶음은 카드 안 C 우물 |
| 델린 | `delin-env-badge` | H |
| 운영 | `/admin/ops`, `opsTypography` | B · 밀도는 허브 2× 없음 |

### Glass 전에 맞출 것

1. **덮개는 E다.** 지금은 불투명 면 + 유리 테. F의 `bg-card/95` + blur를 덮개에 복사하지 않는다.
2. **이미 있는 blur는 F·H·G다.** 헤더, Dialog, 시트, FAB, 명령 카드, 델린 뱃지. 새 토큰 없이 덮개에 넣으면 종류가 섞인다.
3. **채도 계단은 E·히트맵 셀만.** 크롬(A)·카드(B) 배경을 status 솔리드로 바꾸지 않는다.
4. **한 타일(D) 안에 단 2 카드를 또 쌓지 않는다.** 덮개를 걷으면 게이지는 포켓(C/metricPocket)이다.
5. **알림 헤더 버튼** `topHeaderActionBtnAlert`는 `--status-danger`. 리포트는 우물 면. 위치만은 `channel-info`.
6. **델린 뱃지**는 H 전용. 덮개 Glass 후보에서 뺀다.

### Glass를 허용하는 자리 (승인 후)

| 종류 | Glass | 이유 |
|------|-------|------|
| A Chrome | 금지 | 크롬은 낮고 불투명 |
| B Document | 금지 | 본문은 카드 면 |
| C Well | 금지 | 우물은 깔개 |
| D Tile | 금지 | 타일 자체가 유리면 안 됨. 위는 E |
| **E Status film** | **유리 테** | 면은 불투명. 위 `--status-film-rim-hi` · 아래 `--status-film-rim-lo`. 서리(블러)는 별도 승인 |
| F Overlay | 유지 | 이미 popover frost |
| G Feedback | 유지 | 이미 float |
| H Presence | 유지 | 델린만. 덮개에 이식 금지 |

E 덮개: `--status-*` 불투명 면 + `dashboardChroma.statusFilmGlassRim`. 흰 글자·무한 글로우·새 easing 없음. 잉크는 `--status-*-ink`. 서리 막(블러)은 아직 없음.

### 검증

- 면·그림자: `npm run verify:ui-elevation:strict` (게이트는 `verify:design`에 밀도·모션)
- 밀도: `npm run verify:ui-density`
- 모션: `npm run verify:motion`

새 면 종류를 만들 때는 이 문서 표를 먼저 고치고, 그다음 프리셋·컴포넌트.


---

## 단

## UI Elevation

대시보드 **면(surface) 계층** — 라이트 모드에서 깊이감은 그림자보다 **배경 리프트 + border/ring** 위주.  
카드·그림자를 남용하지 않고 **2~3단**만 유지한다.

관련: [모션](#모션) · [밀도](#밀도) · [면](#면) · `src/lib/ui/dashboard-page-ui.ts`

### 래더 (권장 4단 → 실제 사용 2~3단)

| 단 | 이름 | 배경 | 경계 | 그림자 (라이트) | 용도 |
|----|------|------|------|-----------------|------|
| **0** | Canvas | `bg-muted/30` (body) / `bg-background` | 없음 | 없음 | 페이지 바탕 |
| **1** | Recessed | `bg-muted/40` ~ `bg-muted/50` | `border` 선택 | 없음 | 스트립·칩 영역·보조 패널 (`sectionMuted`, `scopeBar`, `statCompact`) |
| **2** | Raised card | `bg-card` | `border` + (컨텍스트만) `ring-1 ring-foreground/15` | `shadow-sm` · **다크는 `shadow-none`** | 본문 섹션·컨텍스트 패널 (`section`, `contextPanel`, `statCard`) |
| **3** | Overlay | `bg-popover` / `bg-popover/95` | `border` + `ring-1 ring-foreground/10` | `shadow-md` ~ `shadow-lg` | 드롭다운·헤더 도구·차트 FAB·ARIA 패널 |

원칙:

1. **한 화면에 Raised(2)를 겹겹이 쌓지 않는다** — 카드 안에 또 `bg-card`+shadow 금지. 내부는 Recessed(1) 또는 flat border.
2. **라이트에서 카드 lift**는 `shadow-sm` + (필요 시) 약한 ring. 다크는 shadow 끄고 border/ring만.
3. **Overlay(3)만** `shadow-md`/`lg` 허용. 본문 카드에 `shadow-lg` 쓰지 않는다.
4. **호버로 elevation 올리지 않기** — `hover:shadow-*` 금지. 선택 가능 타일은 `dashboardElevation.interactiveHover`(ring). (`verify:ui-elevation`)

### 프리셋 (`dashboardElevation`)

| 키 | 단 | 클래스 요지 |
|----|----|-------------|
| `card` | 2 | `bg-card` + `shadow-sm` · dark `shadow-none` |
| `cardEmphasis` | 2 | + ring |
| `recessed` | 1 | `bg-muted/45` |
| `well` | 1 | hub 그리드·SP 우물 — `--surface-well` (갭1/5) |
| `tile` | 2 | hub 축사 타일 — `--surface-shadow-tile` + ring |
| `metricPocket` | 1 | 타일 안 주 지표 — `--surface-pocket` |
| `overlay` / `overlayStrong` | 3 | popover + `shadow-md`/`lg` |
| `float` | 3 | `bg-background` + `shadow-lg` (모달 셸·토스트) |
| `interactiveHover` | — | `hover:ring-*` only |

허브 면·여백 묶음: `dashboardHubSurface` (`well` / `tile` / `metricPocket` / `gridGap`).

### `dashboardUi` 매핑

| 프리셋 | 단 | 비고 |
|--------|----|------|
| `section` | 2 | ≈ `dashboardElevation.card` + pad |
| `contextPanel` | 2 | ≈ `cardEmphasis` |
| `sectionMuted` | 1 | ≈ `recessed` |
| `innerCard` / `chipCard` / `metricTile` | 1~2 경계 | border만, **shadow 없음** |
| `scopeBar` | 1 | `bg-muted/40` |
| `statCard` | 2 | shadow는 래퍼에 두지 않음(테두리만) |
| `headerToolsCard` | 1~2 | `bg-background` + border (패널 안 행) |
| 헤더 캐스케이드 / Tooltip / Dialog | 3 | `overlay` |

신규 UI는 `dashboardElevation` / `dashboardUi` 프리셋을 재사용한다. 임의 `shadow-*` + `bg-card` 조합을 새로 만들지 않는다.

검증: `npm run verify:ui-elevation`

### Z-index (오버레이만)

Elevation 단과 별개로, **떠 있는 UI**의 쌓임 순서:

| 대역 | 예 |
|------|----|
| `z-40` | 모바일 하단 내비, 투명 스크림 |
| `z-50` ~ `z-[60]` | 헤더 트리거, FAB, 차트 레이어 FAB |
| `z-[70]` ~ `z-[80]` | 차트 레이어 툴바·툴팁 |
| `z-[9990]` | 온보딩 투어 (최상위) |

본문 카드·섹션에는 z-index를 주지 않는다.

### 라이트 vs 다크 (갭5)

| | 라이트 | 다크 |
|--|--------|------|
| Canvas | cool muted 바탕 | `bg-background` (L≈0.145) |
| Recessed / well | `--surface-well` (muted 쪽) | muted **≤** card — 우물이 카드보다 어두움 |
| Card / tile | `bg-card` + `--surface-shadow-tile` + `--surface-ring` | shadow 없음 · ring 14% · card L≈0.22 |
| Meta 글자 | `--muted-foreground` | L≈0.64 (구 0.70 — 눈부심↓). 힌트=`--tertiary-foreground`, 장식=`--quaternary-foreground` |
| ARIA stage | `--aria-stage-*` / `--aria-glow` | primary 글로우 약화 |

토큰: `--surface-well|pocket|ring|shadow-tile`, `--aria-stage-from|to`, `--aria-glow` (`globals.css`).

색 토큰(`--card`, `--popover`, `--muted`, `--secondary`)은 `globals.css` — elevation은 **면의 역할**만 정하고 채널/status 문법을 따른다. `--muted`는 우물·hover 워시, `--secondary`는 버튼/뱃지 회색 채움(muted와 동일 값 금지).

### Do / Don't

**Do**

- 페이지 = Canvas(0) → 섹션 = Raised(2) → 섹션 안 그룹 = Recessed(1) 또는 border-only
- 메뉴·시트·플로팅 = Overlay(3) + popover 토큰
- 컨텍스트만 강조할 때 `contextPanel` ring 사용

**Don't**

- 통계 타일마다 `shadow-md`
- 카드 중첩 + 각각 shadow
- 본문에 `bg-popover` (오버레이 전용)
- elevation으로 상태(정상/경고) 표현 — status/channel 색 사용

### 변경 시

1. 새 surface가 필요하면 먼저 기존 단(0~3)에 맞는지 확인.
2. 새 단을 추가하지 말고, `dashboardUi` 프리셋에 매핑.
3. 이 문서와 `dashboard-page-ui.ts` 주석을 함께 갱신.


---

## 밀도

관련: [모션](#모션) · [단](#단)

## UI Density (T2)

대시보드 **comfortable / compact** 밀도 모드.

### 모드

| 값 | 의미 |
|----|------|
| `comfortable` (기본) | PC `md`에서 타이포·컨트롤 ≈ 기존 2× 스케일 |
| `compact` | PC에서도 모바일급 조밀 스케일 (`--density-*-md` 축소) |

- 저장: `localStorage.dashboard-density` (`DENSITY_STORAGE_KEY`)
- DOM: `html[data-density="comfortable"|"compact"]`
- 초기화: `src/app/layout.tsx` beforeInteractive 스크립트
- 헤더 밀도 토글은 현재 연결되지 않음 (값은 저장된 compact가 있으면 유지)

### 토큰

`globals.css` `:root` / `html[data-density="compact"]` 의 `--density-*`.

역할별 클래스는 `dashboardTypography` · `dashboardControl` · `dashboardUi` · `densityClass` 가  
`text-[length:var(--density-…)]` / `h-[length:var(--density-control-h…)]` 로 참조.

인라인 `text-[1.75rem]` / `1.625rem` 금지 — `npm run verify:ui-density`.

opsTypography / farm 차트: A안 — **차트 탭** `.farm-chart-ui` + `--farm-chart-ui-scale` **2**.  
현장 목록·카드 미니차트는 기본 **1×** (`var(--farm-chart-ui-scale, 1)`).  
토큰·클래스: `src/lib/ui/farm-chart-ui-scale.ts` · `globals.css` `.farm-chart-fs-*`.  
허브 density(comfortable/compact)와는 분리(B안 후보).

### API

```ts
import { applyDensity, readDensityFromDom } from "@/lib/ui/density";
import { dashboardTypography, dashboardReadout } from "@/lib/ui/dashboard-page-ui";
```

### 갭2 — 계기판 타이포 (`dashboardReadout`)

허브 온·습도 등 **주 수치**와 단위/라벨을 분리한다.

| 역할 | 키 | 요지 |
|------|-----|------|
| 주 수치 | `value` / `valueLg` | `font-mono` · `tabular-nums` · `--tracking-readout` |
| 단위 | `unit` / `unitBare` | sans · 더 작은 `--density-readout-unit*` · muted |
| 라벨 | `label` | 메타 크기 · `--tracking-readout-label` |

CSS: `--density-readout*` · `--tracking-readout*` (`globals.css`, compact에서 md 축소).  
적용: 목록 `MetricValue`, 일반 EnvChip.

#### 필드 덮개 (컨트롤러 카드)

지금 값만 `valueLg`입니다. 명칭·번호는 헤더와 같은 `cardTitle` / `cardDesc`·자리(상태점·액션 칸)를 써서 걷힐 때 크기 변환 없이 이어집니다. 판정만 `envCoverStatus`입니다.  

#### 맵 카드 수치 (회귀 금지)

그리드 `FarmMapCard` / `EnvChip valueOnly` 는 **`--density-map-value*`** 만 사용한다.

| 금지 | 이유 |
|------|------|
| `gridCellValue*` → `dashboardReadout.value/valueLg` 재사용 | readout이 작아 그리드가 “빈약한 카드”로 보임 (2026-07-30 회귀) |

`dashboardUi.gridCellValueDefault|Compact` 는 `--density-map-value` / `--density-map-value-compact` 를 직접 참조.  
`npm run verify:ui-density` 가 토큰 존재 + alias 금지를 검사한다.

### 검증

헤더에서 밀도 토글 → 새로고침 후에도 유지.  
`npm run verify:design` (색·모션 회귀와 독립, 타이포는 수동 스모크 · **맵 카드 숫자 크기** 포함).


---

## 채도

## UI Chroma (H3 — 데이터 퍼스트)

대시보드 **채도 역할** — 시선은 숫자·알람·차트에, 크롬(헤더/탭/선택)은 낮게.

관련: [모션](#모션) · [밀도](#밀도) · [단](#단)  
코드: `dashboardChroma` · `dashboardUi` (`src/lib/ui/dashboard-page-ui.ts`)

### 규칙

| 역할 | 채도 | 예 |
|------|------|-----|
| **Chrome** | 낮음 | 헤더 활성, 뷰 탭, scope pill, 메뉴 선택, 하단 내비 |
| **Data channel** | 중~고 | `channelTint*` · 차트 시리즈 · 레이어 그룹 뱃지 |
| **Alarm / status** | 고 | `topHeaderActionBtnAlert` · `opsStatus` · `--status-danger`(=`--destructive`) · status ring |

1. 크롬 선택에 `text-primary` + `bg-primary/10` 이상 쓰지 않는다 → `--control` / `--control-active` (`dashboardControlFill`, `dashboardChroma`).
2. 알람·이탈·채널 시리즈의 고채도를 크롬에 복제하지 않는다.
3. 빈 상태·스켈레톤은 muted(secondaryLabel) + density 토큰 (`emptyState` · `skeletonBone`). 입력 힌트만 `--tertiary-foreground`.

### 프리셋

| 키 | 용도 |
|----|------|
| `dashboardChroma.chromeActiveText` | 활성 탭/내비 라벨 |
| `dashboardChroma.chromeIdleText` | 정적 크롬 라벨 (hover 잉크 변경 없음). 탭은 `dashboardAffordance.choiceIdle` |
| `dashboardChroma.chromeSelected` | 선택 면(칩·행) |
| `dashboardChroma.viewTabPill` | 뷰 탭 슬라이딩 필 (`--control-active`) |
| `dashboardChroma.emptyState` | 데이터 없음 문구 |
| `dashboardChroma.skeletonBone` | 로딩 본 |
| `dashboardChroma.statusFilmGlassRim` | 덮개(E) 유리 테 — 위 밝은 줄·아래 어두운 줄 |

`dashboardUi.headerActionBtnActive` · `menuItemActive` · `brandChip` · `scopePillActive` · `chartLayerActionBtn` 도 H3에서 **크롬 수준**으로 완화됨.  
`chartLayerBadge*` · `channelTint*` · `topHeaderActionBtnAlert` 는 **데이터/알람** — 유지.

### Do / Don't

**Do** — 차트 시리즈·알람 배지·심각도 링에 채널/status 색  
**Don't** — 탭 활성에 solid primary, 헤더 전체에 primary/15 배경 남발

필드 컨트롤러 상세의 구간은 `--plan-cover-0` … `5` (인접만 다르게). `channel-temp|hum|motor` 를 구간 식별에 쓰지 않는다. `--status-ok|warn|danger`는 **채도 계단**(정상 낮음 / 주의 유지 / 위험 높음). 라이트는 `#6f9e8a` / `#f59e0b` / `#e11d2a`. 다크는 같은 색상각·채도에서 명도만 재계산(`ok` L 0.58 · `warn` 0.68 · `danger` 0.63) — 정상 덮개 창백·주의 형광을 줄인다. 덮개 글자는 `--status-*-ink` (같은 색상각·더 진함). 브랜드 `--primary`와는 분리.

채널 hue는 status와 겹치지 않게 둔다: temp ≈ 15(와인) · motor/fan-intake ≈ 260(건메탈) · hum/info 230 · **command 210(청록)** · exhaust 295 · supply 165. 모터는 정상/주의/위험(녹·황·적)을 쓰지 않는다. 채도는 채널 중(모터는 스틸감으로 약간 낮음) · 주의/위험 고. 차트는 `var(--channel-*)`만. 온도 설정±편차 밴드는 primary가 아니라 `color-mix(…, var(--channel-temp), var(--mix-lift))`로 **같은 색상각·명도만** 올린다. 차트 명령 적중(적용) 점은 `--status-ok`. 접수·전송은 차트에 그리지 않는다. 필드 덮개 적용 스트립은 덮개 잉크만.

### 변경 시

문서 + `dashboardChroma` / 관련 `dashboardUi` 프리셋을 함께 갱신.


---

## 어포던스

## UI Affordance (버튼 · 표시 · 히트)

라이트/다크 공통으로 **눌러지는지**가 대기 상태에서도 보이게 한다.  
면 종류(A–H)·채도(크롬/데이터)와 **별개 축**. 새 색·글로우·H6 없음.

관련: [면](#면) · [채도](#채도) · [UI_QA.md](./UI_QA.md)  
코드: `dashboardAffordance` (`src/lib/ui/dashboard-page-ui.ts`)

PC(`md+`)와 모바일(컴팩트)은 **같은 계약**, 히트만 밀도 토큰으로 커진다 (`size-9`/`md:size-11`, 덮개 패딩 `p-2.5`/`sm:p-3`).

### 6종 계약

| 코드 | 이름 | 대기 시각 | 커서 | 대표 |
|------|------|-----------|------|------|
| 1 | 명령 | `primary` 채움 | pointer | 적용, 확인 |
| 2 | 도구 | 테두리 + `--control` tinted | pointer | 헤더, 취소, 기간, 카드 헤더 아이콘 |
| 3 | 선택군 | 트랙 + 필 `--control-active` | pointer | 뷰 탭, 목록 모드 |
| 4 | 칩 토글 | 꺼져도 테두리 + `--control` | pointer | 차트 레이어, 농장 격자 칸 |
| 5 | 히트 면 | 타일/덮개 + 코너 셰브론 | pointer | 환경 덮개, 현황 타일 |
| 6 | 잉크 | 테두리·호버 배경 없음 | default | 제목, 수치, EnvChip |

한 컨트롤은 한 계약만. `onClick`과 잉크(6)는 공존 금지.

### Do / Don't

**Do** — 표시 칩은 `metricPocket`(우물). 실사용 컨트롤은 고스트(빈 면) 금지. 대기는 `--control`. CTA는 `--primary`. 세그먼트 트랙만 `--surface-well`.  
**Don't** — 탭 solid primary, 대기 면을 `--secondary`/`--card`/`--surface-well`로만 칠하기, 수치 underline, 덮개 Dialog blur, `bg-emerald-600` 명령, 신규 글로우.

### 적용 현황 (A–G)

| 단계 | 내용 | 상태 |
|------|------|------|
| A | 이 문서 + `dashboardAffordance` | 적용 |
| B | EnvChip 우물 | 적용 |
| C | 레이어·스코프·헤더 고스트 폐기 | 적용 |
| D | 덮개·타일·명칭 셰브론 | 적용 |
| E | 뷰 탭 `choiceIdle` | 적용 |
| F | 적용/확인 primary | 적용 |
| G | `verify:ui-affordance` · Visual QA 13–18 | 적용 |
| 1-A | 허브 알람·뱃지·계정·농장전환 hue 유틸 제거 | 적용 2026-09-09 |
| control | 대기 도구 `--control` tinted (12%/22%) | 적용 2026-09-09 |

가드: `npm run verify:ui-affordance` (`verify:design`에 포함).


---

## 피드백

## UI Feedback (H4 — 운영 피드백)

명령은 **접수 → 전송 → 확인** 세 단입니다 (`pending` → `sent` → `applied`). `applied`는 command_ack가 LIVE 설정과 명령을 맞춰 올린 적용 확인입니다. 설정 행·덮개 막대도 이 status를 따른다. LIVE 값이 먼저 맞아도 `sent` 폴링을 끊지 않는다(`applied`가 와야 확인단). 필드 격자에서는 해당 **환경 덮개** 값 아래에 채널별 잉크 게이지를 붙입니다.

관련: [모션](#모션) · [채도](#채도) · [단](#단)  
코드: `src/lib/ui/ops-feedback.ts` · `src/lib/farm/apply-queue.ts` · `controller-env-cover.tsx` · `command-pipeline-overlay.tsx` · `command-confirm-overlay.tsx` · `inline-status-toast.tsx`

### 톤 (`opsFeedbackTone`)

| tone | 용도 | 색 |
|------|------|---|
| `ok` | 적용 성공 | `--status-ok` |
| `warn` | 부분 실패 · 주의 | `--status-warn` |
| `error` | 실패 | `--status-danger` (`--destructive` 별칭) |
| `info` | 안내 | border + foreground |
| `loading` | 적용 중 | muted + spin |

셸: `opsFeedbackShell` (= elevation float급 `shadow-lg`).

### 명령 파이프라인 모션

| phase | 모션 |
|-------|------|
| loading | 오버레이 fade |
| success / error | `.ui-motion-feedback-icon` soft scale-in (amplitude 토큰) |

필드 **환경 덮개**는 명령을 보내지 않은 칸에는 스트립을 그리지 않는다. 최근 1시간 접수·전송·확인 티켓이 있는 컨트롤러만 값·알람 띠 아래에 채널 A/B/C 행을 올린다. **설정 패널**에서는 보낸 채널 한눈 줄이 같은 세 단으로 차고, 확인 때 체크가 잠깐 보인다. 설정은 접지 않는다. **축사·컨트롤러·채널당 가장 최근 1건**만 큐에 남긴다. 1시간이 지나면 티켓을 내린다. 좌하단 상주 도크와 와이어 헥스는 운영 화면에 두지 않는다. 델린은 오른쪽 아래.

### 적용 큐 (필드 덮개)

| 화면 단계 | 의미 |
|-----------|------|
| 접수 | 대기열 등록 |
| 전송 | 현장 송신 (`sent`) |
| 확인 | 적용 확인 (`applied`) |

게이지는 덮개 잉크(`currentColor`)와 투명도만 쓴다. 3단 채움은 `scaleX` + `duration-motion-moderate`로 이어 간다. 오른쪽은 로딩 도넛, `applied`면 체크 후 `exit`로 해당 행을 내린다.

설정 한눈 줄은 행 자체가 막대다. `primary` 면을 왼쪽부터 채우고, 확인이면 체크를 `enterFade`로 보여 준 뒤 같은 `emphasis` 유지·`exit`로 색과 체크를 내린다. 가운데 적용 완료 카드는 명령 진행 중에는 쓰지 않는다.

### 명령 설정 범위 (컨트롤러 · 온도·모터 겹침)

큐(덮개 스트립)는 **최근 1시간**의 접수·전송·확인이다. 차트 「명령」 토글은 **command 테이블이 아니라** 추이 RPC(decoded 설정 시계열)로 A/B/C 창을 그린다. 명령 행은 변경 순간만 알려 주고, 그 시간대의 설정온도·편차·환기는 decoded 버킷 값이다. 기본은 끔. 온도 본선은 실선, 온·습 상·하한은 채널 색 점선이며 우측 숫자 호버 시 하이라이트(강조선)를 켠다. 설정 이력은 `--channel-fan-exhaust`(보라) 한 색으로, A 투명 실선 · B 투명 점선 · C 투명 이중점선이다. A·B·C 구간은 같은 투명 창을 두고, 겹친 구간은 합성으로 진해진다. 접촉·초과 코리도는 그리지 않는다.

| 축 | 의미 |
|----|------|
| 가로 | 통합 추이와 같은 시각 |
| 온도 세로 | 실측 온도와 같은 ℃ (설정온도~편차. 축을 늘리지 않음) |
| 모터 세로 | 실측 모터와 같은 환기% (최저~최고환기. 축을 늘리지 않음) |

같은 decoded 설정이 이어지는 동안 온도 띠와 모터 띠를 **유지**한다. 온도·모터를 한 밴드로 겹쳐 보면 온도 창만 그린다. 그래프 아래 A·B·C 아이콘으로 채널별 겹침을 켜고 끈다.

**상호작용 (온·습·모터와 동일 계약)**

- **탭/클릭** → 데이터 카드 **고정**(홀드). 유지띠와 카드는 **점선**으로 이어집니다.
- **같은 띠 재클릭** · 카드 닫기 · 차트 밖 클릭 → 해제.
- **호버** → 임시 카드(이미 핀된 띠는 호버 카드 숨김).
- **드래그** → 위 측정 추이와 **같은 시간 구간**을 확대합니다. 측정 Y밴드(온도·습도·모터)는 바꾸지 않습니다.
- **URL** `chartCmd=1`: 온도·모터 본선에 명령 이력 켬. 옛 `chartYBand`의 `command`는 같은 의미로 읽습니다.

설정온도·편차·환기 요약을 카드에 둔다. 값은 decoded RPC 시계열이다. 접수·전송·실패·취소 티켓은 차트에 그리지 않는다.

점·+N 클러스터·임의 duration 없음. 필드 덮개 적용 스트립은 차트와 달리 **덮개 잉크만** 쓰고 채널·상태 hue를 올리지 않는다.

코드: `src/lib/farm/channel-thermo.ts` · `decoded-setting-hold.ts` · `command-hold-bands.ts` · `trend-chart-event-lane.tsx` · `use-trend-scope-gesture.ts`

### 컴포넌트

| UI | 레이어 |
|----|--------|
| `CommandPipelineOverlay` | FEEDBACK_Z.overlay |
| `CommandConfirmOverlay` | overlay — 전송 전 승인(자동 닫힘 없음) |
| `ControllerEnvCover` 채널 스트립 | 필드 칸 — 적용 중인 컨트롤러만 |
| `InlineStatusToast` | toast |

### reduced-motion / CI

- CSS reduce: toast · command-overlay/card · feedback-icon
- 로컬: `npm run audit:motion-reduced`
- CI(런타임 강제): `npm run audit:motion-reduced:ci`  
  (`--strict` → BASE 필수, 실패 시 exit 1). 또는 `STRICT_MOTION_RUNTIME=1`.

### Do / Don't

**Do** — 상태 변화에만 모션 · 공통 `ops-feedback` 톤 · 적용 큐는 정식 명칭만  
**Don't** — 토스트마다 다른 border 색 · success에 spring overshoot · `applied` 전 「적용 완료」


---

## 모션

## UI Motion System (Phase 1)

PC·모바일·브라우저 공통 **motion token + L2 preset** 레이어.  
Phase 1은 **규칙·프리셋·검증**까지 — 컴포넌트 전면 마이그레이션은 Phase 2~3.

관련 디자인 문서: [밀도](#밀도) · [단](#단) · [채도](#채도) · [피드백](#피드백)

### 아키텍처

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

### L1 — Duration

| Token | ms | 용도 |
|-------|-----|------|
| `fast` | 120 | hover, focus, chip, badge |
| `normal` | 200 | dialog, dropdown, toast enter, fade |
| `moderate` | 280 | panel expand, collapsible, stagger |
| `emphasis` | 360 | heat morph, 강조 전환 |
| `exit` | 150 | toast/modal exit |
| `viewCrossfade` / `view` | 150 | map ↔ list opacity |

### L1 — Easing

| Token | curve | 용도 |
|-------|-------|------|
| `standard` | decel-accel | 일반 transition |
| `enter` | decelerate | 등장 |
| `exit` | accelerate | 퇴장 |
| `emphasis` | soft bounce | morph·강조 |

### L1 — Distance

| Token | px |
|-------|-----|
| `sm` | 4 |
| `md` | 8 |
| `lg` | 16 |
| `slidePercent` | 28 (`--motion-distance-slide: 28%`, 캐러셀 전용) |

Stagger step: **40ms** (`motionStaggerStepMs`) — PC·모바일 동일.

---

### L2 — Intent → Preset

| Intent | Duration | Easing | Preset / Surface |
|--------|----------|--------|------------------|
| `micro` | fast | standard | `motionClass.microInteractive` |
| `surface` | normal | standard | `motionClass.surfaceRing` |
| `enter` | normal | enter | `ui-motion-enter-fade` |
| `exit` | exit | exit | `ui-motion-exit-fade` |
| `layout` | moderate | standard | `ui-motion-panel-expand` |
| `emphasis` | emphasis | emphasis | `farm-heat-morph` |
| `view` | view | standard | `motionClass.viewCrossfade` |

#### 코드 예

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

### L2 — Surface classes (globals.css)

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

### Do / Don't

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

### PC · 모바일 · 브라우저

| 항목 | 정책 |
|------|------|
| duration / easing | **동일** |
| bottom sheet | `motionClass.sheetEnter` + `durationEmphasis` (접힘·펼침 360ms). 차트로 옮기기: 탭 전환 280ms + 인지 360ms 뒤 시트 접힘 360ms |
| portal (dialog) | `motionClass.portalEnter` + `durationNormal` |
| scroll-driven | 모바일 `auto` (투어·vv 대응), duration은 동일 |
| preview frame | `[data-viewport-preview="mobile"]` — duration 동일, max-height만 조정 |

---

### Chart motion budget (bundle C · H2)

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

### Documented motion exceptions (bundle D)

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

톤 경계: DELIN 뱃지(H5)는 제거. [`farm-hub-url.md`](./farm-hub-url.md#환경-상태-정책).

---

### Channel color tokens

| CSS var | Tailwind | 용도 |
|---------|----------|------|
| `--channel-fan-intake/exhaust/supply` | `channel-fan-*` | 모터 A/B/C 시리즈 |
| `--status-warn` / `--status-danger` | `status-warn` 등 | 알람 참조선·심각도 |
| `--chart-guide` | — | 차트 가이드(상·하한) |

차트 SVG는 `TREND_CHART_COLORS` / `SEV_COLOR`가 `var(--…)`를 사용한다 (T3).

공용 클래스: `dashboardUi.channelTint*` / `chartLayerGroup*` / `opsStatus.info`.  
신규 채널·정보 UI는 `sky`/`rose`/`amber`(모터) 하드코딩 금지 — `channel-*` 또는 `opsStatus`/`primary` 사용.  
경고(주의)만 `amber` 유지.

**DELIN 뱃지 (H5)**: 제거됨. 오브·도크 모션 없음. 상세=[`farm-hub-url.md`](./farm-hub-url.md#환경-상태-정책).

**규칙**: 새 UI는 `motionIntent` / `motionClass`만 사용. 임의 `duration-N`·`transition-all`·차트 리터럴 ms 금지.

---

### Phase roadmap

| Phase | 범위 | 상태 |
|-------|------|------|
| **0** | L1 tokens, CSS vars | ✅ |
| **1** | L2 presets, intent map, verify script, this doc | ✅ |
| **2** | ui/* shadcn + farm domain 마이그레이션 | ✅ |
| **3** | ESLint guard, Playwright motion snapshots | ✅ |

#### Phase 2 적용 요약

**ui/** — `button`, `badge`, `tabs`, `input`, `checkbox`, `table`, `select`, `dialog`  
→ `microInteractive` / `microHover` / `portalEnter` + easing

**farm/** — `farm-page-content` 탭, `farm-map-canvas`/`mobile-stage` 카드,  
`barn-table` refresh ring, `bulk-apply` 스위치, `barn-controller-mobile-sheet` 트랙,  
툴바·기간 토글·패널 닫기·피커·게이지 pill·목록 SP 칩 등  
→ 임의 `duration-300` / `transition-all` 제거, L2 preset 치환

#### Phase 3 가드레일

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

##### T5 — 색·채널 회귀

- Tailwind: `sky-*` / `rose-*` / `violet-*` / `orange-*` → `channel-temp|hum|motor|info` 또는 `primary` / status
  (주의·경고 UI의 `amber-*` / `--status-warn`은 허용)
- 차트 SVG: `TREND_CHART_COLORS` / `--status-*` / `--channel-*` (리터럴 `#ef4444` `#0ea5e9` `#10b981` `#22c55e` 금지)
- 브러시 양호도: `comfortScoreToColor` → `--status-ok|warn|danger` + `color-mix`
- allowlist: `oauth-buttons.tsx`(카카오 브랜드색)
- reduced-motion: ARIA dock·차트 hover-ring·slide-up 셀렉터도 정적 검수

##### T2 — UI density

- `docs/UI_DENSITY.md` — `comfortable` / `compact`, `--density-*`, 헤더 토글
- 타이포·컨트롤: `dashboardTypography` / `dashboardControl` / `dashboardUi` → CSS 변수
- `opsTypography`·차트 내부는 별도(이미 조밀)

##### Elevation

- `docs/UI_ELEVATION.md` — canvas → recessed → card → overlay (2~3단)
- `dashboardElevation` 프리셋 · `verify:ui-elevation` (`hover:shadow-*` 금지)
- 라이트: `shadow-sm` + ring · 다크: `shadow-none` · overlay만 `shadow-md`+

##### H3 — 데이터 퍼스트 채도

- `docs/UI_CHROMA.md` — 크롬 낮음 / 채널·알람 고채도
- `dashboardChroma` · 헤더·탭·scope·스켈레톤·emptyState

##### H4 — 운영 피드백

- `docs/UI_FEEDBACK.md` — `ops-feedback` 톤 · 파이프라인 step 0..3
- toast / command overlay / bulk banner 통일
- `npm run audit:motion-reduced:ci` (`--strict`)

헤더에서 밀도 토글 스모크 + `npm run verify:design`

---

### 동결 · 유지보수 (시스템 1.0)

H1–H5 완료. **새 장식 모션·임의 hue 추가 금지.**  
변경은 버그 수정·토큰 정렬·문서화된 예외만. 고급감 갭·수동 QA: [`UI_QA.md`](./UI_QA.md).

색 가드: `sky` / `rose` / `violet` / `orange`(온도) Tailwind 유틸 → `channel-*` / `primary` / `status-*`.  
주의(경고)만 `amber` / `--status-warn` 유지.

---

### prefers-reduced-motion

`globals.css` `@media (prefers-reduced-motion: reduce)`:

- `--motion-duration-*` → `0ms`
- `.ui-motion-*` animation/transition 비활성화
- `.ui-motion-panel-expand`, `.barn-list-panel-shell`, `[data-farm-view-panel]` transition off
