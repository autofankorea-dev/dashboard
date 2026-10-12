import assert from "node:assert/strict";
import { describe, it } from "vitest";
import {
  collectorNodeHint,
  instanceFreshness,
  instanceResourceStatus,
  mapInstanceStatus,
  summarizeInstanceHealth,
  type InstanceHealthRow,
} from "./instance-health-map";

const NOW = Date.parse("2026-08-31T00:00:00.000Z");

function makeRow(overrides: Partial<InstanceHealthRow> = {}): InstanceHealthRow {
  return {
    instance_id: "i-collector-1",
    checked_at: new Date(NOW - 30_000).toISOString(),
    overall: "ok",
    mqtt_status: "ok",
    rs_status: "ok",
    c_status: "ok",
    mqtt_listen: true,
    mqtt_roundtrip: true,
    rs_active: true,
    c_active: true,
    disk_used_percent: 40,
    mem_available_mb: 1024,
    raw_last_received_at: new Date(NOW - 60_000).toISOString(),
    raw_last_age_sec: 60,
    command_last_sent_at: new Date(NOW - 120_000).toISOString(),
    command_last_age_sec: 120,
    note: null,
    payload: {},
    created_at: new Date(NOW).toISOString(),
    updated_at: new Date(NOW).toISOString(),
    ...overrides,
  };
}

describe("mapInstanceStatus", () => {
  it("maps ok/warn/fail and unknown fallback", () => {
    assert.equal(mapInstanceStatus("ok"), "ok");
    assert.equal(mapInstanceStatus("warn"), "warn");
    assert.equal(mapInstanceStatus("fail"), "critical");
    assert.equal(mapInstanceStatus("weird"), "unknown");
    assert.equal(mapInstanceStatus(null), "unknown");
  });
});

describe("instanceFreshness", () => {
  it("classifies fresh / warn / stale by age", () => {
    assert.equal(instanceFreshness(new Date(NOW - 30_000).toISOString(), NOW).level, "fresh");
    assert.equal(instanceFreshness(new Date(NOW - 900_000).toISOString(), NOW).level, "warn");
    assert.equal(instanceFreshness(new Date(NOW - 3_600_000).toISOString(), NOW).level, "stale");
    assert.deepEqual(instanceFreshness(null, NOW), { ageSec: null, level: "stale" });
  });
});

describe("instanceResourceStatus", () => {
  it("warns on low memory or high disk", () => {
    assert.equal(instanceResourceStatus(makeRow()), "ok");
    assert.equal(instanceResourceStatus(makeRow({ mem_available_mb: 71 })), "warn");
    assert.equal(instanceResourceStatus(makeRow({ disk_used_percent: 92 })), "warn");
  });
});

describe("summarizeInstanceHealth", () => {
  it("returns empty summary for null row", () => {
    const s = summarizeInstanceHealth(null, NOW);
    assert.equal(s.row, null);
    assert.equal(s.trustPerService, false);
    assert.equal(s.mqttStatus, "unknown");
  });

  it("trusts per-service when fresh and folds resource warn into rs node", () => {
    const s = summarizeInstanceHealth(
      makeRow({ overall: "warn", mem_available_mb: 71, note: "SOFT: RS log stale" }),
      NOW,
    );
    assert.equal(s.trustPerService, true);
    assert.equal(s.mqttStatus, "ok");
    assert.equal(s.cStatus, "ok");
    // rs_status ok + mem 71MB → rs 노드는 warn으로 승격
    assert.equal(s.rsStatus, "warn");
    assert.equal(s.overall, "warn");
    const mem = s.points.rs.find((p) => p.id === "host.mem");
    assert.equal(mem?.status, "warn");
    assert.ok(s.points.rs.some((p) => p.id === "rs.note"));
  });

  it("does not trust per-service when updater is stale", () => {
    const s = summarizeInstanceHealth(
      makeRow({ checked_at: new Date(NOW - 3_600_000).toISOString() }),
      NOW,
    );
    assert.equal(s.freshness, "stale");
    assert.equal(s.trustPerService, false);
  });

  it("marks critical when systemd inactive", () => {
    const s = summarizeInstanceHealth(makeRow({ rs_status: "fail", rs_active: false }), NOW);
    assert.equal(s.rsStatus, "critical");
    const systemd = s.points.rs.find((p) => p.id === "rs.systemd");
    assert.equal(systemd?.status, "critical");
  });
});

describe("collectorNodeHint", () => {
  it("fallback: uses data-flow bad flag when instance is not trusted", () => {
    assert.deepEqual(collectorNodeHint(false, "ok", true, "S1"), ["S1"]);
    assert.deepEqual(collectorNodeHint(false, "critical", false, "S1"), []);
  });

  it("trusted MQTT/RS: only critical raises S1 (resource warn stays quiet)", () => {
    // 서버 정상 + 장비 두절: 데이터흐름은 나쁘지만(fallbackBad=true) 노드는 ok → 힌트 없음
    assert.deepEqual(collectorNodeHint(true, "ok", true, "S1"), []);
    // 자원 warn으로 승격된 노드도 S1(수신 점검)로 오안내하지 않음
    assert.deepEqual(collectorNodeHint(true, "warn", true, "S1"), []);
    // 서버가 실제 장애면 S1
    assert.deepEqual(collectorNodeHint(true, "critical", false, "S1"), ["S1"]);
  });

  it("trusted command node: warn also raises S4", () => {
    assert.deepEqual(collectorNodeHint(true, "warn", false, "S4", { warnCounts: true }), ["S4"]);
    assert.deepEqual(collectorNodeHint(true, "ok", true, "S4", { warnCounts: true }), []);
    assert.deepEqual(collectorNodeHint(true, "unknown", true, "S4", { warnCounts: true }), []);
  });
});
