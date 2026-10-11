import { coerceTrendRpcJson } from "@/lib/domain/farm-trend-rpc-json";

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

assert(coerceTrendRpcJson<number>([1, 2]).length === 2, "array passthrough");
assert(
  coerceTrendRpcJson<{ n: number }>(JSON.stringify([{ n: 1 }]))[0]?.n === 1,
  "json string",
);
assert(coerceTrendRpcJson("not-json").length === 0, "invalid json");
assert(coerceTrendRpcJson(null).length === 0, "null");
assert(coerceTrendRpcJson({}).length === 0, "object");

console.log("farm-trend-rpc-json.test.ts: ok");
