/**
 * 통합 추세 차트 색·범례 이름.
 *
 * 시리즈 조립이 배럴을 다시 부르면 순환이 생기므로 상수만 따로 둔다.
 * 공개 이름은 `unified-barn-trend-series.ts`가 다시 내보낸다.
 */
import { CHANNEL_SLOT_LABELS } from "@/lib/domain/iot-channel";

export const UNIFIED_TEMP_BAND_FILL = "var(--channel-temp)";
/** 온도 편차 히스토그램 — 본선(채널 temp)과 톤만 구분 */
export const DEV_HIST_COLOR_UP = "color-mix(in oklch, var(--channel-temp) 72%, var(--mix-lift))";
export const DEV_HIST_COLOR_DOWN = "color-mix(in oklch, var(--channel-temp) 55%, var(--channel-hum))";
/** EMA 추세선 (온도) */
export const EMA_SHORT_COLOR = "color-mix(in oklch, var(--channel-temp) 45%, var(--mix-lift))";
export const EMA_LONG_COLOR = "color-mix(in oklch, var(--channel-temp) 72%, var(--mix-shade))";

export const UNIFIED_HUM_BAND_FILL = "var(--channel-hum)";
/** 습도 편차 히스토그램 — 본선(채널 hum)과 톤만 구분 */
export const HUM_DEV_HIST_COLOR_UP = "color-mix(in oklch, var(--channel-hum) 65%, var(--mix-lift))";
export const HUM_DEV_HIST_COLOR_DOWN = "color-mix(in oklch, var(--channel-hum) 55%, var(--channel-fan-exhaust))";
export const HUM_EMA_SHORT_COLOR = "color-mix(in oklch, var(--channel-hum) 50%, var(--mix-lift))";
export const HUM_EMA_LONG_COLOR = "color-mix(in oklch, var(--channel-hum) 70%, var(--mix-shade))";

/** 통합 차트 UI 정식명 (범례·툴팁) */
export const UNIFIED_CHART_LABELS = {
  tempEmaShort: "온도 추세",
  tempEmaLong: "온도 장기 추세",
  humEmaShort: "습도 추세",
  humEmaLong: "습도 장기 추세",
  tempBand: "온도 산포",
  humBand: "습도 산포",
  tempDev: "온도 편차",
  humDev: "습도 편차",
  motor: "모터",
  motorA: CHANNEL_SLOT_LABELS.A,
  motorB: CHANNEL_SLOT_LABELS.B,
  motorC: CHANNEL_SLOT_LABELS.C,
} as const;

