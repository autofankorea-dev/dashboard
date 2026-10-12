/**
 * 통합 추세 패널의 명령 설정 오버레이.
 *
 * `unified-barn-trend-panel.tsx`에서 분리(동작 보존).
 */
import type { TrendCommandSettingSeg } from "@/lib/domain/trend-chart-types";
import { buildDecodedSettingHoldSegments } from "@/lib/farm/channel-thermo";
import type { CommandChannelFlags } from "@/lib/farm/command-hold-bands";
import {
  clipCommandSettingY,
  decodedSettingHoldToEventMark,
} from "@/lib/farm/decoded-setting-hold";
import type { SplitYLayout } from "@/lib/farm/unified-barn-trend-layout";
import {
  mapMotorPctToSplitY,
  mapTempCToSplitY,
  type TempBandAnchor,
} from "@/lib/farm/unified-trend-split-y";
import { parseCategoryTimelineMs } from "@/lib/farm/trend-display-buckets";

export function buildUnifiedCommandSettingSegs(input: {
  showCommandOverlay: boolean;
  showTempCommandOverlay: boolean;
  showMotorCommandOverlay: boolean;
  hasBuilt: boolean;
  windows:
    | Parameters<typeof buildDecodedSettingHoldSegments>[0]
    | null
    | undefined;
  categories: string[];
  tempLow: number;
  tempHigh: number;
  tempBandLo: number;
  tempBandHi: number;
  layout: SplitYLayout;
  tempDomain?: [number, number];
  tempOverflowDomain?: [number, number] | null;
  overlayAlign?: TempBandAnchor;
  commandChannels: CommandChannelFlags;
}): TrendCommandSettingSeg[] {
  const {
    showCommandOverlay,
    showTempCommandOverlay,
    showMotorCommandOverlay,
    hasBuilt,
    windows,
    categories,
    tempLow,
    tempHigh,
    tempBandLo,
    tempBandHi,
    layout,
    tempDomain,
    tempOverflowDomain,
    overlayAlign,
    commandChannels,
  } = input;
  if (!showCommandOverlay || !hasBuilt || !windows) return [];
  const times = parseCategoryTimelineMs(categories);
  if (!times || times.length < 1) return [];
  const endMs = times[times.length - 1]!;
  const segs = buildDecodedSettingHoldSegments(windows, times, endMs);
  const out: TrendCommandSettingSeg[] = [];
  for (const seg of segs) {
    if (!commandChannels[seg.channel]) continue;
    const mark = decodedSettingHoldToEventMark(seg);
    if (showTempCommandOverlay) {
      const clipped = clipCommandSettingY(
        mapTempCToSplitY(
          seg.tempLo,
          tempLow,
          tempHigh,
          layout,
          overlayAlign ? undefined : tempDomain,
          overlayAlign,
          tempOverflowDomain,
        ),
        mapTempCToSplitY(
          seg.tempHi,
          tempLow,
          tempHigh,
          layout,
          overlayAlign ? undefined : tempDomain,
          overlayAlign,
          tempOverflowDomain,
        ),
        tempBandLo,
        tempBandHi,
      );
      if (clipped) {
        out.push({
          mark,
          x0Ms: seg.x0Ms,
          x1Ms: seg.x1Ms,
          yLo: clipped.yLo,
          yHi: clipped.yHi,
          band: "temp",
        });
      }
    }
    if (showMotorCommandOverlay) {
      const clipped = clipCommandSettingY(
        mapMotorPctToSplitY(seg.ventLo, layout),
        mapMotorPctToSplitY(seg.ventHi, layout),
        layout.motorLo,
        layout.motorHi,
      );
      if (clipped) {
        out.push({
          mark,
          x0Ms: seg.x0Ms,
          x1Ms: seg.x1Ms,
          yLo: clipped.yLo,
          yHi: clipped.yHi,
          band: "motor",
        });
      }
    }
  }
  return out;
}
