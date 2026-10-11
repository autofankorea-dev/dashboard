/**
 * 채널별 fanBand — B는 A thermo로 폴백하지 않음.
 * Run: npx tsx scripts/assert-channel-fan-band.ts
 */
import { fanBand } from "../src/lib/farm/severity-score";
import { resolveReadingChannelThermo } from "../src/lib/farm/controller-summary-display";
import { channelFanTrendSeries } from "../src/lib/farm/trend-chart-series";
import type { BarnReading } from "../src/lib/data/iot";
import type { ControllerThermoSettings } from "../src/lib/controllers/controller-settings";
import type { FarmKey } from "../src/lib/domain/farm-key";

const farmKey: FarmKey = { lsindRegistNo: "FARM01", itemCode: "P00" };

const thermoA: ControllerThermoSettings = {
  setpointTemp: 24,
  tempDeviation: 6,
  minVentPct: 10,
  maxVentPct: 40,
  source: "live",
  updatedAt: "2026-01-01T00:00:00Z",
};
const thermoB: ControllerThermoSettings = {
  setpointTemp: 26,
  tempDeviation: 7,
  minVentPct: 20,
  maxVentPct: 80,
  source: "live",
  updatedAt: "2026-01-01T00:00:00Z",
};

const reading = {
  key: "FARM01:P00:1:SP03:01:01",
  farmKey,
  moduleUid: 1,
  controllerKey: "SP03:01:01",
  receivedAt: "2026-01-01T00:00:00Z",
  status: "online",
  channels: [
    {
      channel: "A",
      eqpmnCode: "EC01",
      fanPct: 50,
      thermo: {
        setpointTemp: "24",
        tempDeviation: "6",
        minVentPct: 10,
        maxVentPct: 40,
      },
    },
    {
      channel: "B",
      eqpmnCode: "EC02",
      fanPct: 30,
      thermo: {
        setpointTemp: "26",
        tempDeviation: "7",
        minVentPct: 20,
        maxVentPct: 80,
      },
    },
  ],
} as unknown as BarnReading;

const map: Record<string, ControllerThermoSettings> = {
  "FARM01/P00:1:SP03:01:01:A": thermoA,
  "FARM01/P00:1:SP03:01:01:B": thermoB,
};

const a = resolveReadingChannelThermo(reading, map, "A");
const b = resolveReadingChannelThermo(reading, map, "B");
const c = resolveReadingChannelThermo(reading, map, "C");

if (!a || fanBand(a)?.lo !== 10 || fanBand(a)?.hi !== 40) {
  throw new Error(`channel A band expected 10–40, got ${JSON.stringify(a)}`);
}
if (!b || fanBand(b)?.lo !== 20 || fanBand(b)?.hi !== 80) {
  throw new Error(`channel B band expected 20–80, got ${JSON.stringify(b)}`);
}
if (c != null) {
  throw new Error(`channel C must not fall back to A/B, got ${JSON.stringify(c)}`);
}

const series = channelFanTrendSeries(
  {
    temp: [],
    humidity: [],
    fanIntake: [15, 25, 35],
    fanExhaust: [50, 60, 70],
    fanSupply: [5, 5, 5],
  },
  { A: a, B: b, C: c },
);
if (series[0]?.band?.lo !== 10 || series[0]?.band?.hi !== 40) {
  throw new Error(`series A band mismatch: ${JSON.stringify(series[0]?.band)}`);
}
if (series[1]?.band?.lo !== 20 || series[1]?.band?.hi !== 80) {
  throw new Error(`series B band mismatch: ${JSON.stringify(series[1]?.band)}`);
}

console.log("assert-channel-fan-band: ok");
