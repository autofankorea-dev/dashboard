import { isValidFarmKey } from "@/lib/domain/barn-catalog";
import { farmKeyId, moduleKey } from "@/lib/domain/farm-key";
import { FIRMWARE_CTRL_COUNT } from "@/lib/domain/iot-firmware";
import type {
  BarnReading,
  BarnSummary,
  FarmOverview,
  ModuleReceipt,
} from "@/lib/domain/iot-types";

function avg(nums: (number | null)[]): number | null {
  const v = nums.filter((n): n is number => n !== null);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
}

export type ControllerCounts = {
  total: number;
  normal: number;
  caution: number;
  offline: number;
  connected: number;
  farmCount: number;
  moduleCount: number;
  expectedControllerCount: number;
};

export type ControllerEnvAvg = {
  avgTempC: number | null;
  avgHumidityPct: number | null;
  avgFanSupply: number | null;
  avgFanExhaust: number | null;
  avgFanIntake: number | null;
};

export type DashboardSummary = {
  counts: ControllerCounts;
  env: ControllerEnvAvg;
  receipts: ModuleReceipt[];
  latestReceivedAt: string | null;
};

/** LIVE readings 단일 집계 — farm/barn/alarm 페이지 공통 */
export function summarizeControllers(
  readings: BarnReading[],
  expectedControllerCount = FIRMWARE_CTRL_COUNT
): DashboardSummary {
  const valid = readings.filter((r) => isValidFarmKey(r.farmKey));

  const moduleMap = new Map<string, ModuleReceipt>();
  for (const r of valid) {
    const mk = moduleKey(r.farmKey, r.moduleUid);
    if (!moduleMap.has(mk)) {
      moduleMap.set(mk, {
        farmKey: r.farmKey,
        moduleUid: r.moduleUid,
        receivedAt: r.receivedAt,
        status: r.status,
      });
    }
  }

  const receipts = [...moduleMap.values()].sort(
    (a, b) => new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime()
  );

  const farmIds = new Set(valid.map((r) => farmKeyId(r.farmKey)));
  const latestReceivedAt = valid.reduce<string | null>((latest, r) => {
    if (!latest) return r.receivedAt;
    return new Date(r.receivedAt) > new Date(latest) ? r.receivedAt : latest;
  }, null);

  return {
    counts: {
      total: valid.length,
      normal: valid.filter((r) => r.status === "normal").length,
      caution: valid.filter((r) => r.status === "caution").length,
      offline: valid.filter((r) => r.status === "offline").length,
      connected: valid.filter((r) => r.status !== "offline").length,
      farmCount: farmIds.size,
      moduleCount: moduleMap.size,
      expectedControllerCount,
    },
    env: (() => {
      const online = valid.filter((r) => r.status !== "offline");
      return {
        avgTempC: avg(online.map((r) => r.tempC)),
        avgHumidityPct: avg(online.map((r) => r.humidityPct)),
        avgFanSupply: avg(online.map((r) => r.fanSupply)),
        avgFanExhaust: avg(online.map((r) => r.fanExhaust)),
        avgFanIntake: avg(online.map((r) => r.fanIntake)),
      };
    })(),
    receipts,
    latestReceivedAt,
  };
}

export function toFarmOverview(summary: DashboardSummary): FarmOverview {
  return {
    farmCount: summary.counts.farmCount,
    moduleCount: summary.counts.moduleCount,
    controllerCount: summary.counts.total,
    connectedCount: summary.counts.connected,
    expectedControllerCount: summary.counts.expectedControllerCount,
    offlineCount: summary.counts.offline,
    avgTempC: summary.env.avgTempC,
    avgHumidityPct: summary.env.avgHumidityPct,
    avgFanSupply: summary.env.avgFanSupply,
    avgFanExhaust: summary.env.avgFanExhaust,
    avgFanIntake: summary.env.avgFanIntake,
    receipts: summary.receipts,
  };
}

export function toBarnSummary(summary: DashboardSummary): BarnSummary {
  return {
    total: summary.counts.total,
    normal: summary.counts.normal,
    caution: summary.counts.caution,
    offline: summary.counts.offline,
  };
}
