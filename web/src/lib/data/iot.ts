import "server-only";

import { cache } from "react";
import { isValidFarmKey } from "@/lib/data/barn-catalog";
import {
  summarizeControllers,
  toBarnSummary,
  toFarmOverview,
} from "@/lib/data/dashboard-summary";
import type { BarnMeta } from "@/lib/data/barn-meta";
import { compareReadings } from "@/lib/data/reading-hierarchy";
import {
  farmKeyEq,
  stallCatalogKey,
  type FarmKey,
} from "@/lib/data/farm-key";
import {
  type ChannelReading,
} from "@/lib/data/iot-channel";
import {
  fetchLiveReadings,
  type LiveReadingsScope,
} from "@/lib/data/iot-live-fetch";

export type { StallCatalogEntry } from "@/lib/data/stall-catalog";
export type { LiveReadingsScope };
export { buildStallCatalog } from "@/lib/data/stall-catalog";

export type ControllerStatus = "normal" | "caution" | "offline";



export type PacketMode = "live" | "replay";



export type BarnReading = {

  key: string;

  farmKey: FarmKey;

  moduleUid: number;

  /** v0x0A business key SPxx:stallNo:eqpmnNo (legacy: legacy:idx:N) */
  controllerKey: string;

  /** @deprecated v0x09 legacy; v0x0A decoded rows omit idx */
  idx?: number;

  eqpmnNo: string;

  stallNo: string | null;

  stallTyCode: string | null;

  label: string;

  alarmLowTempC?: number | null;
  alarmHighTempC?: number | null;
  tempC: number | null;

  humidityPct: number | null;

  fanSupply: number | null; // EC01 송풍팬

  fanExhaust: number | null; // EC02 배기팬

  fanIntake: number | null; // EC03 입기팬

  fanSupplySeries: number[]; // EC01 추이

  fanExhaustSeries: number[]; // EC02 추이

  fanIntakeSeries: number[]; // EC03 추이

  mesureDt: string | null;

  receivedAt: string;

  status: ControllerStatus;

  packetMode: PacketMode;

  wireVer: number | null;

  decodedId?: number;

  thermo?: DecodedController["thermo"];

  /** v0x0B schema 2.0 — A/B/C channel readings */
  channels?: ChannelReading[];

  /** v0x0C — controller run mode */
  runMode?: number | null;

  /** v0x0C — row-level temperature probes (up to 4) */
  tempsC?: (number | null)[];

};



/** BarnReading 과 동일 구조 (컨트롤러 페이지에서 의미상 사용) */

export type ControllerReading = BarnReading;



export type BarnSummary = {

  total: number;

  normal: number;

  caution: number;

  offline: number;

};



type DecodedController = {

  controllerKey?: string;

  idx?: number;

  eqpmnNo?: string;

  stallNo?: unknown;

  stallTyCode?: unknown;

  ES01?: unknown;

  ES02?: unknown;

  EC01?: unknown;

  EC02?: unknown;

  EC03?: unknown;

  mesureDt?: string;

  channels?: import("@/lib/data/iot-channel").DecodedChannel[];

  thermo?: {
    setpointTemp?: string | number;
    tempDeviation?: string | number;
    minVentPct?: number;
    maxVentPct?: number;
  } | null;

};



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



/** 축사 페이지 차트·비교용. stallNo 있으면 축사별 평균, 없으면 컨트롤러 단위. */

export type BarnCompareRow = {

  key: string;

  label: string;

  tempC: number | null;

  humidityPct: number | null;

  fanSupply: number | null;

  fanExhaust: number | null;

  fanIntake: number | null;

  status: ControllerStatus;

};



export {

  buildControllerSlotSeries,

  LIVE_SLOT_COUNT,

  LEGACY_SLOT_COUNT,

  resolveSlotCount,

  type ControllerMetricKey,

  type ControllerSlotReading,

  type ChartSlotItem,

} from "@/lib/data/iot-chart";



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

export type ModuleReceipt = {

  farmKey: FarmKey;

  moduleUid: number;

  receivedAt: string;

  status: ControllerStatus;

};



export type FarmOverview = {

  farmCount: number;

  moduleCount: number;

  controllerCount: number;

  connectedCount: number;

  expectedControllerCount: number;

  offlineCount: number;

  avgTempC: number | null;

  avgHumidityPct: number | null;

  avgFanSupply: number | null;

  avgFanExhaust: number | null;

  avgFanIntake: number | null;

  receipts: ModuleReceipt[];

};



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



export type BarnMapSnapshot = {

  meta: BarnMeta;

  controllerCount: number;

  /** SP 그룹 내 고유 축사번호(stallNo) 수 */
  stallCount?: number;

  tempC: number | null;

  humidityPct: number | null;

  fanSupply: number | null;

  fanExhaust: number | null;

  fanIntake: number | null;

  status: ControllerStatus;

  receivedAt: string | null;

};



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


