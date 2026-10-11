import "server-only";

import { cache } from "react";
import { isValidFarmKey } from "@/lib/domain/barn-catalog";
import {
  summarizeControllers,
  toBarnSummary,
  toFarmOverview,
} from "@/lib/domain/dashboard-summary";
import type { BarnMeta } from "@/lib/domain/barn-meta-types";
import { compareReadings } from "@/lib/domain/reading-hierarchy";
import { farmKeyEq, stallCatalogKey } from "@/lib/domain/farm-key";
import type {
  BarnCompareRow,
  BarnMapSnapshot,
  BarnReading,
  BarnSummary,
  ControllerStatus,
  FarmOverview,
} from "@/lib/domain/iot-types";
import {
  fetchLiveReadings,
  type LiveReadingsScope,
} from "@/lib/data/iot-live-fetch";

export type { StallCatalogEntry } from "@/lib/domain/stall-catalog";
export type { LiveReadingsScope };
export { buildStallCatalog } from "@/lib/domain/stall-catalog";
/** 타입 정본은 `@/lib/domain/iot-types` — 기존 import 경로 호환용 재export */
export type {
  BarnCompareRow,
  BarnMapSnapshot,
  BarnReading,
  BarnSummary,
  ControllerReading,
  ControllerStatus,
  DecodedController,
  FarmOverview,
  ModuleReceipt,
  PacketMode,
} from "@/lib/domain/iot-types";

/**
 * 모듈별 최신 LIVE snapshot(chunk 병합)을 펼쳐 컨트롤러(idx) 단위 반환.
 * REPLAY 수신 직후에도 LIVE UI가 깨지지 않도록 mode=live 만 채택.
 */

/** 요청당 1회 조회 — 동일 RSC 트리 내 페이지·설정 공유 */
export const getLiveReadings = cache(
  async (scope: LiveReadingsScope = {}): Promise<BarnReading[]> => {
    const readings = await fetchLiveReadings(scope);
    return readings.filter((r) => isValidFarmKey(r.farmKey));
  },
);

export function summarizeBarns(readings: BarnReading[]): BarnSummary {
  return toBarnSummary(summarizeControllers(readings));
}

export {

  buildControllerSlotSeries,

  LIVE_SLOT_COUNT,

  LEGACY_SLOT_COUNT,

  resolveSlotCount,

  type ControllerMetricKey,

  type ControllerSlotReading,

  type ChartSlotItem,

} from "@/lib/domain/iot-chart";

export function buildBarnCompareRows(readings: BarnReading[]): BarnCompareRow[] {

  const groups = new Map<string, BarnReading[]>();

  for (const r of readings) {

    const gk = r.stallNo

      ? stallCatalogKey(r.farmKey, r.moduleUid, r.stallNo)

      : r.key;

    const list = groups.get(gk) ?? [];

    list.push(r);

    groups.set(gk, list);

  }

  const entries = [...groups.entries()].sort(([, a], [, b]) =>
    compareReadings(a[0], b[0])
  );

  return entries.map(([key, matched]) => {
    const head = matched[0];
    return {
      key,
      label: head.stallNo ? `축사 ${head.stallNo}` : head.label,
      tempC: avg(matched.map((m) => m.tempC)),
      humidityPct: avg(matched.map((m) => m.humidityPct)),
      fanSupply: avg(matched.map((m) => m.fanSupply)),
      fanExhaust: avg(matched.map((m) => m.fanExhaust)),
      fanIntake: avg(matched.map((m) => m.fanIntake)),
      status: worstStatus(matched.map((m) => m.status)),
    };
  });

}

function avg(nums: (number | null)[]): number | null {

  const v = nums.filter((n): n is number => n !== null);

  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;

}

const STATUS_RANK: Record<ControllerStatus, number> = {

  normal: 0,

  caution: 1,

  offline: 2,

};

function worstStatus(statuses: ControllerStatus[]): ControllerStatus {

  if (statuses.length === 0) return "offline";

  return statuses.reduce((w, s) =>

    STATUS_RANK[s] > STATUS_RANK[w] ? s : w

  );

}

/** stallNo 기준 집계. 축사 1개에 컨트롤러 여러 대 (통신박스 idx별 동일 stall_no). */

export function aggregateByBarn(

  readings: BarnReading[],

  barnMetas: BarnMeta[]

): BarnMapSnapshot[] {

  return barnMetas.map((meta) => {

    const matched = readings.filter(

      (r) =>

        farmKeyEq(r.farmKey, meta.farmKey) &&

        r.moduleUid === meta.moduleUid &&

        r.stallNo === meta.stallNo

    );

    const latestReceived = matched.reduce<string | null>((latest, r) => {

      if (!latest) return r.receivedAt;

      return new Date(r.receivedAt) > new Date(latest) ? r.receivedAt : latest;

    }, null);

    return {

      meta,

      controllerCount: matched.length,

      tempC: avg(matched.map((r) => r.tempC)),

      humidityPct: avg(matched.map((r) => r.humidityPct)),

      fanSupply: avg(matched.map((r) => r.fanSupply)),

      fanExhaust: avg(matched.map((r) => r.fanExhaust)),

      fanIntake: avg(matched.map((r) => r.fanIntake)),

      status: worstStatus(matched.map((r) => r.status)),

      receivedAt: latestReceived,

    };

  });

}

export function summarizeFarm(
  readings: BarnReading[],
  expectedControllerCount = 48
): FarmOverview {
  return toFarmOverview(
    summarizeControllers(readings, expectedControllerCount)
  );
}

