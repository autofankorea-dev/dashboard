/** 클라이언트 차트용 — server-only 없음 */



import {

  FIRMWARE_CTRL_COUNT,

  LEGACY_CTRL_COUNT,

} from "@/lib/domain/iot-firmware";

import { type FarmKey } from "@/lib/domain/farm-key";
import { farmShortLabel } from "@/lib/domain/farm-summaries";



/** v0x06 LIVE: idx 0~47 (48 slots) */

export const LIVE_SLOT_COUNT = FIRMWARE_CTRL_COUNT;



/** 레거시 v0x04: idx 0~49 (50 slots) */

export const LEGACY_SLOT_COUNT = LEGACY_CTRL_COUNT;

export type ControllerMetricKey =

  | "tempC"

  | "humidityPct"

  | "fanSupply"

  | "fanExhaust"

  | "fanIntake";



export type ControllerSlotReading = {

  idx: number;

  farmKey: FarmKey;

  moduleUid: number;

  label: string;

  tempC: number | null;

  humidityPct: number | null;

  fanSupply: number | null;

  fanExhaust: number | null;

  fanIntake: number | null;

};



export type ChartSlotItem = {

  label: string;

  value: number | null;

  title?: string;

};



export function resolveSlotCount(readings: ControllerSlotReading[]): number {

  const maxIdx = readings.reduce((max, r) => Math.max(max, r.idx), -1);

  return maxIdx >= LEGACY_SLOT_COUNT - 1 ? LEGACY_SLOT_COUNT : LIVE_SLOT_COUNT;

}



/** 환경 비교 차트: x축 컨트롤러 슬롯 (LIVE 1~48, 레거시 1~50) */

export function buildControllerSlotSeries(

  readings: ControllerSlotReading[],

  metric: ControllerMetricKey,

  slotCount?: number

): ChartSlotItem[] {

  const slots = slotCount ?? resolveSlotCount(readings);

  const bySlot = new Map<number, ControllerSlotReading[]>();



  for (const r of readings) {

    const slot = r.idx + 1;

    if (slot < 1 || slot > slots) continue;

    const list = bySlot.get(slot) ?? [];

    list.push(r);

    bySlot.set(slot, list);

  }



  return Array.from({ length: slots }, (_, i) => {

    const slot = i + 1;

    const matched = bySlot.get(slot) ?? [];

    const metricValues = matched

      .map((m) => m[metric])

      .filter((v): v is number => v !== null);

    const value =

      metricValues.length > 0

        ? metricValues.reduce((a, b) => a + b, 0) / metricValues.length

        : null;



    const title =

      matched.length === 0

        ? `컨트롤러 ${slot}: 데이터 없음`

        : matched

            .map((m) => {

              const v = m[metric];

              return `${m.label} (${farmShortLabel(m.farmKey)}/통신박스 ${m.moduleUid}): ${

                v === null ? "--" : v.toFixed(1)

              }`;

            })

            .join(" · ");



    return { label: String(slot), value, title };

  });

}


