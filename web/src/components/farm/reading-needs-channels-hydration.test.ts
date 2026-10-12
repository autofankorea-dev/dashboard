import { test } from "vitest";
import assert from "node:assert/strict";
import { readingNeedsChannelsHydration } from "@/components/farm/farm-map-bulk-apply-parts";
import type { BarnReading } from "@/lib/data/iot";

function base(over: Partial<BarnReading> = {}): BarnReading {
  return {
    key: "k",
    farmKey: { lsindRegistNo: "FARM01", itemCode: "P00" },
    moduleUid: 1,
    controllerKey: "SP01:01:EC01",
    eqpmnNo: "EC01",
    stallNo: "01",
    stallTyCode: "SP01",
    label: "t",
    tempC: 20,
    humidityPct: 50,
    fanSupply: null,
    fanExhaust: null,
    fanIntake: null,
    fanSupplySeries: [],
    fanExhaustSeries: [],
    fanIntakeSeries: [],
    mesureDt: null,
    receivedAt: new Date().toISOString(),
    status: "normal",
    packetMode: "live",
    wireVer: 0x0a,
    runMode: null,
    ...over,
  };
}

assert.equal(readingNeedsChannelsHydration(base()), true);
assert.equal(
  readingNeedsChannelsHydration(
    base({ channels: [{ channel: "A", eqpmnCode: "EC01", tempC: 1, humidityPct: null, fanPct: null, fanSeries: [], thermo: null }] }),
  ),
  false,
);
assert.equal(
  readingNeedsChannelsHydration(
    base({ controllerKey: "legacy:idx:0", wireVer: 9, channels: undefined }),
  ),
  false,
);

console.log("reading-needs-channels-hydration.test.ts: ok");

test("module asserts", () => {
  // node:assert 호출은 이 파일을 불러올 때 이미 실행된다.
});
