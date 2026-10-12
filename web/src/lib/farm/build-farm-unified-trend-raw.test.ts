import { test } from "vitest";
/**
 * 실행: npx vitest run src/lib/farm/build-farm-unified-trend-raw.test.ts
 *
 * 채널 표시 정본 = 슬롯(A/B/C). eqpmnCode는 내부용.
 * 이제 슬롯별 모터%가 RPC(avg_fan_a/b/c)로 파이프라인에 실려 오므로,
 * 집계는 fanA/fanB/fanC 를 그대로 소비한다(역할 재배치 없음).
 */
import assert from "node:assert/strict";
import type { TrendControllerSeries } from "@/lib/domain/farm-trend-types";
import { DEFAULT_ALARM_THRESHOLDS } from "@/lib/domain/alarms";
import { aggregateUnifiedBarnTrendRaw } from "./unified-barn-trend-series";

function ctrl(
  over: Partial<TrendControllerSeries> & Pick<TrendControllerSeries, "controllerKey">,
): TrendControllerSeries {
  const n = 1;
  const col = (): (number | null)[] => new Array(n).fill(null);
  return {
    stallNo: "1",
    eqpmnNo: "01",
    temp: [22],
    humidity: [55],
    fanA: col(),
    fanB: col(),
    fanC: col(),
    fanSupply: col(),
    fanExhaust: col(),
    fanIntake: col(),
    sampleCount: [1],
    ...over,
  };
}

const categories = ["a"];
const thresholds = DEFAULT_ALARM_THRESHOLDS;

{
  // 슬롯 A만 활성(fanA=50), B·C 없음 → 집계도 A만 값, B·C null.
  // (필드 A 50% ↔ 차트 A 50% 정합. eqpmnCode 비참조.)
  const raw = aggregateUnifiedBarnTrendRaw(
    [ctrl({ controllerKey: "c1", fanA: [50] })],
    categories,
    thresholds,
  );
  assert.ok(raw, "raw aggregate");
  assert.equal(raw!.fanA[0], 50);
  assert.equal(raw!.fanB[0], null);
  assert.equal(raw!.fanC[0], null);
  assert.equal(raw!.fanMaxRaw[0], 50);
}

{
  // 세 슬롯 각기 다른 값 → 채널별 독립(한 채널 값이 다른 채널로 복제되지 않음).
  const raw = aggregateUnifiedBarnTrendRaw(
    [ctrl({ controllerKey: "c1", fanA: [15], fanB: [45], fanC: [0] })],
    categories,
    thresholds,
  );
  assert.ok(raw);
  assert.equal(raw!.fanA[0], 15);
  assert.equal(raw!.fanB[0], 45);
  assert.equal(raw!.fanC[0], 0);
  assert.equal(raw!.fanMaxRaw[0], 45);
}

{
  // 집계는 role(EC) 컬럼을 참조하지 않는다: fanIntake/Exhaust/Supply 만 채워도 무시.
  const raw = aggregateUnifiedBarnTrendRaw(
    [
      ctrl({
        controllerKey: "c1",
        fanIntake: [99],
        fanExhaust: [88],
        fanSupply: [77],
      }),
    ],
    categories,
    thresholds,
  );
  assert.ok(raw);
  assert.equal(raw!.fanA[0], null);
  assert.equal(raw!.fanB[0], null);
  assert.equal(raw!.fanC[0], null);
}

console.log("build-farm-unified-trend-raw.test.ts: ok");

test("module asserts", () => {
  // node:assert 호출은 이 파일을 불러올 때 이미 실행된다.
});
