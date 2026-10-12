/**
 * 분리 밴드 왼쪽 눈금.
 *
 * `unified-trend-split-y.ts`에서 분리(동작 보존).
 */
import { tempBrokenAxisPlotZones } from "./unified-barn-trend-layout";
import type { SplitYLayout } from "./unified-barn-trend-layout";
import {
  SPLIT_Y_HUM_EDGE_PAD_PCT,
  SPLIT_Y_TEMP_EDGE_PAD_C,
  alarmEdgeDomain,
  mapHumPctToSplitY,
  mapMotorPctToSplitY,
  mapTempCToSplitY,
  resolveTempBrokenMappingDomain,
} from "./unified-trend-split-y";

function alarmMidValue(lo: number, hi: number): number | null {
  if (!(Number.isFinite(lo) && Number.isFinite(hi))) return null;
  return (lo + hi) / 2;
}

export type SplitYBandScaleTick = {
  id: string;
  chartY: number;
  value: number;
  unit: "℃" | "%";
};

/**
 * 분리 밴드 왼쪽 눈금 — 기본은 온·습·모터 상·하한의 중간값.
 * 기준 띠가 있는 패널은 온·습 기준 중간값을 건너뛰고 현장 알람 평균을 둔다.
 * 오버레이에서는 왼쪽 눈금을 그리지 않는다.
 */
export function buildSplitYBandScaleTicks(opts: {
  layout: SplitYLayout;
  showTemp: boolean;
  showHum: boolean;
  showMotors: boolean;
  overlay?: boolean;
  tempLow: number;
  tempHigh: number;
  humidityLow: number;
  humidityHigh: number;
}): SplitYBandScaleTick[] {
  if (opts.overlay) return [];
  const out: SplitYBandScaleTick[] = [];
  const { layout } = opts;
  if (opts.showTemp && layout.tempHi > layout.tempLo) {
    const mid = alarmMidValue(opts.tempLow, opts.tempHigh);
    const domain = tempBrokenAxisPlotZones(layout)
      ? resolveTempBrokenMappingDomain(
          opts.tempLow,
          opts.tempHigh,
          opts.tempHigh + SPLIT_Y_TEMP_EDGE_PAD_C,
        )
      : alarmEdgeDomain(
          opts.tempLow,
          opts.tempHigh,
          SPLIT_Y_TEMP_EDGE_PAD_C,
        );
    if (mid != null && domain[1] > domain[0]) {
      const y = mapTempCToSplitY(
        mid,
        opts.tempLow,
        opts.tempHigh,
        layout,
        domain,
      );
      if (y != null && Number.isFinite(y)) {
        out.push({
          id: "band-tick-temp-mid",
          chartY: y,
          value: mid,
          unit: "℃",
        });
      }
    }
  }
  if (opts.showHum && layout.humHi > layout.humLo) {
    const mid = alarmMidValue(opts.humidityLow, opts.humidityHigh);
    const domain = alarmEdgeDomain(
      opts.humidityLow,
      opts.humidityHigh,
      SPLIT_Y_HUM_EDGE_PAD_PCT,
    );
    if (mid != null && domain[1] > domain[0]) {
      const y = mapHumPctToSplitY(
        mid,
        opts.humidityLow,
        opts.humidityHigh,
        layout,
        domain,
      );
      if (y != null && Number.isFinite(y)) {
        out.push({
          id: "band-tick-hum-mid",
          chartY: y,
          value: mid,
          unit: "%",
        });
      }
    }
  }
  if (opts.showMotors && layout.motorHi > layout.motorLo) {
    const y = mapMotorPctToSplitY(50, layout);
    if (y != null && Number.isFinite(y)) {
      out.push({
        id: "band-tick-motor-mid",
        chartY: y,
        value: 50,
        unit: "%",
      });
    }
  }
  return out;
}
