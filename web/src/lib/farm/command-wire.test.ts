import { test } from "vitest";
import assert from "node:assert/strict";
import {
  applyQueueCommandBinary,
  encodeCommandWireHex,
  formatCommandWireBytes,
} from "./command-wire";

{
  const hex = encodeCommandWireHex({
    action: "SET_CHANNEL_THERMO",
    stallTyCode: "SP01",
    stallNo: "01",
    eqpmnNo: "03",
    channel: "B",
    eqpmnCode: "EC02",
    setpointTemp: 24,
    tempDeviation: 10,
    minVentPct: 10,
    maxVentPct: 100,
  });
  assert.ok(hex);
  assert.equal(hex!.slice(0, 26), "0c010101030102f00064000a64");
  assert.equal(hex!.length, 30);
}

{
  assert.equal(
    formatCommandWireBytes("0c010101030102f00069000a640660"),
    "0C 01 01 01 03 01 02 F0 00 69 00 0A 64 06 60",
  );
}

{
  const hex = encodeCommandWireHex({
    action: "SET_CTRL_THERMO",
    stallTyCode: "SP01",
    stallNo: "01",
    eqpmnNo: "03",
    setpointTemp: 24,
    tempDeviation: 10,
    minVentPct: 10,
    maxVentPct: 100,
  });
  assert.ok(hex);
  assert.equal(hex!.slice(0, 14), "0c00010103ffff");
}

{
  assert.equal(
    applyQueueCommandBinary({
      stallTyCode: "SP01",
      stallNo: "01",
      eqpmnNo: "01",
      setpointTemp: 25,
      tempDeviation: 2,
      minVentPct: 10,
      maxVentPct: 80,
      wireHex: "0c010101030102f00069000a640660",
    }),
    "0C 01 01 01 03 01 02 F0 00 69 00 0A 64 06 60",
  );
}

test("module asserts", () => {
  // node:assert 호출은 이 파일을 불러올 때 이미 실행된다.
});
