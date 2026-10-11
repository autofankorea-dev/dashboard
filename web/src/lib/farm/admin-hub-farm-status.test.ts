import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { FarmKey } from "@/lib/domain/farm-key";
import type { FarmLocationRow } from "@/lib/domain/farm-location-shared";
import type { FarmSummaryRow } from "@/lib/domain/farm-summaries";
import {
  collectAdminHubFarmRows,
  filterAdminHubFarmRowsByTone,
  hubFarmMonitorMetrics,
  resolveAdminHubFarmTone,
  sanitizeHubHumidityPct,
  sanitizeHubTempC,
  summarizeAdminHubTones,
} from "./admin-hub-farm-status";

const farm = (n: string): FarmKey => ({
  lsindRegistNo: n,
  itemCode: "P00",
});

function summary(
  farmKey: FarmKey,
  patch: Partial<FarmSummaryRow> = {},
): FarmSummaryRow {
  return {
    farmKey,
    controllerCount: 3,
    offlineCount: 0,
    alarmCount: 0,
    criticalCount: 0,
    avgTempC: 25,
    avgHumidityPct: 55,
    latestReceivedAt: null,
    ...patch,
  };
}

describe("resolveAdminHubFarmTone", () => {
  it("alert wins over live", () => {
    assert.equal(
      resolveAdminHubFarmTone(summary(farm("FARM01"), { alarmCount: 1 })),
      "alert",
    );
  });

  it("all controllers offline", () => {
    assert.equal(
      resolveAdminHubFarmTone(
        summary(farm("FARM02"), { offlineCount: 2, controllerCount: 2 }),
      ),
      "offline",
    );
  });

  it("live when any controller is online", () => {
    assert.equal(
      resolveAdminHubFarmTone(
        summary(farm("FARM01"), { offlineCount: 1, controllerCount: 3 }),
      ),
      "live",
    );
  });

  it("location when no live summary", () => {
    assert.equal(resolveAdminHubFarmTone(null), "location");
    assert.equal(
      resolveAdminHubFarmTone(
        summary(farm("FARM09"), { controllerCount: 0, avgTempC: null }),
      ),
      "location",
    );
  });
});

describe("collectAdminHubFarmRows", () => {
  it("merges options, summaries, and locations", () => {
    const loc: FarmLocationRow = {
      farmKey: farm("FARM09"),
      farmName: "위치만",
      sido: "전라남도",
      sigungu: "나주시",
      addressDetail: null,
      addressText: "전라남도 나주시",
      lat: 35.0,
      lng: 126.7,
      geocodeSource: "region_lookup",
      updatedAt: "",
      updatedBy: null,
    };
    const rows = collectAdminHubFarmRows(
      [farm("FARM01")],
      [summary(farm("FARM01"))],
      [loc],
    );
    assert.equal(rows.length, 2);
    assert.equal(rows[0]?.tone, "live");
    assert.equal(rows[1]?.tone, "location");
    assert.deepEqual(summarizeAdminHubTones(rows), {
      live: 1,
      alert: 0,
      offline: 0,
      location: 1,
      total: 2,
    });
  });

  it("keeps assigned farms without live or coordinates", () => {
    const rows = collectAdminHubFarmRows([farm("FARM03")], [], []);
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.tone, "location");
    assert.equal(rows[0]?.location, null);
  });
});

describe("filterAdminHubFarmRowsByTone", () => {
  it("filters by tone and clears with null", () => {
    const rows = collectAdminHubFarmRows(
      [farm("FARM01"), farm("FARM02")],
      [
        summary(farm("FARM01")),
        summary(farm("FARM02"), { offlineCount: 3, controllerCount: 3 }),
      ],
      [],
    );
    assert.equal(filterAdminHubFarmRowsByTone(rows, "live").length, 1);
    assert.equal(filterAdminHubFarmRowsByTone(rows, "offline")[0]?.farmKey.lsindRegistNo, "FARM02");
    assert.equal(filterAdminHubFarmRowsByTone(rows, null).length, 2);
  });
});

describe("hubFarmMonitorMetrics", () => {
  it("hides out-of-range sensors", () => {
    const [row] = collectAdminHubFarmRows(
      [farm("FARM02")],
      [summary(farm("FARM02"), { avgTempC: 3269.3, avgHumidityPct: 101 })],
      [],
    );
    assert.ok(row);
    assert.deepEqual(hubFarmMonitorMetrics(row), {
      tempC: null,
      humidityPct: null,
      online: 3,
      controllerCount: 3,
    });
  });
});

describe("sanitizeHubTempC", () => {
  it("keeps barn-range temperatures", () => {
    assert.equal(sanitizeHubTempC(25.9), 25.9);
    assert.equal(sanitizeHubTempC(-10), -10);
    assert.equal(sanitizeHubTempC(60), 60);
  });

  it("hides scale errors and non-finite values", () => {
    assert.equal(sanitizeHubTempC(3269.3), null);
    assert.equal(sanitizeHubTempC(-40), null);
    assert.equal(sanitizeHubTempC(Number.NaN), null);
    assert.equal(sanitizeHubTempC(null), null);
  });
});

describe("sanitizeHubHumidityPct", () => {
  it("keeps 0-100 and drops the rest", () => {
    assert.equal(sanitizeHubHumidityPct(56.8), 56.8);
    assert.equal(sanitizeHubHumidityPct(0), 0);
    assert.equal(sanitizeHubHumidityPct(101), null);
  });
});
