/**
 * Shared trend types/constants — safe for both server and client modules.
 * Keep this file free of `server-only` imports.
 */

export type TrendPeriodId = "24h" | "7d" | "30d";

export type TrendPeriodConfig = {
  id: TrendPeriodId;
  label: string;
  /** Postgres interval passed to the RPC. */
  bucket: string;
  /** Window length in ms. */
  durationMs: number;
  /** Number of buckets spanning the window. */
  bucketCount: number;
  /** Bucket stride in ms (for building the continuous time axis). */
  strideMs: number;
};

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * 60 * 60 * 1000;

/**
 * Hub chart buckets.
 *   24h wire: 15m × 96. Mini tile display = 2h average (12 pts).
 *   7d:  1h × 168   → GRAPH_BARS 28 (from 30d tail)
 *   30d: 1h × 720   → GRAPH_BARS 30
 * Expand lookback = 1h. Drag-zoom ≤ 48h fetches 15m for that range only.
 */
/** 차트 탭 미니 칸 표시 간격 (24시간 축을 2시간 평균 12점). */
export const TREND_MINI_STRIDE_MS = 2 * HOUR;
export const TREND_PERIODS: Record<TrendPeriodId, TrendPeriodConfig> = {
  "24h": {
    id: "24h",
    label: "24시간",
    bucket: "15 minutes",
    durationMs: DAY,
    bucketCount: 96,
    strideMs: 15 * MINUTE,
  },
  "7d": {
    id: "7d",
    label: "7일",
    bucket: "1 hour",
    durationMs: 7 * DAY,
    bucketCount: 7 * 24,
    strideMs: HOUR,
  },
  "30d": {
    id: "30d",
    label: "30일",
    bucket: "1 hour",
    durationMs: 30 * DAY,
    bucketCount: 30 * 24,
    strideMs: HOUR,
  },
};

/** 허브 30일 1시간 축을 최신부터 채우는 하루 RPC 조각 수. */
export const TREND_30D_DAY_CHUNKS = 30;
/** 허브 클라 하루 조각 동시 요청. 화면 반영은 최신→과거 순. */
export const TREND_30D_DAY_CONCURRENCY = 3;

/** 브러시 줌이 아니라 플롯 드래그 줌(≤48h) 전용 15분 축. 허브·PDF 기본 로드는 TREND_PERIODS. */
export const TREND_15M_PERIODS: Record<TrendPeriodId, TrendPeriodConfig> = {
  "24h": TREND_PERIODS["24h"],
  "7d": {
    id: "7d",
    label: "7일",
    bucket: "15 minutes",
    durationMs: 7 * DAY,
    bucketCount: 7 * 24 * 4,
    strideMs: 15 * MINUTE,
  },
  "30d": {
    id: "30d",
    label: "30일",
    bucket: "15 minutes",
    durationMs: 30 * DAY,
    bucketCount: 30 * 24 * 4,
    strideMs: 15 * MINUTE,
  },
};

export const TREND_ZOOM_15M_MAX_DAYS = 2;

export const DEFAULT_TREND_PERIOD: TrendPeriodId = "24h";

/** 장기 차트 브러시 개요 — 30일×1시간(720). */
export const TREND_OVERVIEW_30D: TrendPeriodConfig = {
  id: "30d",
  label: "30일",
  bucket: "1 day",
  durationMs: 30 * DAY,
  bucketCount: 30,
  strideMs: DAY,
};

/** UI 순환 순서 — 24시간 → 7일 → 30일 → 24시간 */
export const TREND_PERIOD_ORDER: TrendPeriodId[] = ["24h", "7d", "30d"];

export function nextTrendPeriod(current: TrendPeriodId): TrendPeriodId {
  const i = TREND_PERIOD_ORDER.indexOf(current);
  const idx = i < 0 ? 0 : (i + 1) % TREND_PERIOD_ORDER.length;
  return TREND_PERIOD_ORDER[idx]!;
}

/** One barn (stall_no) aligned series across the full continuous time axis. */
export type TrendStallSeries = {
  stallNo: string;
  temp: (number | null)[];
  humidity: (number | null)[];
  /**
   * 채널 슬롯(A/B/C) 기준 모터% — 모터 그래프 표시 정본.
   * eqpmnCode를 참조하지 않고 슬롯 라벨 그대로. RPC avg_fan_a/b/c에서 온다.
   */
  fanA: (number | null)[];
  fanB: (number | null)[];
  fanC: (number | null)[];
  /**
   * eqpmnCode(EC01/02/03)-role 기준 모터% — 하위호환(PDF·축사평균 등).
   * 모터 그래프는 슬롯(fanA/B/C)을 쓴다.
   */
  fanSupply: (number | null)[];
  fanExhaust: (number | null)[];
  fanIntake: (number | null)[];
  sampleCount: number[];
};

/** One SP (stall type) grouping its barns. */
export type TrendSpSeries = {
  stallTyCode: string;
  label: string;
  stalls: TrendStallSeries[];
};

export type TrendPeriodData = {
  period: TrendPeriodId;
  /** Shared time axis (formatted labels). */
  categories: string[];
  /** Shared time axis (ISO bucket starts). */
  bucketAts: string[];
  sp: TrendSpSeries[];
  /** Total samples across all SPs/buckets — 0 means empty window. */
  totalSamples: number;
};

export function emptyTrendPeriodData(period: TrendPeriodId): TrendPeriodData {
  return { period, categories: [], bucketAts: [], sp: [], totalSamples: 0 };
}

/** 히트맵/그래프 활성 여부 — 빈 `{}`는 falsy로 취급 */
export function hasStallTrendByPeriod(
  trend: Partial<Record<TrendPeriodId, TrendPeriodData>> | null | undefined,
): boolean {
  return trend != null && trend["24h"] != null;
}

/** 채널 설정 시계열 (A 절대 ℃ · B/C는 A 오프셋). */
export type TrendChannelThermo = {
  setpoint: (number | null)[];
  deviation: (number | null)[];
  minVent: (number | null)[];
  maxVent: (number | null)[];
};

/** One controller (eqpmn) aligned series — list graph mode. */
export type TrendControllerSeries = TrendStallSeries & {
  controllerKey: string;
  eqpmnNo: string;
  thermoA?: TrendChannelThermo;
  thermoB?: TrendChannelThermo;
  thermoC?: TrendChannelThermo;
  /** 호버용 구역 표시명 (축사유형). */
  zoneLabel?: string;
  /** 호버용 장비 표시명 (컨트롤러 M). */
  equipmentLabel?: string;
  /** 스코프 이동용 축사유형 코드 (UI 미표시). */
  stallTyCode?: string;
  /** 추이 차트 전용 — 희소/통신두절/없음. 목록 그래프는 두지 않음. */
  uplinkKind?: Array<"sample" | "sparse" | "offline" | "void">;
};

export type TrendControllerStallGroup = {
  stallNo: string;
  controllers: TrendControllerSeries[];
};

/** One SP grouping controllers by barn. */
export type TrendControllerSpSeries = {
  stallTyCode: string;
  label: string;
  stalls: TrendControllerStallGroup[];
};

export type TrendControllerPeriodData = {
  period: TrendPeriodId;
  categories: string[];
  bucketAts: string[];
  sp: TrendControllerSpSeries[];
  totalSamples: number;
};

/** 드래그 줌 구간(≤48h)에 받은 15분. 펼친 기본 창·휠 룩백은 1시간. */
export type TrendWindow15m = {
  fromMs: number;
  toMs: number;
  data: TrendControllerPeriodData;
};

export function emptyTrendControllerPeriodData(
  period: TrendPeriodId,
): TrendControllerPeriodData {
  return { period, categories: [], bucketAts: [], sp: [], totalSamples: 0 };
}

/** 빈 시간축(카테고리만)이 아니라 실제 컨트롤러 시계열이 있는지. */
export function controllerTrendPeriodHasSeries(
  data: TrendControllerPeriodData | null | undefined,
): boolean {
  if (!data) return false;
  if (data.totalSamples > 0) return true;
  for (const sp of data.sp) {
    for (const stall of sp.stalls) {
      if (stall.controllers.length > 0) return true;
    }
  }
  return false;
}

/** 허브 30일 1시간 축이 채워졌는지. */
export function isContextControllerTrend30d(
  data: TrendControllerPeriodData | null | undefined,
): boolean {
  return (
    (data?.categories.length ?? 0) === TREND_PERIODS["30d"].bucketCount
  );
}

export function isControllerTrendPeriodComplete(
  data: TrendControllerPeriodData | null | undefined,
  period: TrendPeriodId,
): boolean {
  return (data?.categories.length ?? 0) === TREND_PERIODS[period].bucketCount;
}

/**
 * 30일 1시간이 있으면 브러시 캔버스.
 * 없으면 선택한 기간 → 7일 → 24시간 순.
 * `prefer24h` — 미니 타일이 30일 빈 칸보다 24시간 선을 먼저 쓴다.
 */
export function pickTrendCanvasPeriod(
  bundle: Partial<Record<TrendPeriodId, TrendControllerPeriodData>> | null | undefined,
  period: TrendPeriodId,
  prefer24h = false,
): TrendPeriodId {
  if (prefer24h && controllerTrendPeriodHasSeries(bundle?.["24h"])) {
    return "24h";
  }
  if (
    isContextControllerTrend30d(bundle?.["30d"]) &&
    controllerTrendPeriodHasSeries(bundle?.["30d"])
  ) {
    return "30d";
  }
  if (controllerTrendPeriodHasSeries(bundle?.[period])) return period;
  if (controllerTrendPeriodHasSeries(bundle?.["7d"])) return "7d";
  if (controllerTrendPeriodHasSeries(bundle?.["24h"])) return "24h";
  return period;
}

/** 기본 백그라운드 완료 — 30일 1시간 축. */
export function isCompleteControllerTrendBundle(
  bundle: Record<TrendPeriodId, TrendControllerPeriodData> | null | undefined,
): boolean {
  return isControllerTrendPeriodComplete(bundle?.["30d"], "30d");
}

/**
 * 허브 클라 로드 완료. `d30DaysScanned` 가 있으면 하루 조각 30개가
 * 끝나야 한다. 축 길이만으로는 시드·부분 30일을 완료로 보지 않는다.
 */
export function isFarmTrendLoadComplete(
  bundle: Record<TrendPeriodId, TrendControllerPeriodData> | null | undefined,
  d30DaysScanned?: number,
): boolean {
  if (d30DaysScanned != null) {
    return (
      d30DaysScanned >= TREND_30D_DAY_CHUNKS &&
      isControllerTrendPeriodComplete(bundle?.["30d"], "30d")
    );
  }
  return isCompleteControllerTrendBundle(bundle);
}
