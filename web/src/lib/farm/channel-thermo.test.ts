import { test } from "vitest";
import assert from "node:assert/strict";
import {
  absFanWindows,
  buildDecodedSettingHoldSegments,
  emptyChannelThermo,
  holdForwardThermo,
  thermoChangeMarks,
} from "./channel-thermo";

{
  const a = emptyChannelThermo(3);
  a.setpoint[1] = 24;
  a.deviation[1] = 5;
  a.minVent[1] = 10;
  a.maxVent[1] = 90;
  const held = holdForwardThermo(a);
  assert.equal(held.setpoint[0], null);
  assert.equal(held.setpoint[1], 24);
  assert.equal(held.setpoint[2], 24);
  assert.equal(held.maxVent[2], 90);
}

{
  const a = emptyChannelThermo(1);
  const b = emptyChannelThermo(1);
  const c = emptyChannelThermo(1);
  a.setpoint[0] = 24;
  a.deviation[0] = 5;
  a.minVent[0] = 10;
  a.maxVent[0] = 90;
  b.setpoint[0] = 2;
  b.deviation[0] = 4;
  b.minVent[0] = 20;
  b.maxVent[0] = 80;
  c.setpoint[0] = 3;
  c.deviation[0] = 3;
  c.minVent[0] = 30;
  c.maxVent[0] = 70;
  const w = absFanWindows(a, b, c);
  assert.equal(w.a.loC[0], 24);
  assert.equal(w.a.hiC[0], 29);
  assert.equal(w.b.loC[0], 26);
  assert.equal(w.b.hiC[0], 30);
  assert.equal(w.c.loC[0], 27);
  assert.equal(w.c.hiC[0], 30);
}

{
  const a = emptyChannelThermo(4);
  const b = emptyChannelThermo(4);
  const c = emptyChannelThermo(4);
  for (let i = 0; i < 4; i++) {
    a.setpoint[i] = i >= 2 ? 25 : 24;
    a.deviation[i] = 5;
    a.minVent[i] = 10;
    a.maxVent[i] = 90;
    b.setpoint[i] = 2;
    b.deviation[i] = 4;
    b.minVent[i] = 20;
    b.maxVent[i] = 80;
    c.setpoint[i] = 3;
    c.deviation[i] = 3;
    c.minVent[i] = 30;
    c.maxVent[i] = 70;
  }
  const w = absFanWindows(a, b, c);
  const marks = thermoChangeMarks(w);
  assert.equal(marks.length, 1);
  assert.equal(marks[0]!.index, 2);
  assert.equal(marks[0]!.channels.length, 1);
  assert.equal(marks[0]!.channels[0]!.channel, "A");
  assert.equal(marks[0]!.channels[0]!.tempChanged, true);
  assert.equal(marks[0]!.channels[0]!.motorChanged, false);
}

{
  const a = emptyChannelThermo(4);
  const b = emptyChannelThermo(4);
  const c = emptyChannelThermo(4);
  for (let i = 0; i < 4; i++) {
    a.setpoint[i] = i >= 2 ? 25 : 24;
    a.deviation[i] = 5;
    a.minVent[i] = 10;
    a.maxVent[i] = 90;
    b.setpoint[i] = 2;
    b.deviation[i] = 4;
    b.minVent[i] = 20;
    b.maxVent[i] = 80;
    c.setpoint[i] = 3;
    c.deviation[i] = 3;
    c.minVent[i] = 30;
    c.maxVent[i] = 70;
  }
  const w = absFanWindows(a, b, c);
  const times = [1000, 2000, 3000, 4000];
  const segs = buildDecodedSettingHoldSegments(w, times, 5000);
  const aSegs = segs.filter((s) => s.channel === "A");
  const bSegs = segs.filter((s) => s.channel === "B");
  const cSegs = segs.filter((s) => s.channel === "C");
  assert.equal(aSegs.length, 2);
  assert.equal(aSegs[0]!.tempLo, 24);
  assert.equal(aSegs[0]!.x0Ms, 1000);
  assert.equal(aSegs[0]!.x1Ms, 3000);
  assert.equal(aSegs[1]!.tempLo, 25);
  assert.equal(aSegs[1]!.x0Ms, 3000);
  assert.equal(bSegs.length, 2);
  assert.equal(bSegs[0]!.tempLo, 26);
  assert.equal(bSegs[1]!.tempLo, 27);
  assert.equal(cSegs.length, 2);
  assert.equal(cSegs[0]!.tempLo, 27);
  assert.equal(cSegs[1]!.x1Ms, 5000);
}

console.log("channel-thermo.test.ts ok");

test("module asserts", () => {
  // node:assert 호출은 이 파일을 불러올 때 이미 실행된다.
});
