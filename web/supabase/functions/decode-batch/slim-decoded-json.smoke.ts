/**
 * Smoke: slim decoded_json shape (mirrors Edge toSlimDecodedJson).
 * Run: node --experimental-strip-types supabase/functions/decode-batch/slim-decoded-json.smoke.ts
 * or: npx tsx supabase/functions/decode-batch/slim-decoded-json.smoke.ts
 */
import { toSlimDecodedJson, type DecodedV0cPayload } from "./wire-decode-v0c.ts";

const sample: DecodedV0cPayload = {
  schema_version: "v0c-1",
  wireVer: 12,
  packetMode: "live",
  history: false,
  controllerKey: "SP05:01:06",
  eqpmnNo: "06",
  stallTyCode: "SP05",
  stallNo: "01",
  mesureDt: "2026-08-05 17:00:00",
  runMode: 1,
  tempsC: ["24.5", "24.4", null, null],
  errorCodeRaw: 0x01ff,
  humidityPct: "57.8",
  alarmLowTempC: null,
  alarmHighTempC: null,
  channels: [
    {
      channel: "A",
      eqpmnCode: "EC02",
      outputs: { "1": "30", "2": "0" },
      thermo: {
        setpointTemp: "25.0",
        tempDeviation: "1.0",
        minVentPct: 10,
        maxVentPct: 100,
      },
    },
  ],
};

const slim = toSlimDecodedJson(sample);
const keys = Object.keys(slim).sort();
const forbidden = [
  "controllerKey",
  "eqpmnNo",
  "stallTyCode",
  "stallNo",
  "wireVer",
  "packetMode",
  "history",
  "mesureDt",
  "runMode",
  "humidityPct",
];

if (slim.schema_version !== "v0c-slim-1") throw new Error("schema");
if (!Array.isArray(slim.tempsC) || slim.tempsC.length !== 4) {
  throw new Error("tempsC");
}
if (!slim.channels?.[0]?.outputs?.["1"]) throw new Error("motor outputs");
for (const k of forbidden) {
  if (k in slim) throw new Error(`leaked ${k}`);
}
if (JSON.stringify(keys) !== JSON.stringify(["channels", "errorCodeRaw", "schema_version", "tempsC"])) {
  throw new Error(`keys ${keys.join(",")}`);
}

console.log("slim-decoded-json.smoke.ts: ok", JSON.stringify(slim).length, "bytes");
