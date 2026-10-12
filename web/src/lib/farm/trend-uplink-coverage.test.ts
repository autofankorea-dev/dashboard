import { test } from "vitest";
import assert from "node:assert/strict";
import {
  buildUplinkCoverageIndex,
  classifyUplinkSlot,
  collapseUplinkBands,
  holdValuesAcrossSparse,
  mergeUplinkKinds,
  pickUplinkCoverageIndex,
  slotFromBucketAt,
} from "./trend-uplink-coverage";

{
  assert.equal(
    classifyUplinkSlot({ hasSample: true, validLive: true, anyRaw: true }),
    "sample",
    "sample wins",
  );
  assert.equal(
    classifyUplinkSlot({ hasSample: false, validLive: true, anyRaw: true }),
    "sparse",
    "valid live without decoded = 희소",
  );
  assert.equal(
    classifyUplinkSlot({ hasSample: false, validLive: false, anyRaw: true }),
    "void",
    "raw but not live = 없음",
  );
  assert.equal(
    classifyUplinkSlot({ hasSample: false, validLive: false, anyRaw: false }),
    "offline",
    "no raw = 통신두절",
  );
}

{
  const kinds = [
    "sample",
    "sparse",
    "sparse",
    "offline",
    "sparse",
    "void",
    "sample",
  ] as const;
  const temp = [33.2, null, null, null, null, null, 34.0];
  const held = holdValuesAcrossSparse([...temp], [...kinds]);
  assert.equal(held[1], 33.2, "희소 holds last");
  assert.equal(held[2], 33.2, "희소 continues");
  assert.equal(held[3], null, "통신두절 does not hold");
  assert.equal(held[4], null, "희소 after 통신두절 does not resume");
  assert.equal(held[5], null, "없음 does not hold");
  assert.equal(held[6], 34.0, "next sample");
}

{
  const hum = [null, null, null];
  const kinds = ["sample", "sparse", "sparse"] as const;
  const held = holdValuesAcrossSparse([...hum], [...kinds]);
  assert.deepEqual(held, [null, null, null], "never-valid stays 없음");
}

{
  assert.equal(mergeUplinkKinds(["offline", "sparse"]), "sparse");
  assert.equal(mergeUplinkKinds(["void", "offline"]), "void");
  assert.equal(mergeUplinkKinds(["sample", "offline"]), "sample");
  assert.equal(mergeUplinkKinds(["offline", "offline"]), "offline");
}

{
  const fromMs = Date.parse("2026-08-28T00:00:00.000Z");
  const stride = 15 * 60 * 1000;
  const idx = buildUplinkCoverageIndex(
    [
      {
        bucket_at: "2026-08-28T00:15:00.000Z",
        controller_key: "SP07:01:01",
        valid_live: true,
        any_raw: true,
      },
      {
        bucket_at: "2026-08-28T00:30:00.000Z",
        controller_key: "SP07:01:01",
        valid_live: 0,
        any_raw: 1,
      },
    ],
    fromMs,
    4,
    stride,
  );
  const flags = idx.byController.get("SP07:01:01");
  assert.ok(flags);
  assert.equal(flags[1]?.validLive, true);
  assert.equal(flags[2]?.anyRaw, true);
  assert.equal(flags[2]?.validLive, false);
  assert.equal(
    slotFromBucketAt("2026-08-28T00:45:00.000Z", fromMs, stride, 4),
    3,
  );
}

{
  const kinds = [
    "sample",
    "sparse",
    "sparse",
    "offline",
    "offline",
    "void",
    "sample",
  ] as const;
  const labels = ["10:00", "10:15", "10:30", "10:45", "11:00", "11:15", "11:30"];
  const bands = collapseUplinkBands([...kinds], labels);
  assert.equal(bands.length, 3);
  assert.equal(bands[0]?.kind, "sparse");
  assert.equal(bands[0]?.label, "희소 10:15–10:30");
  assert.equal(bands[1]?.kind, "offline");
  assert.equal(bands[1]?.label, "통신두절 10:45–11:00");
  assert.equal(bands[2]?.kind, "void");
  assert.equal(bands[2]?.label, "없음 11:15");
}

{
  const a = {
    fromMs: 0,
    toMs: 1000,
    strideMs: 15 * 60 * 1000,
    bucketCount: 4,
    byController: new Map(),
  };
  const b = {
    fromMs: 500,
    toMs: 2000,
    strideMs: 60 * 60 * 1000,
    bucketCount: 4,
    byController: new Map(),
  };
  const picked = pickUplinkCoverageIndex([a, b], 0, 15 * 60 * 1000);
  assert.equal(picked, a);
  assert.equal(
    pickUplinkCoverageIndex([b], 0, 15 * 60 * 1000),
    null,
    "stride mismatch skipped",
  );
}

console.log("trend-uplink-coverage.test.ts: ok");

test("module asserts", () => {
  // node:assert 호출은 이 파일을 불러올 때 이미 실행된다.
});
