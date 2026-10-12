import type { ReactNode } from "react";
import type { TrendPeriodId } from "@/lib/domain/farm-trend-types";
import type {
  ScaleEdgeDragEvent,
  ScaleEdgeNumericCommitEvent,
  TrendBreachNavTarget,
  TrendCommandSettingSeg,
  TrendEnvelope,
  TrendEventLane,
  TrendHistogram,
  TrendRangeBand,
  TrendReferenceLine,
  TrendScaleEdgeLabel,
  TrendSeries,
} from "@/lib/domain/trend-chart-types";
import type { UplinkCoverageBand } from "@/lib/farm/trend-uplink-coverage";

/** `TrendChart` 공개 props. 구현(`trend-chart.tsx`)과 분리해 호출측·문서가 계약만 참조하게 한다. */
export type TrendChartProps = {
  mode: "line" | "bar";
  categories: string[];
  series: TrendSeries[];
  height?: number;
  leftUnit?: string;
  rightUnit?: string;
  /** Force axis domains; otherwise auto-fit with padding. */
  leftDomain?: [number, number];
  rightDomain?: [number, number];
  /**
   * 좌측 원단위 Y 눈금.
   * full=5단(기본) · thirds=밴드 위·가운데·아래(1안) · ends=상·하한만 (현장 카드)
   */
  yAxisTicks?: "full" | "thirds" | "ends";
  referenceLines?: TrendReferenceLine[];
  /** 우측/좌측 스케일 상하한(원단위 텍스트). */
  scaleEdgeLabels?: TrendScaleEdgeLabel[];
  /** 위젯 왼쪽 Y칸 상단 표기 (알람). */
  yGutterStartCaption?: string;
  /** 위젯 오른쪽 Y칸 상단 단위 표기. */
  yGutterEndCaption?: string;
  /** 플롯 안 투명 구간(현장 알람 범위 등). */
  rangeBands?: TrendRangeBand[];
  /** line 모드 — 시리즈 아래 면 채우기(클라우드·밴드). */
  envelopes?: TrendEnvelope[];
  /** line 모드 — MACD형 히스토그램 막대. */
  histograms?: TrendHistogram[];
  emptyLabel?: string;
  /** Show every Nth category tick (auto if omitted). */
  tickEvery?: number;
  /** 있으면 X축 tick 축약 (categories·툴팁은 풀 라벨 유지). 7d/30d는 월 경계=`N월`, 나머지=일. */
  period?: TrendPeriodId;
  /**
   * 고정(핀) 카드 초기화 키. 줌(윈도우 슬라이스)과 무관하게 스코프·기간 등
   * 데이터 소스가 바뀔 때만 값이 변하도록 호출측에서 지정한다.
   * (미지정 시 `period|categories.length` 폴백 — 줌마다 초기화됨)
   */
  pinResetKey?: string;
  /** false면 시리즈 범례 행 숨김 (sheet compact 등). */
  showLegend?: boolean;
  /** 범례 행 우측(구간 줌 칩 등). showLegend=false여도 단독 표시 가능. */
  legendTrailing?: ReactNode;
  /**
   * full: 전 시리즈·산포·편차
   * core: 모바일용 — 온도·습도·모터만 (EMA/산포/편차는 호버)
   */
  legendDensity?: "full" | "core";
  /** 설정모드 스케일 가이드 세로 hit(px). 기본 10 · 모바일 권장 22 */
  scaleEdgeHitPx?: number;
  /**
   * 모바일 — 플롯을 왼쪽으로 좁히고 우측에 스케일 라벨 거터.
   * viewBox 기준 우측 여백 ~20.
   */
  labelGutter?: boolean;
  /** 미니 칸 — 날짜·Y축 글자·눈금 레일 생략 */
  hideAxisChrome?: boolean;
  /**
   * bar 모드 — 바 1개의 최대 너비(차트 폭 % 단위, 0~100).
   * 카테고리 수가 적을 때 통짜 바가 되지 않게 상한을 두고 슬롯 중앙에 정렬한다.
   * (viewBox가 non-uniform 스케일이라 px 대신 % 단위를 사용)
   */
  barWidthCapPct?: number;
  /** line 모드 데이터 점 표시. 기본 true. */
  showMarkers?: boolean;
  /**
   * 마커 밀도 — all=전점, sparse≈8점/시리즈(+호버 강조점).
   * 차트 탭 반응성용 sparse 권장.
   */
  markerDensity?: "all" | "sparse";
  /** 화면 기준 점 반지름(px). preserveAspectRatio=none 보정에 사용. */
  markerRadiusPx?: number;
  /**
   * 차트 탭 enter motion — 마운트·기간·레이어 밴드 변경 시 reveal.
   */
  animate?: boolean;
  /** @deprecated 밴드 Y 보간 사용. 전달해도 plot reflow CSS 미적용 */
  layoutKey?: string;
  /** 시리즈·히스토그램 추가/삭제 개별 클립 와이프 (기본 animate와 동일) */
  layerClipWipe?: boolean;
  /**
   * split-Y 밴드 경계 가이드 (차트 domain Y, 예: motorHi·humHi).
   * 레이어 on/off 재배치 시 fade-in.
   */
  splitBandGuides?: number[];
  /**
   * line 모드 — 전 시리즈가 null인 연속 구간을 세로 음영(결측)으로 표시.
   */
  showNullGaps?: boolean;
  /**
   * 추이 차트 — 희소/통신두절/없음 구간. 있으면 showNullGaps 일반 결측 음영은 쓰지 않음.
   */
  coverageBands?: UplinkCoverageBand[];
  /**
   * P1/P2 X스코프 — 드래그로 시간 구간(+Y밴드) 선택.
   * y*Ratio: plot 상단=0 · 하단=1
   */
  xScopeSelect?: boolean;
  /**
   * 플롯 휠/핀치 — 연속 룩백. dir<0 확대, dir>0 축소.
   * Ctrl/Meta+휠은 브라우저 페이지 줌에 맡긴다.
   */
  onLookbackWheel?: (dir: 1 | -1) => void;
  onXScopeCommit?: (range: {
    start: number;
    end: number;
    yStartRatio: number;
    yEndRatio: number;
  }) => void;
  /**
   * 구간 안내 — 실제 X스코프 UI와 동일 경로로 클릭→드래그→커밋 시연.
   * token 증가 시 재생. CSS 오버레이가 아님.
   */
  guidedXScopeGesture?: {
    token: number;
    startRatio: number;
    endRatio: number;
    /** 카테고리 절대 인덱스 — 있으면 커밋 시 비율 재변환 생략 */
    startIndex?: number;
    endIndex?: number;
    yRatio?: number;
    yStartRatio?: number;
    yEndRatio?: number;
    durationMs?: number;
  } | null;
  onGuidedXScopeComplete?: () => void;
  /** 우클릭 — 줌 한 단계 뒤로 (스택 pop). 있으면 컨텍스트 메뉴 억제 */
  onXScopeBack?: () => void;
  /** 스코프 스택 변경 시 줌 인/아웃 모션 키 */
  scopeMotionKey?: number;
  scopeMotionDir?: "in" | "out";
  /** 빈 플롯 더블클릭 — 설정모드 진입 등 */
  onPlotDoubleClick?: () => void;
  /**
   * 빈 플롯 우클릭 (스케일 라벨 hit 아님).
   * 설정모드 종료 등 — onXScopeBack과 동시에 쓰지 말 것(호출측에서 모드별 분리).
   */
  onPlotBackgroundContextMenu?: () => void;
  /**
   * 한계 이탈 데이터 카드가 떠 있을 때만 우클릭 → 해당 장비 차트.
   * 스코프 줌 뒤로가기(onXScopeBack)보다 우선, 카드 없으면 호출되지 않음.
   */
  onBreachEquipmentNavigate?: (target: TrendBreachNavTarget) => void;
  /**
   * draggable scaleEdgeLabels — 세로 드래그로 domain Y 조절.
   * X스코프와 충돌 시 가이드 hit이 우선.
   */
  onScaleEdgeDrag?: (event: ScaleEdgeDragEvent) => void;
  /** 우클릭 숫자 입력 확정 */
  onScaleEdgeNumericCommit?: (event: ScaleEdgeNumericCommitEvent) => void;
  /** showApplyActions 라벨 — 적용 */
  onScaleEdgeApply?: () => void;
  /** showApplyActions 라벨 — 되돌리기 */
  onScaleEdgeRevert?: () => void;
  scaleEdgeApplyBusy?: boolean;
  scaleEdgeApplyDisabled?: boolean;
  /** 오버레이(온도·습도·모터 겹침): hover 카드에 세 지표를 병합해 표시 */
  overlayHoverMerge?: boolean;
  /**
   * 십자선 교차점 칩 — 차트 domain Y → 온도/습도/모터(자).
   * 없으면 왼쪽 원단위 축만 역산한다.
   */
  crosshairValues?: (chartY: number) => {
    tempC?: number | null;
    humidityPct?: number | null;
    motorPct?: number | null;
  } | null;
  /** 플롯 CSS 너비(px). 차트 탭 다운샘플 밀도용 */
  onPlotWidthChange?: (widthPx: number) => void;
  /**
   * 부모 flex 높이를 플롯이 채움. `height`는 최솟값.
   * 범례·시간축은 내용 높이, SVG만 남는 세로를 씀.
   */
  fillParent?: boolean;
  /**
   * 데이터 밴드 아래 이벤트 행(명령 적중).
   * X는 추이 `xFor`와 같은 시각 축. height에 eventLaneHeight를 더해 전달.
   */
  eventLane?: TrendEventLane | null;
  /** `height`와 같은 단위(플롯 view Y). 기본 0 */
  eventLaneHeight?: number;
  /** 온도 본선 위 채널 명령 이력. 토글로 끈 경우 빈 배열 */
  commandSettingSegs?: TrendCommandSettingSeg[];
};
