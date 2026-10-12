/**
 * 집계 raw를 split-Y 시리즈로 조립한다.
 *
 * 레이어 선택·트림은 모른다.
 * 공개 이름은 배럴이 다시 내보내 기존 import 경로를 유지한다.
 */
import type { AlarmThresholds } from "@/lib/domain/alarms";
import type { TrendControllerSeries } from "@/lib/domain/farm-trend-types";
import type {
  TrendEnvelope,
  TrendHistogram,
  TrendSeries,
} from "@/lib/domain/trend-chart-types";
import { TREND_CHART_COLORS } from "@/lib/farm/trend-chart-series";
import {
  DEV_HIST_COLOR_DOWN,
  DEV_HIST_COLOR_UP,
  EMA_LONG_COLOR,
  EMA_SHORT_COLOR,
  HUM_DEV_HIST_COLOR_DOWN,
  HUM_DEV_HIST_COLOR_UP,
  HUM_EMA_LONG_COLOR,
  HUM_EMA_SHORT_COLOR,
  UNIFIED_CHART_LABELS,
  UNIFIED_HUM_BAND_FILL,
  UNIFIED_TEMP_BAND_FILL,
} from "./unified-trend-colors";
import {
  resolveSplitYLayout,
  tempBrokenAxisPlotZones,
} from "./unified-barn-trend-layout";
import type { SplitYLayout, SplitYVisibility } from "./unified-barn-trend-layout";
import {
  SPLIT_Y_HUM_EDGE_PAD_PCT,
  SPLIT_Y_TEMP_EDGE_PAD_C,
  alarmEdgeDomain,
  mapColumn,
  mapHumDeviationToSplitY,
  mapHumPctToSplitY,
  mapMotorPctToSplitY,
  mapTempCToSplitY,
  mapTempDeviationToSplitY,
  resolveTempOverflowFitDomain,
  tempBrokenLinearEdge,
  tempRawOverflowColumns,
} from "./unified-trend-split-y";
import type { TempBandAnchor } from "./unified-trend-split-y";
import {
  DEV_HIDE_ABS_C,
  HUM_DEV_HIDE_ABS,
  aggregateUnifiedBarnTrendRaw,
  hasFinite,
  tempDisplayDomainFromRaw,
} from "./unified-trend-raw";
import type { UnifiedBarnTrendRaw } from "./unified-trend-raw";

export type UnifiedBuildOptions = {
  /** @deprecated showHum — visibility 사용 */
  showHum?: boolean;
  visibility?: SplitYVisibility;
  /** 지정 시 resolveSplitYLayout 대신 이 레이아웃으로 매핑 (보간 중) */
  layout?: SplitYLayout;
  /** 컨트롤러 1대 범위에서만 설정 변경 마커 */
  includeThermo?: boolean;
};

export type UnifiedSeriesKey =
  | "temp"
  | "hum"
  | "emaShort"
  | "emaLong"
  | "humEmaShort"
  | "humEmaLong";

export type UnifiedBarnTrendBuild = {
  categories: string[];
  seriesByKey: Partial<Record<UnifiedSeriesKey, TrendSeries>>;
  envelopesBand: TrendEnvelope | null;
  envelopesHumBand: TrendEnvelope | null;
  histogramDev: TrendHistogram | null;
  histogramHumDev: TrendHistogram | null;
  /** 모터 max(A,B,C) 단일 바 */
  histogramMotorsMax: TrendHistogram[];
  /** 모터 A·B·C 채널 바 */
  histogramMotorsChannels: TrendHistogram[];
  layout: SplitYLayout;
  leftDomain: [number, number];
  rightDomain: [number, number];
  /** 온도 매핑에 쓴 ℃ 도메인 (표시 최솟·최댓값 + 여유) */
  tempDomain: [number, number];
  /** 꺾인 축 위칸 — 기준 밖 실측 min–max. 없으면 위칸 매핑 없음 */
  tempOverflowDomain: [number, number] | null;
  controllerCount: number;
  tempRangeLabel: string;
  humidityRangeLabel: string;
  thresholds: AlarmThresholds;
  /**
   * 온도 상·하한 임계선의 split-Y 위치 — 본선과 동일 매핑(오버레이 앵커 포함).
   * 임계 접촉 코리도가 재계산 대신 이 값을 재사용해 정합을 보장한다.
   */
  tempHiPlot: number | null;
  tempLoPlot: number | null;
  /** hum/motors: 시계열이 없어도 밴드·가이드를 연다. 본선 유무는 series/histogram 길이. */
  available: {
    motors: boolean;
    motorCh: boolean;
    temp: boolean;
    hum: boolean;
    band: boolean;
    dev: boolean;
    ema: boolean;
    humBand: boolean;
    humDev: boolean;
    humEma: boolean;
    thermo: boolean;
    thermoMotor: boolean;
  };
};

function isNativeTempIdentityLayout(layout: SplitYLayout): boolean {
  return (
    layout.tempHi > layout.tempLo &&
    layout.tempLo === layout.domain[0] &&
    layout.tempHi === layout.domain[1] &&
    layout.motorHi <= layout.motorLo &&
    layout.humHi <= layout.humLo &&
    !(layout.domain[0] === 0 && layout.domain[1] === 100)
  );
}

function isNativeHumIdentityLayout(layout: SplitYLayout): boolean {
  return (
    layout.humHi > layout.humLo &&
    layout.humLo === layout.domain[0] &&
    layout.humHi === layout.domain[1] &&
    layout.motorHi <= layout.motorLo &&
    layout.tempHi <= layout.tempLo &&
    !(layout.domain[0] === 0 && layout.domain[1] === 100)
  );
}

/** raw → split-Y 플롯. layout 보간 프레임마다 호출해도 집계 비용 없음. */
export function mapUnifiedBarnTrendRawToSplitY(
  raw: UnifiedBarnTrendRaw,
  layout: SplitYLayout,
  /** 오버레이 auto-fit: 온도 매핑 도메인 오버라이드(생략 시 알람±여유) */
  tempDomain?: [number, number],
  /** 오버레이 앵커: 지정 시 데이터 도메인보다 우선(알람 코어 + 헤드룸) */
  tempAnchor?: TempBandAnchor,
  /** 꺾인 축 위칸 공유 도메인. 컨트롤러 오버레이는 합친 이탈 폭을 넘긴다 */
  overflowDomainOverride?: [number, number] | null,
): UnifiedBarnTrendBuild | null {
  const {
    tempLow,
    tempHigh,
    humidityLow,
    humidityHigh,
    tempMid,
    humMid,
  } = raw;

  const fitted = tempDomain ?? tempDisplayDomainFromRaw(raw);
  const plotLayout = isNativeTempIdentityLayout(layout)
    ? {
        ...layout,
        tempLo: fitted[0],
        tempHi: fitted[1],
        domain: fitted,
      }
    : layout;
  const overflowFit =
    tempBrokenAxisPlotZones(layout)
      ? overflowDomainOverride !== undefined
        ? overflowDomainOverride
        : resolveTempOverflowFitDomain(
            tempLow,
            tempHigh,
            tempRawOverflowColumns(raw),
          )
      : null;
  const mappingTempDomain = tempAnchor
    ? undefined
    : isNativeTempIdentityLayout(layout)
      ? fitted
      : tempBrokenAxisPlotZones(layout)
        ? overflowFit
          ? ([
              tempBrokenLinearEdge(tempLow, tempHigh)[0],
              overflowFit[1],
            ] as [number, number])
          : alarmEdgeDomain(tempLow, tempHigh, SPLIT_Y_TEMP_EDGE_PAD_C)
        : alarmEdgeDomain(tempLow, tempHigh, SPLIT_Y_TEMP_EDGE_PAD_C);
  const mappingHumDomain = tempAnchor
    ? undefined
    : isNativeHumIdentityLayout(layout)
      ? undefined
      : alarmEdgeDomain(
          humidityLow,
          humidityHigh,
          SPLIT_Y_HUM_EDGE_PAD_PCT,
        );

  const mapTemp = (v: number | null | undefined) =>
    mapTempCToSplitY(
      v,
      tempLow,
      tempHigh,
      plotLayout,
      mappingTempDomain,
      tempAnchor,
      overflowFit,
    );
  const mapHum = (v: number | null | undefined) =>
    mapHumPctToSplitY(
      v,
      humidityLow,
      humidityHigh,
      layout,
      mappingHumDomain,
      tempAnchor,
    );
  const mapMotor = (v: number | null | undefined) =>
    mapMotorPctToSplitY(v, layout, tempAnchor);

  const tempPlot = mapColumn(raw.tempAvg, mapTemp);
  const humPlot = mapColumn(raw.humAvg, mapHum);
  const tempMinPlot = mapColumn(raw.tempMin, mapTemp);
  const tempMaxPlot = mapColumn(raw.tempMax, mapTemp);
  const humMinPlot = mapColumn(raw.humMin, mapHum);
  const humMaxPlot = mapColumn(raw.humMax, mapHum);
  const emaShortPlot = mapColumn(raw.emaShortRaw, mapTemp);
  const emaLongPlot = mapColumn(raw.emaLongRaw, mapTemp);
  const humEmaShortPlot = mapColumn(raw.humEmaShortRaw, mapHum);
  const humEmaLongPlot = mapColumn(raw.humEmaLongRaw, mapHum);

  const tempDevPlot = mapColumn(raw.tempDevRaw, (d) => {
    if (d == null || !Number.isFinite(d) || Math.abs(d) < DEV_HIDE_ABS_C) {
      return null;
    }
    return mapTempDeviationToSplitY(
      d,
      tempLow,
      tempHigh,
      plotLayout,
      mappingTempDomain,
      tempAnchor,
      overflowFit,
    );
  });
  const tempMidPlot = mapTempCToSplitY(
    tempMid,
    tempLow,
    tempHigh,
    plotLayout,
    mappingTempDomain,
    tempAnchor,
    overflowFit,
  );
  /** 임계선 split-Y — 본선과 동일 매핑(앵커 포함). 코리도 정합용 */
  const tempHiPlot = mapTemp(tempHigh);
  const tempLoPlot = mapTemp(tempLow);

  const humDevPlot = mapColumn(raw.humDevRaw, (d) => {
    if (d == null || !Number.isFinite(d) || Math.abs(d) < HUM_DEV_HIDE_ABS) {
      return null;
    }
    return mapHumDeviationToSplitY(
      d,
      humidityLow,
      humidityHigh,
      layout,
      mappingHumDomain,
      tempAnchor,
    );
  });
  const humMidPlot = mapHumPctToSplitY(
    humMid,
    humidityLow,
    humidityHigh,
    layout,
    mappingHumDomain,
    tempAnchor,
  );

  const seriesByKey: Partial<Record<UnifiedSeriesKey, TrendSeries>> = {};
  if (hasFinite(tempPlot)) {
    seriesByKey.temp = {
      name: "온도",
      data: tempPlot,
      color: TREND_CHART_COLORS.temp,
      axis: "left",
      hoverSecondary: raw.tempAvg,
      hoverSecondaryUnit: "℃",
      hoverAlarmBand: {
        lo: tempLow,
        hi: tempHigh,
        unit: "℃",
      },
      hoverSpreadExtremes: raw.tempSpreadExtremes,
    };
  }
  if (hasFinite(humPlot)) {
    seriesByKey.hum = {
      name: "습도",
      data: humPlot,
      color: TREND_CHART_COLORS.humidity,
      axis: "left",
      hoverSecondary: raw.humAvg,
      hoverSecondaryUnit: "%",
      hoverAlarmBand: {
        lo: humidityLow,
        hi: humidityHigh,
        unit: "%",
      },
      hoverSpreadExtremes: raw.humSpreadExtremes,
    };
  }
  if (hasFinite(emaShortPlot)) {
    seriesByKey.emaShort = {
      name: UNIFIED_CHART_LABELS.tempEmaShort,
      data: emaShortPlot,
      color: EMA_SHORT_COLOR,
      axis: "left",
      strokeDasharray: "4 3",
      hoverSecondary: raw.emaShortRaw,
      hoverSecondaryUnit: "℃",
    };
  }
  if (hasFinite(emaLongPlot)) {
    seriesByKey.emaLong = {
      name: UNIFIED_CHART_LABELS.tempEmaLong,
      data: emaLongPlot,
      color: EMA_LONG_COLOR,
      axis: "left",
      strokeDasharray: "6 4",
      hoverSecondary: raw.emaLongRaw,
      hoverSecondaryUnit: "℃",
    };
  }
  if (hasFinite(humEmaShortPlot)) {
    seriesByKey.humEmaShort = {
      name: UNIFIED_CHART_LABELS.humEmaShort,
      data: humEmaShortPlot,
      color: HUM_EMA_SHORT_COLOR,
      axis: "left",
      strokeDasharray: "4 3",
      hoverSecondary: raw.humEmaShortRaw,
      hoverSecondaryUnit: "%",
    };
  }
  if (hasFinite(humEmaLongPlot)) {
    seriesByKey.humEmaLong = {
      name: UNIFIED_CHART_LABELS.humEmaLong,
      data: humEmaLongPlot,
      color: HUM_EMA_LONG_COLOR,
      axis: "left",
      strokeDasharray: "6 4",
      hoverSecondary: raw.humEmaLongRaw,
      hoverSecondaryUnit: "%",
    };
  }

  const fanAPlot = mapColumn(raw.fanA, mapMotor);
  const fanBPlot = mapColumn(raw.fanB, mapMotor);
  const fanCPlot = mapColumn(raw.fanC, mapMotor);
  const fanMaxPlot = mapColumn(raw.fanMaxRaw, mapMotor);

  const motorDefs = [
    {
      plot: fanAPlot,
      raw: raw.fanA,
      color: TREND_CHART_COLORS.fanIntake,
      label: UNIFIED_CHART_LABELS.motorA,
    },
    {
      plot: fanBPlot,
      raw: raw.fanB,
      color: TREND_CHART_COLORS.fanExhaust,
      label: UNIFIED_CHART_LABELS.motorB,
    },
    {
      plot: fanCPlot,
      raw: raw.fanC,
      color: TREND_CHART_COLORS.fanSupply,
      label: UNIFIED_CHART_LABELS.motorC,
    },
  ].filter((m) => hasFinite(m.raw));

  const motorHoverChannels = motorDefs.map((m) => ({
    label: m.label,
    color: m.color,
    values: m.raw,
  }));

  const histogramMotorsMax: TrendHistogram[] = hasFinite(raw.fanMaxRaw)
    ? [
        {
          values: fanMaxPlot,
          baseline: layout.motorLo,
          colorUp: TREND_CHART_COLORS.fanIntake,
          colorDown: TREND_CHART_COLORS.fanIntake,
          style: "volume" as const,
          legendLabel: UNIFIED_CHART_LABELS.motor,
          hoverSecondary: raw.fanMaxRaw,
          hoverSecondaryUnit: "%",
          hoverChannels: motorHoverChannels,
        },
      ]
    : [];

  const histogramMotorsChannels: TrendHistogram[] = motorDefs.map((m, i) => ({
    values: m.plot,
    baseline: layout.motorLo,
    colorUp: m.color,
    colorDown: m.color,
    style: "volume" as const,
    groupIndex: i,
    groupSize: motorDefs.length,
    legendLabel: m.label,
    hoverSecondary: m.raw,
    hoverSecondaryUnit: "%",
    hoverChannels: motorHoverChannels,
  }));

  const hasMotorSeries =
    histogramMotorsMax.length > 0 || histogramMotorsChannels.length > 0;

  if (
    !Object.keys(seriesByKey).length &&
    !hasFinite(tempDevPlot) &&
    !hasFinite(humDevPlot) &&
    !hasMotorSeries
  ) {
    return null;
  }

  const envelopesBand =
    hasFinite(tempMinPlot) && hasFinite(tempMaxPlot)
      ? {
          high: tempMaxPlot,
          low: tempMinPlot,
          axis: "left" as const,
          fill: UNIFIED_TEMP_BAND_FILL,
          fillOpacity: 0.12,
          legendLabel: UNIFIED_CHART_LABELS.tempBand,
          hoverExtremes: raw.tempSpreadExtremes,
        }
      : null;

  const envelopesHumBand =
    hasFinite(humMinPlot) && hasFinite(humMaxPlot)
      ? {
          high: humMaxPlot,
          low: humMinPlot,
          axis: "left" as const,
          fill: UNIFIED_HUM_BAND_FILL,
          fillOpacity: 0.14,
          legendLabel: UNIFIED_CHART_LABELS.humBand,
          hoverExtremes: raw.humSpreadExtremes,
        }
      : null;

  const histogramDev =
    hasFinite(tempDevPlot) && tempMidPlot != null
      ? {
          values: tempDevPlot,
          baseline: tempMidPlot,
          colorUp: DEV_HIST_COLOR_UP,
          colorDown: DEV_HIST_COLOR_DOWN,
          style: "overlay" as const,
          fillOpacity: 0.14,
          fillOpacityValues: raw.tempDevOpacity,
          legendLabel: UNIFIED_CHART_LABELS.tempDev,
          hoverSecondary: raw.tempDevRaw,
          hoverSecondaryUnit: "℃",
          hoverFormat: "midpointDelta" as const,
        }
      : null;

  const histogramHumDev =
    hasFinite(humDevPlot) && humMidPlot != null
      ? {
          values: humDevPlot,
          baseline: humMidPlot,
          colorUp: HUM_DEV_HIST_COLOR_UP,
          colorDown: HUM_DEV_HIST_COLOR_DOWN,
          style: "overlay" as const,
          fillOpacity: 0.14,
          fillOpacityValues: raw.humDevOpacity,
          legendLabel: UNIFIED_CHART_LABELS.humDev,
          hoverSecondary: raw.humDevRaw,
          hoverSecondaryUnit: "%",
          hoverFormat: "midpointDelta" as const,
        }
      : null;

  return {
    categories: raw.categories,
    seriesByKey,
    envelopesBand,
    envelopesHumBand,
    histogramDev,
    histogramHumDev,
    histogramMotorsMax,
    histogramMotorsChannels,
    layout: plotLayout,
    leftDomain: [...plotLayout.domain],
    rightDomain: [...plotLayout.domain],
    tempDomain: mappingTempDomain ?? fitted,
    tempOverflowDomain: overflowFit,
    controllerCount: raw.controllerCount,
    tempRangeLabel: raw.tempRangeLabel,
    humidityRangeLabel: raw.humidityRangeLabel,
    thresholds: raw.thresholds,
    tempHiPlot,
    tempLoPlot,
    available: {
      motors: histogramMotorsMax.length > 0 || histogramMotorsChannels.length > 0,
      motorCh: histogramMotorsChannels.length > 0,
      temp: Boolean(seriesByKey.temp),
      hum: Boolean(seriesByKey.hum),
      band: Boolean(envelopesBand),
      dev: Boolean(histogramDev),
      ema: Boolean(seriesByKey.emaShort),
      humBand: Boolean(envelopesHumBand),
      humDev: Boolean(histogramHumDev),
      humEma: Boolean(seriesByKey.humEmaShort),
      thermo: false,
      thermoMotor: false,
    },
  };
}

/**
 * 패널 내 컨트롤러 equally 평균 → split Y.
 * M1: 내부적으로 집계+매핑. 보간 경로에서는 aggregate/map 분리 사용.
 */
export function buildUnifiedBarnTrendSeries(
  controllerSeriesList: TrendControllerSeries[],
  categories: string[],
  thresholds: AlarmThresholds,
  options: UnifiedBuildOptions = {},
): UnifiedBarnTrendBuild | null {
  const raw = aggregateUnifiedBarnTrendRaw(
    controllerSeriesList,
    categories,
    thresholds,
    { includeThermo: options.includeThermo },
  );
  if (!raw) return null;

  const visibility: SplitYVisibility = options.visibility ?? {
    showTemp: true,
    showHum: options.showHum ?? false,
    showMotors: true,
    showCommand: true,
  };
  const layout = options.layout ?? resolveSplitYLayout(visibility);
  void visibility;
  return mapUnifiedBarnTrendRawToSplitY(raw, layout);
}

