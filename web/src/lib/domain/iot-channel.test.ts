import { test } from "vitest";
/**
 * 실행: npx vitest run src/lib/domain/iot-channel.test.ts
 */
import assert from "node:assert/strict";
import { mapDecodedChannels } from "./iot-channel";

{
  const rows = mapDecodedChannels([
    { channel: "A", eqpmnCode: "EC02", tempC: 24, humidityPct: 60, outputs: { "1": 40 } },
    { channel: "B", eqpmnCode: "EC02", tempC: 23, humidityPct: 58, outputs: { "1": 30 } },
    { channel: "C", eqpmnCode: "EC02", tempC: 22, humidityPct: 55, outputs: { "1": 20 } },
  ]);
  assert.deepEqual(
    rows.map((r) => [r.channel, r.eqpmnCode]),
    [
      ["A", "EC02"],
      ["B", "EC02"],
      ["C", "EC02"],
    ],
    "슬롯이 달라도 LIVE 장비코드를 그대로 둔다",
  );
}

{
  const rows = mapDecodedChannels([
    { channel: "A", tempC: 24, humidityPct: 60 },
    { channel: "B", eqpmnCode: "  ", tempC: 23 },
  ]);
  assert.equal(rows[0].eqpmnCode, "");
  assert.equal(rows[1].eqpmnCode, "");
}

console.log("iot-channel.test.ts ok");

test("module asserts", () => {
  // node:assert 호출은 이 파일을 불러올 때 이미 실행된다.
});
