/**
 * 실행: npx tsx src/lib/controllers/controller-panel-draft.test.ts
 */
import assert from "node:assert/strict";
import {
  buildChannelGlanceRows,
  collectDirtyChannelSaves,
  formatChannelGlanceCells,
  isChannelDraftDirty,
  mergeDirtyChannelSaves,
  type PanelChannelContext,
  type PanelDraft,
} from "./controller-panel-draft";

const draftA: PanelDraft = {
  setpointTemp: 24,
  tempDeviation: 3,
  minVentPct: 20,
  maxVentPct: 70,
};
const draftB: PanelDraft = {
  setpointTemp: 2,
  tempDeviation: 3,
  minVentPct: 20,
  maxVentPct: 70,
};
const draftC: PanelDraft = {
  setpointTemp: 1,
  tempDeviation: 3,
  minVentPct: 20,
  maxVentPct: 70,
};
const liveA = { ...draftA, setpointTemp: 23 };
const liveB = { ...draftB, setpointTemp: 1 };
const liveC = { ...draftC, setpointTemp: 0 };

const channels: PanelChannelContext[] = [
  {
    slot: "A",
    eqpmnCode: "EC03",
    knownSettings: { ...liveA, source: "live", updatedAt: "t" },
    liveBaseline: liveA,
  },
  {
    slot: "B",
    eqpmnCode: "EC02",
    knownSettings: null,
    liveBaseline: liveB,
  },
  {
    slot: "C",
    eqpmnCode: "EC01",
    knownSettings: null,
    liveBaseline: liveC,
  },
];

assert.equal(isChannelDraftDirty(null, liveA), false);
assert.equal(isChannelDraftDirty(draftA, liveA), true);
assert.equal(isChannelDraftDirty(draftA, draftA), false);

{
  const dirty = collectDirtyChannelSaves(
    channels,
    { A: draftA, B: draftB, C: draftC },
    {},
  );
  assert.deepEqual(
    dirty.map((d) => d.slot),
    ["A", "B", "C"],
  );
  assert.equal(dirty[1].values.setpointTemp, 2);
  assert.equal(dirty[2].values.setpointTemp, 1);
}

{
  const onlyA = collectDirtyChannelSaves(
    channels,
    { A: draftA, B: liveB, C: liveC },
    {},
  );
  assert.deepEqual(
    onlyA.map((d) => d.slot),
    ["A"],
  );
}

{
  const none = collectDirtyChannelSaves(
    channels,
    { A: liveA, B: liveB, C: liveC },
    {},
  );
  assert.equal(none.length, 0);
}

{
  const controllerFallbackA = {
    ...draftA,
    source: "live" as const,
    updatedAt: "t",
  };
  const withFallback: PanelChannelContext[] = [
    { ...channels[0], knownSettings: controllerFallbackA },
    {
      ...channels[1],
      knownSettings: controllerFallbackA,
      liveBaseline: liveB,
    },
  ];
  const dirty = collectDirtyChannelSaves(
    withFallback,
    { A: draftA, B: draftB },
    {},
  );
  assert.deepEqual(
    dirty.map((d) => d.slot),
    ["A", "B"],
    "B는 컨트롤러(A) 설정이 있어도 LIVE와 다르면 포함",
  );
}

{
  const snapshot = collectDirtyChannelSaves(
    channels,
    { A: draftA, B: liveB, C: liveC },
    {},
  );
  const latest = collectDirtyChannelSaves(
    channels,
    { A: draftA, B: draftB, C: draftC },
    {},
  );
  const merged = mergeDirtyChannelSaves(snapshot, latest);
  assert.deepEqual(
    merged.map((d) => d.slot),
    ["A", "B", "C"],
    "적용 클릭 때 A만 잡혀도, 보내기 전 B·C 커밋을 합친다",
  );
  assert.equal(merged[1].values.setpointTemp, 2);
}

{
  const snapshot = collectDirtyChannelSaves(
    channels,
    { A: draftA, B: draftB, C: draftC },
    {},
  );
  const latest = collectDirtyChannelSaves(
    channels,
    { A: draftA, B: liveB, C: liveC },
    {},
  );
  const merged = mergeDirtyChannelSaves(snapshot, latest);
  assert.deepEqual(
    merged.map((d) => d.slot),
    ["A", "B", "C"],
    "LIVE 동기화가 B·C 초안을 되돌려도 확인 스냅샷은 유지",
  );
  assert.equal(merged[1].values.setpointTemp, 2);
  assert.equal(merged[2].values.setpointTemp, 1);
}

{
  const sameCode: PanelChannelContext[] = channels.map((ctx) => ({
    ...ctx,
    eqpmnCode: "EC02",
  }));
  const dirty = collectDirtyChannelSaves(
    sameCode,
    { A: draftA, B: draftB, C: draftC },
    {},
  );
  assert.deepEqual(
    dirty.map((d) => d.eqpmnCode),
    ["EC02", "EC02", "EC02"],
    "다른 슬롯이 같은 장비코드를 써도 슬롯별로 명령을 모은다",
  );
}

{
  const rows = buildChannelGlanceRows(
    [channels[0], channels[1]],
    { A: draftA },
    {},
  );
  assert.equal(rows.length, 3);
  assert.equal(rows[0].present, true);
  assert.equal(rows[0].dirty, true);
  assert.equal(rows[0].values?.setpointTemp, 24);
  assert.equal(rows[1].present, true);
  assert.equal(rows[1].dirty, false);
  assert.equal(rows[1].values?.setpointTemp, 1);
  assert.equal(rows[2].present, false);
  assert.equal(rows[2].values, null);
  assert.deepEqual(formatChannelGlanceCells(draftA), {
    setpoint: "24.0",
    deviation: "+3.0",
    vent: "20–70",
  });
}

console.log("controller-panel-draft.test.ts ok");
