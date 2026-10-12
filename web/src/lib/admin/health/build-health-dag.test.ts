import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { buildHealthDag } from "./build-health-dag";
import type { HealthSnapshot } from "./types";

const emptySnapshot = (): HealthSnapshot => ({
  fetchedAt: "",
  insertBuckets: [],
  liveRowCount: 0,
  liveRowLimit: 1,
  dbOk: true,
  modules: [],
  controllers: [],
  collectorGroups: [],
  activeAlerts: [],
  pipeline: [],
  collectorSub: [],
  statusCounts: {
    ok: 0,
    warn: 0,
    critical: 0,
    unknown: 0,
    not_implemented: 0,
  },
  d11Hints: [],
  impactScope: null,
  pointsByNode: {},
  commandFailures: [],
  commandCheckpointCount: 0,
  commandTimeline: [],
});

describe("buildHealthDag shorts", () => {
  it("uses icon-tile words, not long server titles", () => {
    const { nodes } = buildHealthDag(emptySnapshot());
    const shorts = Object.fromEntries(nodes.map((n) => [n.id, n.short]));
    assert.deepEqual(shorts, {
      field: "농장",
      mqtt: "MQTT",
      rs: "수집",
      decode: "Edge",
      db: "DB",
      ui: "화면",
      "c-cmd": "명령",
      "ext-link": "연계",
    });
    assert.equal(nodes.find((n) => n.id === "mqtt")?.label, "MQTT 브로커 서버");
    assert.equal(nodes.find((n) => n.id === "ui")?.label, "사용자 화면");
  });
});
