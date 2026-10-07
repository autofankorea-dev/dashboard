/**
 * 실행: npx tsx src/lib/ui/guided-scope-jitter.test.ts
 */
import assert from "node:assert/strict";
import { humanizeGuidedScopeRect } from "./guided-scope-jitter";

function seq(values: number[]): () => number {
  let i = 0;
  return () => {
    const v = values[i % values.length]!;
    i += 1;
    return v;
  };
}

const base = {
  startRatio: 0.25,
  endRatio: 0.55,
  yStartRatio: 0.2,
  yEndRatio: 0.55,
  durationMs: 3200,
};

{
  const out = humanizeGuidedScopeRect(base, seq([0.1, 0.8, 0.3, 0.6, 0.2]));
  assert.ok(out.startRatio >= 0);
  assert.ok(out.endRatio <= 1);
  assert.ok(out.endRatio - out.startRatio >= 0.06);
  assert.ok(out.yEndRatio - out.yStartRatio >= 0.05);
  assert.ok(out.durationMs != null && out.durationMs > 2500);
  /** X는 기준 밖으로 확장하지 않음 */
  assert.ok(out.startRatio >= base.startRatio - 1e-9);
  assert.ok(out.endRatio <= base.endRatio + 1e-9);
}

{
  const a = humanizeGuidedScopeRect(base, seq([0.05, 0.1, 0.15, 0.2, 0.25]));
  const b = humanizeGuidedScopeRect(base, seq([0.95, 0.9, 0.85, 0.8, 0.75]));
  assert.ok(
    a.startRatio !== b.startRatio ||
      a.endRatio !== b.endRatio ||
      a.yStartRatio !== b.yStartRatio ||
      a.yEndRatio !== b.yEndRatio,
  );
  assert.ok(a.startRatio >= base.startRatio - 1e-9);
  assert.ok(a.endRatio <= base.endRatio + 1e-9);
  assert.ok(b.startRatio >= base.startRatio - 1e-9);
  assert.ok(b.endRatio <= base.endRatio + 1e-9);
}

console.log("guided-scope-jitter: ok");
