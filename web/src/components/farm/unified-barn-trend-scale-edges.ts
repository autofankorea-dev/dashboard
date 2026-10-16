/**
 * 통합 추세 패널의 경보 눈금·현장 알람 띠.
 *
 * `unified-barn-trend-panel.tsx`에서 분리(동작 보존).
 */
import type { AlarmThresholds } from "@/lib/domain/alarms";
import type {
  TrendRangeBand,
  TrendScaleEdgeLabel,
} from "@/components/trends/trend-chart";
import { formatTrendBandEdge } from "@/lib/farm/trend-chart-format";
import { TREND_CHART_COLORS } from "@/lib/farm/trend-chart-series";
import {
  buildSplitYBandScaleTicks,
  mapTempCToSplitY,
  tempBrokenAxisPlotZones,
  type SplitYLayout,
  type SplitYVisibility,
  type TempBandAnchor,
  type UnifiedBarnTrendBuild,
  type UnifiedLayerFlags,
} from "@/lib/farm/unified-barn-trend-series";
import {
  FARM_ALARM_RANGE_FILL,
  FARM_ALARM_RANGE_FILL_OPACITY,
  FARM_ALARM_RANGE_TEMP_OVERLAY_OPACITY,
  farmAlarmMidValue,
} from "@/components/farm/unified-barn-trend-panel-helpers";

export function buildFarmTrendScaleEdges(args: {
  built: Pick<UnifiedBarnTrendBuild, "available"> | null;
  layers: UnifiedLayerFlags;
  plotThresholds: AlarmThresholds;
  mappingThresholds: AlarmThresholds;
  layout: SplitYLayout;
  scopeVisibility: SplitYVisibility;
  alarmEditEnabled: boolean;
  tempMapLayout: SplitYLayout;
  tempMapDomain?: [number, number];
  tempMapOverflow: [number, number] | null;
  chartLeftUnit: string;
  overlayActive: boolean;
  overlayAlign?: TempBandAnchor;
  alarmRangeOn: { temp: boolean; hum: boolean };
}): {
  scaleEdgeLabels: TrendScaleEdgeLabel[];
  alarmRangeBands: TrendRangeBand[];
} {
  const {
    built,
    layers,
    plotThresholds,
    mappingThresholds,
    layout,
    scopeVisibility,
    alarmEditEnabled,
    tempMapLayout,
    tempMapDomain,
    tempMapOverflow,
    chartLeftUnit,
    overlayActive,
    overlayAlign,
    alarmRangeOn,
  } = args;

if (!built) return { scaleEdgeLabels: [], alarmRangeBands: [] };
const out: TrendScaleEdgeLabel[] = [];
const rangeBands: TrendRangeBand[] = [];
const mapLo = plotThresholds.tempLow;
const mapHi = plotThresholds.tempHigh;
const mapHumLo = plotThresholds.humidityLow;
const mapHumHi = plotThresholds.humidityHigh;
const guideEditEnabled = alarmEditEnabled;
const farmAlarmEditEnabled = alarmEditEnabled;
const tempHiTitle = "현재 장비 고온 경보";
const tempLoTitle = "현재 장비 저온 경보";
const push = (
  id: string,
  chartY: number | null,
  text: string,
  color: string,
  mark: "overline" | "underline" | undefined,
  title: string,
  showLine: boolean,
  draggable = false,
  editValue?: number,
  opts?: {
    side?: "left" | "right" | "center" | "plotStart";
    leadingText?: string;
    labelLane?: "outer" | "inner";
    lineStrokeWidth?: number;
    lineDasharray?: string;
    lineHighlight?: boolean;
    showApplyActions?: boolean;
    hideLabel?: boolean;
    labelIcon?: "temp-alarm" | "hum-alarm";
  },
) => {
  if (chartY == null || !Number.isFinite(chartY)) return;
  out.push({
    id,
    value: chartY,
    axis: "left",
    side: opts?.side ?? "right",
    text,
    leadingText: opts?.leadingText,
    color,
    mark,
    title,
    showLine,
    draggable,
    editValue,
    labelLane: opts?.labelLane,
    lineStrokeWidth: opts?.lineStrokeWidth,
    lineDasharray: opts?.lineDasharray,
    lineHighlight: opts?.lineHighlight,
    showApplyActions: opts?.showApplyActions,
    hideLabel: opts?.hideLabel,
    labelIcon: opts?.labelIcon,
  });
};

if (Number.isFinite(mappingThresholds.tempLow) && scopeVisibility.showTemp && layers.temp && built.available.temp) {
  push(
    "temp-hi",
    mapTempCToSplitY(
      plotThresholds.tempHigh,
      mapLo,
      mapHi,
      tempMapLayout,
      overlayAlign ? undefined : tempMapDomain,
      overlayAlign,
      tempMapOverflow,
    ),
    formatTrendBandEdge(plotThresholds.tempHigh, "℃"),
    TREND_CHART_COLORS.temp,
    "overline",
    tempHiTitle,
    true,
    guideEditEnabled,
    plotThresholds.tempHigh,
    {
      lineStrokeWidth: 1.45,
      lineDasharray: "2 2",
      lineHighlight: true,
    },
  );
  push(
    "temp-lo",
    mapTempCToSplitY(
      plotThresholds.tempLow,
      mapLo,
      mapHi,
      tempMapLayout,
      overlayAlign ? undefined : tempMapDomain,
      overlayAlign,
      tempMapOverflow,
    ),
    formatTrendBandEdge(plotThresholds.tempLow, "℃"),
    TREND_CHART_COLORS.temp,
    "underline",
    tempLoTitle,
    true,
    guideEditEnabled,
    plotThresholds.tempLow,
    {
      lineStrokeWidth: 1.45,
      lineDasharray: "2 2",
      lineHighlight: true,
    },
  );
  const breakZones = tempBrokenAxisPlotZones(tempMapLayout);
  if (breakZones) {
    push(
      "temp-break",
      breakZones.breakY,
      "",
      "var(--border)",
      undefined,
      "경보 구간 위",
      true,
      false,
      undefined,
      {
        hideLabel: true,
        lineStrokeWidth: 1,
        lineDasharray: "2 4",
      },
    );
  }
}
{
  const tempFarmLayout = overlayAlign ? layout : tempMapLayout;
  const tempFarmDomain = overlayAlign ? undefined : tempMapDomain;
  if (
    alarmRangeOn.temp &&
    scopeVisibility.showTemp &&
    layers.temp &&
    built.available.temp
  ) {
    const tempFarmHiY = mapTempCToSplitY(
      mappingThresholds.tempHigh,
      mapLo,
      mapHi,
      tempFarmLayout,
      tempFarmDomain,
      overlayAlign,
      tempMapOverflow,
    );
    const tempFarmLoY = mapTempCToSplitY(
      mappingThresholds.tempLow,
      mapLo,
      mapHi,
      tempFarmLayout,
      tempFarmDomain,
      overlayAlign,
      tempMapOverflow,
    );
    const tempFarmMid = farmAlarmMidValue(
      mappingThresholds.tempLow,
      mappingThresholds.tempHigh,
    );
    if (tempFarmMid != null) {
      push(
        "temp-farm-mid",
        mapTempCToSplitY(
          tempFarmMid,
          mapLo,
          mapHi,
          tempFarmLayout,
          tempFarmDomain,
          overlayAlign,
          tempMapOverflow,
        ),
        formatTrendBandEdge(tempFarmMid, "℃"),
        TREND_CHART_COLORS.temp,
        undefined,
        "현재 장비 경보 기준",
        false,
        farmAlarmEditEnabled,
        tempFarmMid,
        { side: "left", labelIcon: "temp-alarm" },
      );
    }
    if (
      tempFarmHiY != null &&
      Number.isFinite(tempFarmHiY) &&
      tempFarmLoY != null &&
      Number.isFinite(tempFarmLoY)
    ) {
      rangeBands.push({
        id: "temp-farm-range",
        lo: tempFarmLoY,
        hi: tempFarmHiY,
        axis: "left",
        color: FARM_ALARM_RANGE_FILL,
        fillOpacity: overlayAlign
          ? FARM_ALARM_RANGE_TEMP_OVERLAY_OPACITY
          : FARM_ALARM_RANGE_FILL_OPACITY,
      });
    }
  }
}
if (!chartLeftUnit) {
  const ticks = buildSplitYBandScaleTicks({
    layout,
    showTemp: Boolean(
      scopeVisibility.showTemp && layers.temp && built.available.temp,
    ),
    showHum: Boolean(
      scopeVisibility.showHum &&
        (layers.hum || layers.humDev || layers.humBand || layers.humEma),
    ),
    showMotors: Boolean(
      scopeVisibility.showMotors && (layers.motors || layers.motorCh),
    ),
    overlay: overlayActive,
    tempLow: mapLo,
    tempHigh: mapHi,
    humidityLow: mapHumLo,
    humidityHigh: mapHumHi,
  });
  for (const tick of ticks) {
    // The device midpoint is already labeled by temp-farm-mid. Other ticks are measured-axis labels.
    if (tick.id === "band-tick-temp-mid" && alarmRangeOn.temp &&
        Number.isFinite(mappingThresholds.tempLow) && Number.isFinite(mappingThresholds.tempHigh)) continue;
    push(
      tick.id, tick.chartY, formatTrendBandEdge(tick.value, tick.unit),
      "var(--muted-foreground)", undefined, "눈금", true, false, undefined,
      { side: "left", lineStrokeWidth: 0.35, lineDasharray: "solid", lineHighlight: false },
    );
  }
}
return { scaleEdgeLabels: out, alarmRangeBands: rangeBands };
}
