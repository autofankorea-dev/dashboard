import { describe, expect, it } from "vitest";
import type { BarnReading } from "@/lib/domain/iot-types";
import { thermoSettingsKey } from "@/lib/controllers/controller-settings";
import { resolveReadingChannelThermo } from "./controller-summary-display";

const thermo = { setpointTemp: 24, tempDeviation: 2, minVentPct: 10, maxVentPct: 60 };
const reading = {
  farmKey: { lsindRegistNo: "TEST", itemCode: "P00" }, moduleUid: 1,
  controllerKey: "SP07:1:1", receivedAt: "2026-10-20T00:00:00Z", thermo,
} as BarnReading;
const rootKey = thermoSettingsKey(reading.farmKey, reading.moduleUid, reading.controllerKey);
const root = { ...thermo, source: "live" as const, updatedAt: reading.receivedAt };

describe("channel motor range ownership", () => {
  it("keeps legacy root settings on A instead of copying them into B and C", () => {
    expect(resolveReadingChannelThermo(reading, { [rootKey]: root }, "A")).toEqual(root);
    expect(resolveReadingChannelThermo(reading, { [rootKey]: root }, "B")).toBeNull();
    expect(resolveReadingChannelThermo(reading, {}, "C")).toBeNull();
  });
  it("uses B live settings even when a controller root setting exists", () => {
    const b = { ...thermo, minVentPct: 25, maxVentPct: 80 };
    const withB = { ...reading, channels: [{ channel: "B" as const, eqpmnCode: "EC02", tempC: null, humidityPct: null, fanPct: 50, fanSeries: [], thermo: b }] };
    expect(resolveReadingChannelThermo(withB, { [rootKey]: root }, "B")).toMatchObject(b);
    expect(resolveReadingChannelThermo(withB, { [rootKey]: root }, "C")).toBeNull();
    const command = { ...root, minVentPct: 30, maxVentPct: 90 };
    expect(resolveReadingChannelThermo(withB, { [rootKey]: root, [`${rootKey}:B`]: command }, "B")).toEqual(command);
  });
});
