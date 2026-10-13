관련: [UI_MOTION.md](./UI_MOTION.md) · [UI_ELEVATION.md](./UI_ELEVATION.md)

# UI Density (T2)

대시보드 **comfortable / compact** 밀도 모드.

## 모드

| 값 | 의미 |
|----|------|
| `comfortable` (기본) | 1280px 이상은 `md` ≈ 2×. 768–1279px PC는 조밀 토큰 |
| `compact` | 모든 너비에서 조밀 스케일 (`--density-*-md` 및 비-md 토큰 축소) |

- 저장: `localStorage.dashboard-density` (`DENSITY_STORAGE_KEY`)
- DOM: `html[data-density="comfortable"|"compact"]`
- 초기화: `src/app/layout.tsx` beforeInteractive 스크립트
- 헤더 토글: 테마 옆 `header-density`. comfortable은 너비 스케일을 따르고, compact는 넓은 PC에서도 조밀 토큰을 유지한다. 프로필 핀 대상이 아니다.

## 토큰

`globals.css` `:root` / `html[data-density="compact"]` 의 `--density-*`.

역할별 클래스는 `dashboardTypography` · `dashboardControl` · `dashboardUi` · `densityClass` 가  
`text-[length:var(--density-…)]` / `h-[length:var(--density-control-h…)]` 로 참조.

인라인 `text-[1.75rem]` / `1.625rem` 금지 — `npm run verify:ui-density`.

opsTypography / farm 차트: A안 — **차트 탭** `.farm-chart-ui` + `--farm-chart-ui-scale` **2**.  
현장 목록·카드 미니차트는 기본 **1×** (`var(--farm-chart-ui-scale, 1)`).  
토큰·클래스: `src/lib/ui/farm-chart-ui-scale.ts` · `globals.css` `.farm-chart-fs-*`.  
허브 density(comfortable/compact)와는 분리(B안 후보).

## API

```ts
import { applyDensity, readDensityFromDom } from "@/lib/ui/density";
import { dashboardTypography, dashboardReadout } from "@/lib/ui/dashboard-page-ui";
```

## 갭2 — 계기판 타이포 (`dashboardReadout`)

허브 온·습도 등 **주 수치**와 단위/라벨을 분리한다.

| 역할 | 키 | 요지 |
|------|-----|------|
| 주 수치 | `value` / `valueLg` | `font-mono` · `tabular-nums` · `--tracking-readout` |
| 단위 | `unit` / `unitBare` | sans · 더 작은 `--density-readout-unit*` · muted |
| 라벨 | `label` | 메타 크기 · `--tracking-readout-label` |

CSS: `--density-readout*` · `--tracking-readout*` (`globals.css`, compact에서 md 축소).  
적용: 목록 `MetricValue`, 일반 EnvChip.

### 필드 덮개 (컨트롤러 카드)

지금 값만 `valueLg`입니다. 명칭·번호는 헤더와 같은 `cardTitle` / `cardDesc`·자리(상태점·액션 칸)를 써서 걷힐 때 크기 변환 없이 이어집니다. 판정만 `envCoverStatus`입니다.  

### 맵 카드 수치 (회귀 금지)

그리드 `FarmMapCard` / `EnvChip valueOnly` 는 **`--density-map-value*`** 만 사용한다.

| 금지 | 이유 |
|------|------|
| `gridCellValue*` → `dashboardReadout.value/valueLg` 재사용 | readout이 작아 그리드가 “빈약한 카드”로 보임 (2026-07-30 회귀) |

`dashboardUi.gridCellValueDefault|Compact` 는 `--density-map-value` / `--density-map-value-compact` 를 직접 참조.  
`npm run verify:ui-density` 가 토큰 존재 + alias 금지를 검사한다.

## 검증

헤더에서 밀도 토글 → 새로고침 후에도 유지.  
`npm run verify:design` (색·모션 회귀와 독립, 타이포는 수동 스모크 · **맵 카드 숫자 크기** 포함).
