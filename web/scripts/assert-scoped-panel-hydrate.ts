/**
 * P1-2 — shouldSkipScopedPanelHydrate / freshness 스모크
 * 실행: npx tsx scripts/assert-scoped-panel-hydrate.ts
 */
import { DEFAULT_ALARM_SETTINGS } from "@/lib/domain/alarms";
import type { FarmKey } from "@/lib/domain/farm-key";
import type { BarnReading } from "@/lib/data/iot";
import type { ControllerGridData } from "@/lib/farm/controller-grid-data";
import type { FarmScopedPanelData } from "@/lib/farm/load-farm-scoped-panel-data";
import {
  scopedPanelFreshnessMs,
  shouldSkipScopedPanelHydrate,
  type FarmPanelSliceLike,
} from "@/lib/farm/farm-scoped-panel-utils";

const farmKey: FarmKey = { lsindRegistNo: "FARM01", itemCode: "P00" };

function reading(receivedAt: string): BarnReading {
  return {
    key: "r1",
    farmKey,
    moduleUid: 1,
    controllerKey: "SP02:01:01",
    stallTyCode: "SP02",
    stallNo: "01",
    eqpmnNo: "01",
    tempC: 24,
    humidityPct: 60,
    status: "online",
    receivedAt,
  } as unknown as BarnReading;
}

function controller(
  partial: Partial<ControllerGridData> & {
    thermoUpdatedAt?: string;
  },
): ControllerGridData {
  const thermoUpdatedAt = partial.thermoUpdatedAt ?? "2026-07-20T00:00:00.000Z";
  return {
    readings: partial.readings ?? [],
    thermoSettings: partial.thermoSettings ?? {
      "FARM01:P00:1:SP02:01:01": {
        setpointTemp: 24,
        tempDeviation: 6,
        minVentPct: 10,
        maxVentPct: 80,
        source: "live",
        updatedAt: thermoUpdatedAt,
      },
    },
    commands: partial.commands ?? [],
    canCommand: true,
    alarmSettings: partial.alarmSettings ?? DEFAULT_ALARM_SETTINGS,
  };
}

function slice(
  opts: {
    receivedAt: string;
    thermoUpdatedAt?: string;
    enriched?: boolean;
  },
): FarmPanelSliceLike {
  const enriched = opts.enriched !== false;
  return {
    readings: [reading(opts.receivedAt)],
    barnSnapshots: [],
    gridCols: 1,
    gridRows: 1,
    controller: enriched
      ? controller({ thermoUpdatedAt: opts.thermoUpdatedAt ?? opts.receivedAt })
      : {
          readings: [],
          thermoSettings: {},
          commands: [],
          canCommand: false,
        },
  };
}

function incomingFrom(s: FarmPanelSliceLike): FarmScopedPanelData {
  return {
    farmKey,
    readings: s.readings,
    barnSnapshots: s.barnSnapshots,
    gridCols: s.gridCols,
    gridRows: s.gridRows,
    trendByPeriod: {} as FarmScopedPanelData["trendByPeriod"],
    controller: s.controller!,
  };
}

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const older = slice({ receivedAt: "2026-07-20T01:00:00.000Z" });
const newer = slice({ receivedAt: "2026-07-20T02:00:00.000Z" });
const bare = slice({ receivedAt: "2026-07-20T03:00:00.000Z", enriched: false });

assert(
  scopedPanelFreshnessMs(newer) > scopedPanelFreshnessMs(older),
  "fresher reading must rank higher",
);

assert(
  shouldSkipScopedPanelHydrate(older, incomingFrom(newer)) === false,
  "newer incoming must apply",
);

assert(
  shouldSkipScopedPanelHydrate(newer, incomingFrom(older)) === true,
  "older incoming must skip",
);

assert(
  shouldSkipScopedPanelHydrate(newer, incomingFrom(newer)) === true,
  "equal freshness must skip",
);

assert(
  shouldSkipScopedPanelHydrate(bare, incomingFrom(newer)) === false,
  "unenriched prev must accept enriching incoming",
);

assert(
  shouldSkipScopedPanelHydrate(newer, incomingFrom(bare)) === true,
  "enriched prev must skip bare incoming",
);

console.log("assert-scoped-panel-hydrate: ok");
