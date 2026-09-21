import {
  DEFAULT_TREND_PERIOD,
  TREND_PERIODS,
  type TrendPeriodId,
} from "@/lib/data/farm-trend-types";
import { normalizeStallTyCode } from "@/lib/data/stall-type";
import {
  clearFarmChartScopeParams,
  clearFarmChartZoomParams,
  clearFarmChartWidgetParams,
  CHART_CTRL_PARAM,
  CHART_SP_PARAM,
  CHART_STALL_PARAM,
  CHART_Y_BAND_PARAM,
  CHART_X0_PARAM,
  CHART_X1_PARAM,
  CHART_CMD_PARAM,
  CHART_W1_PARAM,
  CHART_W2_PARAM,
  clearFarmChartCmdParam,
} from "@/lib/farm/farm-chart-scope";
/** 은퇴한 모델 탭 딥링크. 북마크 잔여분만 지운다. */
const LEGACY_PLAN_BLDG_PARAM = "planBldg";
const LEGACY_PLAN_SP_PARAM = "planSp";
const LEGACY_PLAN_STALL_PARAM = "planStall";

function clearLegacyBarnPlanParams(params: URLSearchParams): void {
  params.delete(LEGACY_PLAN_BLDG_PARAM);
  params.delete(LEGACY_PLAN_SP_PARAM);
  params.delete(LEGACY_PLAN_STALL_PARAM);
}

export const TREND_PERIOD_PARAM = "trendPeriod";

export function parseTrendPeriodParam(
  raw: string | null | undefined,
): TrendPeriodId {
  if (raw === "24h" || raw === "7d" || raw === "30d") return raw;
  return DEFAULT_TREND_PERIOD;
}

export function resolveTrendPeriodParam(params: URLSearchParams): TrendPeriodId {
  return parseTrendPeriodParam(params.get(TREND_PERIOD_PARAM));
}

/** 기본 period(7d)면 URL에서 생략. */
export function setTrendPeriodParam(
  params: URLSearchParams,
  period: TrendPeriodId,
): void {
  if (period === DEFAULT_TREND_PERIOD) params.delete(TREND_PERIOD_PARAM);
  else params.set(TREND_PERIOD_PARAM, period);
}

export function trendPeriodLabel(period: TrendPeriodId): string {
  return TREND_PERIODS[period].label;
}

export type FarmMapDrillLevel = "sp" | "stalls";

/** 목록 탭 — 카드 그리드 전역 보기 모드 (그래프 은퇴 → 컨트롤러/설정) */
export type BarnListViewMode = "controller" | "settings";

const LIST_VIEW_MODES: BarnListViewMode[] = [
  "controller",
  "settings",
];

export function parseListViewMode(
  raw: string | null | undefined
): BarnListViewMode {
  // 레거시 listMode=channel|graph → controller (그래프 모드 은퇴, 이력은 차트 탭)
  if (raw === "channel" || raw === "graph") return "controller";
  if (raw && LIST_VIEW_MODES.includes(raw as BarnListViewMode)) {
    return raw as BarnListViewMode;
  }
  return "controller";
}

/** hub shallow URL · searchParams 공통 — URL listMode 우선 */
export function resolveListViewMode(
  params: URLSearchParams,
  fallback?: BarnListViewMode
): BarnListViewMode {
  const raw = params.get("listMode");
  if (raw) return parseListViewMode(raw);
  return fallback ?? "controller";
}

/**
 * URL에 남은 레거시 `listMode=channel|graph` 제거 (그래프 모드 은퇴 → 컨트롤러).
 * @returns 변경 여부
 */
export function normalizeLegacyListModeParam(params: URLSearchParams): boolean {
  const raw = params.get("listMode");
  if (raw !== "channel" && raw !== "graph") return false;
  params.delete("listMode");
  return true;
}

export function setListViewMode(
  params: URLSearchParams,
  mode: BarnListViewMode
): void {
  if (mode === "controller") params.delete("listMode");
  else params.set("listMode", mode);
}

/** 허브 탭 — 그리드(map/필드) · 목록 · 차트. `chartlab`은 옛 URL. `aria`·`status`·`plan`·`model`은 필드로 정규화. */
export type FarmHubView =
  | "map"
  | "list"
  | "chart"
  | "chartlab"
  | "aria";

export function isFarmChartWorkspaceView(view: FarmHubView): boolean {
  return view === "chart" || view === "chartlab";
}

export function resolveFarmHubView(
  raw: string | null | undefined,
): FarmHubView {
  if (raw === "list") return "list";
  if (raw === "chart" || raw === "chartlab") return "chart";
  if (raw === "aria" || raw === "jarvis") {
    return "map";
  }
  /** 레거시 현황(방 칸 히트맵) · 모델(2D) 탭 — 필드(그리드)로. */
  if (raw === "status" || raw === "plan" || raw === "model") {
    return "map";
  }
  return "map";
}

/** 목록 탭 전용 — view=list 유지, map drill(stall/mapLevel)만 제거 */
export function applyListViewParams(params: URLSearchParams): void {
  params.set("view", "list");
  params.delete("stall");
  params.delete("mapLevel");
  clearFarmChartScopeParams(params);
  clearFarmChartZoomParams(params);
  clearFarmChartCmdParam(params);
  clearFarmChartWidgetParams(params);
  clearLegacyBarnPlanParams(params);
}

/** 차트 탭 — 전폭 통합 추이. chart* 딥링크·줌 힌트는 유지 */
export function applyChartViewParams(params: URLSearchParams): void {
  params.set("view", "chart");
  params.delete("listMode");
  params.delete("stall");
  params.delete("mapLevel");
  clearLegacyBarnPlanParams(params);
}

/** 옛 `view=chartlab` — 차트 탭으로 정규화. */
export function applyChartLabViewParams(params: URLSearchParams): void {
  applyChartViewParams(params);
}

/** 옛 델린 탭 주소 — 현장(그리드)으로 보냄. */
export function applyAriaViewParams(params: URLSearchParams): void {
  applyMapGridParams(params);
}

/** 지도 탭 — 그리드 진입(드릴 쿼리 제거). 위젯 칸은 유지(차트 일괄·단일·비교 선택). */
export function applyMapGridParams(params: URLSearchParams): void {
  params.delete("view");
  params.delete("listMode");
  clearMapDrillParams(params);
  clearFarmChartScopeParams(params);
  clearFarmChartZoomParams(params);
  clearFarmChartCmdParam(params);
  clearLegacyBarnPlanParams(params);
}

export function clearMapDrillParams(params: URLSearchParams): void {
  params.delete("sp");
  params.delete("stall");
  params.delete("mapLevel");
}

/** 축사유형 카드 → SP 그래프 */
export function setMapGraphSp(params: URLSearchParams, stallTyCode: string): void {
  params.delete("view");
  params.set("sp", normalizeStallTyCode(stallTyCode));
  params.delete("mapLevel");
  params.delete("stall");
}

export function setMapDrillLevel(
  params: URLSearchParams,
  level: FarmMapDrillLevel
): void {
  if (level === "stalls") params.set("mapLevel", "stalls");
  else params.delete("mapLevel");
  params.delete("stall");
}

export function setMapControllerStall(
  params: URLSearchParams,
  stallNo: string
): void {
  params.set("stall", stallNo.trim());
}

export function clearMapControllerStall(params: URLSearchParams): void {
  params.delete("stall");
}

export function buildFarmPath(params: URLSearchParams): string {
  const q = params.toString();
  return q ? `/farm?${q}` : "/farm";
}

/** view=list|map|chart|chartlab|aria 전환 (레거시 tab=ops · view=status|plan|model 쿼리 제거) */
export function applyHubScopedViewParams(
  params: URLSearchParams,
  view: FarmHubView,
): void {
  params.delete("tab");
  if (view === "list") applyListViewParams(params);
  else if (view === "chart" || view === "chartlab") applyChartViewParams(params);
  else if (view === "aria") applyAriaViewParams(params);
  else applyMapGridParams(params);
}

/**
 * 기간 등 view와 무관한 shallow 갱신 시 활성 탭만 URL에 고정.
 * applyHubScopedViewParams와 달리 map 드릴(sp/stall/mapLevel)은 건드리지 않음.
 */
export function pinFarmHubViewParam(
  params: URLSearchParams,
  view: FarmHubView,
): void {
  if (view === "list" || view === "chart" || view === "chartlab") {
    params.set("view", view === "chartlab" ? "chart" : view);
  } else {
    params.delete("view");
  }
}

/** hub farm 선택 시 in-grid drill + view 탭 초기화 */
export function clearHubFarmDrillParams(params: URLSearchParams): void {
  clearMapDrillParams(params);
  params.delete("view");
  params.delete("listMode");
  params.delete("ctrl");
  params.delete("alarm");
  clearFarmChartScopeParams(params);
  clearFarmChartZoomParams(params);
  clearFarmChartCmdParam(params);
  clearFarmChartWidgetParams(params);
  clearLegacyBarnPlanParams(params);
}

/**
 * Epoch 이중 구조 (의도적 분리 — 합치지 말 것):
 * - **farmUrlEpoch** (`subscribeFarmUrlEpoch`): `replaceFarmUrlShallow` / popstate.
 *   TopBar·DailyReport 등 window URL 구독.
 * - **hubUrlEpoch** (shell local + admin context): 농장 전환·탭 전환 시
 *   `FarmPageContent` view 재동기화.
 * - **requestFarmHubViewResync**: Provider 밖(모바일 하단 내비 등)에서
 *   shallow 후 탭 state만 URL에 맞출 때.
 * 기간(`trendPeriod`)만 바꿀 때는 farmUrlEpoch만 bump하고 hubUrlEpoch·resync는 올리지 말 것
 * (차트→그리드 레이스).
 */
/** in-grid drill — router.replace 없이 URL만 갱신 (그리드 깜빡임 방지) */
export function replaceFarmUrlShallow(params: URLSearchParams): void {
  if (typeof window === "undefined") return;
  const path = buildFarmPath(params);
  window.history.replaceState(window.history.state, "", path);
  notifyFarmUrlEpoch();
}

/** shallow drill 후 useSearchParams와 동기화되지 않을 때 현재 URL 기준 */
export function currentFarmSearchParams(): URLSearchParams {
  if (typeof window === "undefined") return new URLSearchParams();
  return new URLSearchParams(window.location.search);
}

/**
 * 모니터링 soft home — 농장 키·기간만 유지, 탭/드릴/목록모드 제거.
 * (모바일 하단 «모니터링», 허브 홈 복귀)
 */
export function buildFarmMonitoringHomeParams(
  source: URLSearchParams,
): URLSearchParams {
  const next = new URLSearchParams();
  const lsind = source.get("lsind");
  const item = source.get("item");
  if (lsind) next.set("lsind", lsind);
  if (item) next.set("item", item);
  const trend = source.get(TREND_PERIOD_PARAM);
  if (
    (trend === "24h" || trend === "7d" || trend === "30d") &&
    trend !== DEFAULT_TREND_PERIOD
  ) {
    next.set(TREND_PERIOD_PARAM, trend);
  }
  return next;
}

export function buildFarmMonitoringHomePath(
  source?: URLSearchParams,
): string {
  const from = source ?? currentFarmSearchParams();
  return buildFarmPath(buildFarmMonitoringHomeParams(from));
}

/** 이미 그리드 홈(탭·드릴 없음)이면 true — 하단 내비 no-op용 */
export function isFarmMonitoringSoftHome(params: URLSearchParams): boolean {
  if (params.get("view")) return false;
  if (params.get("listMode")) return false;
  if (params.get("sp") || params.get("stall") || params.get("mapLevel")) {
    return false;
  }
  if (params.get("ctrl") || params.get("alarm")) return false;
  if (
    params.get(CHART_SP_PARAM) ||
    params.get(CHART_STALL_PARAM) ||
    params.get(CHART_CTRL_PARAM) ||
    params.get(CHART_Y_BAND_PARAM) ||
    params.get(CHART_X0_PARAM) ||
    params.get(CHART_X1_PARAM) ||
    params.get(CHART_CMD_PARAM) ||
    params.get(CHART_W1_PARAM) ||
    params.get(CHART_W2_PARAM)
  ) {
    return false;
  }
  if (
    params.get(LEGACY_PLAN_BLDG_PARAM) ||
    params.get(LEGACY_PLAN_SP_PARAM) ||
    params.get(LEGACY_PLAN_STALL_PARAM)
  ) {
    return false;
  }
  return true;
}

/**
 * TopBar 등 PageShell 밖 컴포넌트가 shallow URL(lsind/item)을 따라가도록.
 * replaceFarmUrlShallow · popstate에서 bump.
 */
let farmUrlEpoch = 0;
const farmUrlListeners = new Set<() => void>();

function notifyFarmUrlEpoch() {
  farmUrlEpoch += 1;
  farmUrlListeners.forEach((l) => l());
}

export function subscribeFarmUrlEpoch(onStoreChange: () => void): () => void {
  farmUrlListeners.add(onStoreChange);
  if (typeof window !== "undefined" && farmUrlListeners.size === 1) {
    window.addEventListener("popstate", notifyFarmUrlEpoch);
  }
  return () => {
    farmUrlListeners.delete(onStoreChange);
    if (typeof window !== "undefined" && farmUrlListeners.size === 0) {
      window.removeEventListener("popstate", notifyFarmUrlEpoch);
    }
  };
}

export function getFarmUrlEpoch(): number {
  return farmUrlEpoch;
}

export function getFarmUrlEpochServer(): number {
  return 0;
}

/**
 * 허브 탭 실측(클라이언트). 차트 높이 채움은 URL `view`보다 이 값을 따른다.
 * shallow 직후 화면은 차트인데 주소는 아직 필드인 레이스를 막는다.
 */
let liveFarmHubView: FarmHubView | null = null;
const liveFarmHubViewListeners = new Set<() => void>();

export function publishLiveFarmHubView(view: FarmHubView): void {
  if (liveFarmHubView === view) return;
  liveFarmHubView = view;
  liveFarmHubViewListeners.forEach((l) => l());
}

export function getLiveFarmHubView(): FarmHubView {
  return (
    liveFarmHubView ??
    resolveFarmHubView(currentFarmSearchParams().get("view"))
  );
}

export function subscribeLiveFarmHubView(
  onStoreChange: () => void,
): () => void {
  liveFarmHubViewListeners.add(onStoreChange);
  return () => {
    liveFarmHubViewListeners.delete(onStoreChange);
  };
}

/** Provider 밖 shallow 후 탭 view 재동기화 (기간 변경에는 사용 금지) */
const hubViewResyncListeners = new Set<() => void>();

export function requestFarmHubViewResync(): void {
  hubViewResyncListeners.forEach((l) => l());
}

export function subscribeFarmHubViewResync(
  onStoreChange: () => void,
): () => void {
  hubViewResyncListeners.add(onStoreChange);
  return () => {
    hubViewResyncListeners.delete(onStoreChange);
  };
}

export function parseMapDrillLevel(
  raw: string | null | undefined
): FarmMapDrillLevel {
  return raw === "stalls" ? "stalls" : "sp";
}

/** 목록 탭 — flat(기본) / group(그룹별) */
export type ListLayout = "group" | "flat";

export function resolveListLayoutParam(params: URLSearchParams): ListLayout {
  return params.get("listLayout") === "group" ? "group" : "flat";
}
