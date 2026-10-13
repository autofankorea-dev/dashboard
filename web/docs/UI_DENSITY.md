관련: [UI_MOTION.md](./UI_MOTION.md) · [UI_ELEVATION.md](./UI_ELEVATION.md)

# UI Density (T2)

대시보드 글자 스케일은 `:root` 한 벌이다. `md`(768px)부터 `--density-*-md`를 쓴다. 모드 전환과 너비별 축소는 없다.

## 토큰

`globals.css` `:root` 의 `--density-*`.

역할별 클래스는 `dashboardTypography` · `dashboardControl` · `dashboardUi` · `densityClass` 가  
`text-[length:var(--density-…)]` / `h-[length:var(--density-control-h…)]` 로 참조.

인라인 `text-[1.75rem]` / `1.625rem` 금지 — `npm run verify:ui-density`.

opsTypography / farm 차트: A안 — **차트 탭** `.farm-chart-ui` + `--farm-chart-ui-scale` **2**.  
현장 목록·카드 미니차트는 기본 **1×** (`var(--farm-chart-ui-scale, 1)`).  
토큰·클래스: `src/lib/ui/farm-chart-ui-scale.ts` · `globals.css` `.farm-chart-fs-*`.  
허브 글자 스케일과는 분리(B안 후보).

## API

```ts
import { densityClass } from "@/lib/ui/density";
import { dashboardTypography, dashboardReadout } from "@/lib/ui/dashboard-page-ui";
```

## 갭2 — 계기판 타이포 (`dashboardReadout`)

허브 온·습도 등 **주 수치**와 단위/라벨을 분리한다.

| 역할 | 키 | 요지 |
|------|-----|------|
| 주 수치 | `value` / `valueLg` | `font-mono` · `tabular-nums` · `--tracking-readout` |
| 단위 | `unit` / `unitBare` | sans · 더 작은 `--density-readout-unit*` · muted |
| 라벨 | `label` | 메타 크기 · `--tracking-readout-label` |

CSS: `--density-readout*` · `--tracking-readout*` (`globals.css`).  
적용: 목록 `MetricValue`, 일반 EnvChip.

### 필드 덮개 (컨트롤러 카드)

닫힌 덮개는 세 크기입니다. 이름은 `cardTitle`, 온도는 `valueLg`, 번호·경보 범위·환경/통신 판정은 `--density-cover-mark`입니다. 번호 아이콘은 그 글자와 같은 1em입니다. 아래는 경보 한 줄, 그 다음 줄에 환경·통신 판정과 같은 높이의 셰브론입니다.  

### 맵 카드 수치 (회귀 금지)

그리드 `FarmMapCard` / `EnvChip valueOnly` 는 **`--density-map-value*`** 만 사용한다.

| 금지 | 이유 |
|------|------|
| `gridCellValue*` → `dashboardReadout.value/valueLg` 재사용 | readout이 작아 그리드가 “빈약한 카드”로 보임 (2026-07-30 회귀) |

`dashboardUi.gridCellValueDefault|Compact` 는 `--density-map-value` / `--density-map-value-compact` 를 직접 참조.  
`npm run verify:ui-density` 가 토큰 존재 + alias 금지를 검사한다.

## 검증

`npm run verify:design` (색·모션 회귀와 독립, 타이포는 수동 스모크 · **맵 카드 숫자 크기** 포함).
