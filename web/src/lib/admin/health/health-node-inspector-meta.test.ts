import assert from "node:assert/strict";
import { describe, it } from "vitest";
import {
  compactDrawerPoints,
  healthNodeActionPath,
  healthNodeShort,
  healthNodeTechRows,
} from "./health-node-inspector-meta";
import type { HealthPoint, HealthSnapshot } from "./types";

describe("healthNodeShort", () => {
  it("uses the same short words as the DAG tiles", () => {
    assert.equal(healthNodeShort("collector-mqtt"), "MQTT");
    assert.equal(healthNodeShort("collector-rs"), "수집");
    assert.equal(healthNodeShort("dashboard"), "화면");
    assert.equal(healthNodeShort("storage"), "DB");
  });
});

describe("healthNodeTechRows", () => {
  it("returns short Korean tech rows for MQTT", () => {
    const rows = healthNodeTechRows("collector-mqtt");
    assert.equal(rows[0]?.kind, "probe");
    assert.equal(rows[0]?.label, "브로커");
  });
});

describe("compactDrawerPoints", () => {
  it("shortens labels and hides tech filler", () => {
    const points: HealthPoint[] = [
      {
        id: "mod.uplink.activity",
        label: "모듈 uplink (worst)",
        value: "12 modules · worst critical",
        status: "critical",
      },
      {
        id: "mod.staleness.worst",
        label: "worst last seen",
        value: "45.2 min",
        status: "warn",
      },
      {
        id: "ctrl.identity",
        label: "D3 키 필드",
        value: "lsind·item·module·controller_key",
        status: "ok",
      },
    ];
    const rows = compactDrawerPoints(points);
    assert.equal(rows.length, 2);
    assert.equal(rows[0]?.label, "모듈");
    assert.equal(rows[0]?.value, "12 · 장애");
    assert.equal(rows[1]?.value, "45분");
  });

  it("collapses identical disabled points", () => {
    const points: HealthPoint[] = [
      {
        id: "ekape.snap.freshness",
        label: "snapshot job",
        value: "비활성화 (Ekape 미구현)",
        status: "not_implemented",
      },
      {
        id: "ekape.view.rows",
        label: "export View",
        value: "비활성화 (Ekape 미구현)",
        status: "not_implemented",
      },
    ];
    const rows = compactDrawerPoints(points);
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.value, "비활성화");
  });
});

describe("healthNodeActionPath", () => {
  it("ignores global hints when the node has none", () => {
    const snapshot = {
      impactScope: "R2",
      d11Hints: [{ id: "S1", title: "측정이 안 옴", summary: "" }],
      pipeline: [{ id: "dashboard", d11Hints: [] }],
      collectorSub: [],
    } as unknown as HealthSnapshot;
    assert.equal(healthNodeActionPath("dashboard", snapshot), null);
  });
});
