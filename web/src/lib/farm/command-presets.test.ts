/**
 * 실행: npx tsx src/lib/farm/command-presets.test.ts
 */
import assert from "node:assert/strict";
import {
  COMMAND_PRESET_MAX,
  PRESET_STEPPER_HOLD_DELAY_MS,
  PRESET_STEPPER_HOLD_INTERVAL_MS,
  applyPresetCreateField,
  clampPresetCreateDraft,
  clampPresetVent,
  parseCommandPresetList,
  removeCommandPreset,
  snapshotCommandPresetChannels,
  upsertCommandPreset,
  type CommandPreset,
} from "./command-presets";
import type { ChannelGlanceRow, PanelDraft } from "@/lib/controllers/controller-panel-draft";

const draft = (set: number): PanelDraft => ({
  setpointTemp: set,
  tempDeviation: 2,
  minVentPct: 25,
  maxVentPct: 30,
});

const sample: CommandPreset[] = [
  { id: "day", name: "주간", channels: { A: draft(19), B: draft(4) } },
];

{
  const parsed = parseCommandPresetList({
    v: 1,
    items: [
      { id: "x", name: "  야간  ", channels: { A: draft(17) } },
      { id: "skip", name: "", channels: { A: draft(1) } },
      { name: "빈채널", channels: {} },
      { id: "x", name: "중복id", channels: { A: draft(1) } },
    ],
  });
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].name, "야간");
  assert.equal(parsed[0].channels.A?.setpointTemp, 17);
}

{
  const rows: ChannelGlanceRow[] = [
    { slot: "A", present: true, values: draft(18.5), dirty: false },
    { slot: "B", present: false, values: null, dirty: false },
    { slot: "C", present: true, values: draft(5), dirty: true },
  ];
  const snap = snapshotCommandPresetChannels(rows);
  assert.equal(snap.A?.setpointTemp, 18.5);
  assert.equal(snap.B, undefined);
  assert.equal(snap.C?.setpointTemp, 5);
}

{
  const emptyRows: ChannelGlanceRow[] = [
    { slot: "A", present: false, values: null, dirty: false },
  ];
  const snap = snapshotCommandPresetChannels(emptyRows, draft(21));
  assert.equal(snap.A?.setpointTemp, 21);
}

{
  const added = upsertCommandPreset(sample, {
    name: "한파",
    channels: { A: draft(20.5) },
  });
  assert.equal(added.ok, true);
  if (added.ok) {
    assert.equal(added.items.length, 2);
    assert.equal(added.items[1].name, "한파");
  }
}

{
  const replaced = upsertCommandPreset(sample, {
    name: "주간",
    channels: { A: draft(22) },
  });
  assert.equal(replaced.ok, true);
  if (replaced.ok) {
    assert.equal(replaced.items.length, 1);
    assert.equal(replaced.id, "day");
    assert.equal(replaced.items[0].channels.A?.setpointTemp, 22);
  }
}

{
  const rejected = upsertCommandPreset(sample, { name: "   ", channels: { A: draft(1) } });
  assert.equal(rejected.ok, false);
  if (!rejected.ok) assert.equal(rejected.reason, "empty-name");
}

{
  const full: CommandPreset[] = Array.from({ length: COMMAND_PRESET_MAX }, (_, i) => ({
    id: `p${i}`,
    name: `이${i}`,
    channels: { A: draft(i) },
  }));
  const blocked = upsertCommandPreset(full, { name: "새이름", channels: { A: draft(1) } });
  assert.equal(blocked.ok, false);
  if (!blocked.ok) assert.equal(blocked.reason, "full");
  const overwrite = upsertCommandPreset(full, { name: "이0", channels: { A: draft(9) } });
  assert.equal(overwrite.ok, true);
}

{
  const next = removeCommandPreset(sample, "day");
  assert.equal(next.length, 0);
}

{
  assert.equal(clampPresetVent(26), 25);
  assert.equal(clampPresetVent(33), 35);
  assert.equal(clampPresetVent(100), 100);
  const seeded = clampPresetCreateDraft({
    setpointTemp: 18.54,
    tempDeviation: 0.4,
    minVentPct: 26,
    maxVentPct: 31,
  });
  assert.equal(seeded.setpointTemp, 18.5);
  assert.equal(seeded.tempDeviation, 0.5);
  assert.equal(seeded.minVentPct, 25);
  assert.equal(seeded.maxVentPct, 30);
  const swapped = clampPresetCreateDraft({
    ...draft(18),
    minVentPct: 80,
    maxVentPct: 20,
  });
  assert.equal(swapped.minVentPct, 20);
  assert.equal(swapped.maxVentPct, 80);
}

{
  const raised = applyPresetCreateField(
    draft(18),
    "minVentPct",
    40,
  );
  assert.equal(raised.minVentPct, 40);
  assert.equal(raised.maxVentPct, 40);
  const lowered = applyPresetCreateField(
    { ...draft(18), minVentPct: 25, maxVentPct: 85 },
    "maxVentPct",
    20,
  );
  assert.equal(lowered.maxVentPct, 20);
  assert.equal(lowered.minVentPct, 20);
}

{
  assert.equal(PRESET_STEPPER_HOLD_DELAY_MS, 360);
  assert.equal(PRESET_STEPPER_HOLD_INTERVAL_MS, 120);
}

console.log("command-presets.test.ts ok");
