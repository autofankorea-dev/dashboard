import { CHANNEL_SLOT_LABELS } from "@/lib/domain/iot-channel";
import type { TrendEventMark } from "@/lib/domain/trend-chart-types";
import { formatKst } from "@/lib/datetime/kst";
import { formatTempDisplay, formatVentDisplay } from "@/lib/farm/command-confirm";
import { commandHoldRowIndex } from "@/lib/farm/command-hold-bands";
import type { DecodedSettingHoldSeg } from "@/lib/farm/channel-thermo";

function ventLabel(lo: number | null, hi: number | null): string {
  if (lo == null || hi == null || !Number.isFinite(lo) || !Number.isFinite(hi)) {
    return "—";
  }
  return `${formatVentDisplay(lo).replace("%", "")}–${formatVentDisplay(hi)}`;
}

/** 매핑된 설정 창을 해당 밴드 안으로만 자른다. 축을 늘리지 않음. */
export function clipCommandSettingY(
  yLo: number | null,
  yHi: number | null,
  bandLo: number,
  bandHi: number,
): { yLo: number; yHi: number } | null {
  if (yLo == null || yHi == null || !Number.isFinite(yLo) || !Number.isFinite(yHi)) {
    return null;
  }
  const lo = Math.min(yLo, yHi);
  const hi = Math.max(yLo, yHi);
  const bLo = Math.min(bandLo, bandHi);
  const bHi = Math.max(bandLo, bandHi);
  const cLo = Math.max(lo, bLo);
  const cHi = Math.min(hi, bHi);
  if (!(cHi > cLo)) return null;
  return { yLo: cLo, yHi: cHi };
}

/** decoded 유지 구간 → 호버 카드. 값은 RPC 설정(절대 ℃ 창). */
export function decodedSettingHoldToEventMark(
  seg: DecodedSettingHoldSeg,
): TrendEventMark {
  const channelLabel = CHANNEL_SLOT_LABELS[seg.channel];
  const atIso = new Date(seg.x0Ms).toISOString();
  const time = formatKst(atIso, "short");
  const dev = Math.max(0, seg.tempHi - seg.tempLo);
  return {
    id: `decoded:${seg.channel}:${seg.i0}:${seg.x0Ms}`,
    atMs: seg.x0Ms,
    row: commandHoldRowIndex(seg.channel) ?? 0,
    tone: "ok",
    ariaLabel: `${time} ${channelLabel}`,
    markerLabel: seg.channel,
    hold: {
      channel: seg.channel,
      tempLo: seg.tempLo,
      tempHi: seg.tempHi,
      ventLo: seg.ventLo,
      ventHi: seg.ventHi,
    },
    card: {
      badge: "설정",
      time,
      hero: channelLabel,
      heroTone: "ok",
      rows: [
        { label: "설정온도", value: formatTempDisplay(seg.tempLo) },
        { label: "편차", value: `±${formatTempDisplay(dev)}` },
        { label: "환기", value: ventLabel(seg.ventLo, seg.ventHi) },
      ],
    },
  };
}
