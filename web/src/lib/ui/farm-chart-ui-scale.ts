/**
 * A안 — 농장 차트 탭 UI·텍스트 일괄 배율.
 * 현장 목록·카드 미니차트에는 적용하지 않는다 (기본 1×).
 * 모바일 차트 탭 툴바는 `.farm-chart-toolbar-fit` 이 1×로 너비에 맞춘다.
 * CSS `.farm-chart-ui { --farm-chart-ui-scale }` 과 동일 값을 유지한다.
 */
export const FARM_CHART_UI_SCALE = 2;

export function chartUiPx(base: number, scale = FARM_CHART_UI_SCALE): number {
  return Math.round(base * scale * 100) / 100;
}

/** Tailwind 리터럴 대체용 클래스 (globals.css) — 스케일은 조상 `.farm-chart-ui` 에만 2× */
export const farmChartUi = {
  root: "farm-chart-ui",
  fsLegend: "farm-chart-fs-legend",
  fsMeta: "farm-chart-fs-meta",
  fsTitle: "farm-chart-fs-title",
  fsBody: "farm-chart-fs-body",
  fsAxis: "farm-chart-fs-axis",
  control: "farm-chart-control",
  controlIcon: "farm-chart-control-icon",
  controlAlarm: "farm-chart-control-alarm",
  controlBadge: "farm-chart-control-badge",
  controlBadgeIcon: "farm-chart-control-badge-icon",
  controlRule: "farm-chart-control-rule",
  tickRail: "farm-chart-tick-rail",
  /** 위젯 — 좌측 Y숫자 칸. 브러시·플롯·날짜축이 같은 폭을 씀 */
  yGutter: "farm-chart-y-gutter",
  /** 위젯 — 우측 Y숫자 칸. 좌측과 같은 너비 */
  yGutterEnd: "farm-chart-y-gutter-end",
  /** 위젯 — 거터 안 Y숫자 가운데 정렬 */
  yGutterLabel: "farm-chart-y-gutter-label",
  /** 모바일 스택 — 좌·우 거터를 6rem으로 (PC는 8rem) */
  yGutterCompact: "farm-chart-y-gutter-compact",
} as const;
