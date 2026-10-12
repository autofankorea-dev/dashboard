import { test } from "vitest";
/**
 * 실행: npx vitest run src/lib/farm/alarm-breach-x-range.test.ts
 */
import assert from "node:assert/strict";
import {
  chartZoomFromTempBreach,
  findTempAlarmBreachXRange,
  listTempAlarmBreachRuns,
} from "./alarm-breach-x-range";

{
  const avg = [25, 26, 27, 28, 29, 31, 32, 33, 31, 28, 27];
  const win = findTempAlarmBreachXRange(avg, 10, 30, {
    tempMax: avg,
    tempMin: avg,
    padLeft: 0,
    padRight: 0,
  });
  assert.ok(win);
  /** 29→31 보간 교차로 인덱스 4도 포함 */
  assert.equal(win!.start, 4);
  assert.equal(win!.end, 8);
  assert.equal(win!.side, "high");
  assert.ok(win!.peakExcess >= 3);
  assert.equal(win!.runCount, 1);
  const zoom = chartZoomFromTempBreach(win);
  assert.ok(zoom);
  assert.equal(zoom!.startIndex, 4);
  assert.equal(zoom!.endIndex, 8);
}

{
  const avg = [25, 25, 25, 25];
  assert.equal(findTempAlarmBreachXRange(avg, 10, 30), null);
}

{
  const avg = [28, 28, 28, 28, 28, 28];
  const max = [28, 28, 31, 32, 31, 28];
  const min = [27, 27, 27, 27, 27, 27];
  const win = findTempAlarmBreachXRange(avg, 10, 30, {
    tempMax: max,
    tempMin: min,
    padLeft: 0,
    padRight: 0,
  });
  assert.ok(win);
  assert.ok(win!.start <= 2);
  assert.equal(win!.end, 4);
  assert.equal(win!.side, "high");
}

{
  const avg = [20, 20, 8, 7, 8, 20];
  const win = findTempAlarmBreachXRange(avg, 10, 30, {
    padLeft: 0,
    padRight: 0,
  });
  assert.ok(win);
  assert.equal(win!.side, "low");
  assert.ok(win!.start <= 2);
  assert.equal(win!.end, 4);
}

{
  /** 상한 3구간 → 전부 커버 */
  const avg = Array.from({ length: 21 }, () => 25);
  const max = avg.map((_, i) => {
    if (i >= 4 && i <= 5) return 30.05;
    if (i >= 10 && i <= 11) return 30.2;
    if (i >= 16 && i <= 17) return 30.1;
    return 28;
  });
  const runs = listTempAlarmBreachRuns(avg, 10, 30, {
    tempMax: max,
    tempMin: avg.map(() => 24),
  });
  assert.equal(runs.length, 3);

  const win = findTempAlarmBreachXRange(avg, 10, 30, {
    tempMax: max,
    tempMin: avg.map(() => 24),
    padLeft: 0,
    padRight: 0,
  });
  assert.ok(win);
  assert.equal(win!.runCount, 3);
  assert.ok(win!.start <= 4);
  assert.ok(win!.end >= 17);
  assert.equal(win!.side, "high");
}

{
  /** 왼쪽 봉이 평균만 임계 접촉 — 산포 max는 이미 넘김 */
  const avg = [25, 28.0, 25, 25, 25, 25, 30.2, 25];
  const max = [26, 28.0, 26, 26, 26, 26, 31, 26];
  const win = findTempAlarmBreachXRange(avg, 10, 28, {
    tempMax: max,
    tempMin: avg.map(() => 24),
    padLeft: 2,
    padRight: 0,
  });
  assert.ok(win);
  assert.ok(win!.start <= 1, `left peak should be included, start=${win!.start}`);
  assert.ok(win!.end >= 6);
}

{
  /** 보간 교차: 샘플은 임계 아래/위 사이 */
  const avg = [25, 27.5, 28.5, 25];
  const max = [26, 27.5, 28.5, 26];
  const runs = listTempAlarmBreachRuns(avg, 10, 28, {
    tempMax: max,
    tempMin: avg.map(() => 24),
  });
  assert.ok(runs.length >= 1);
  assert.ok(runs[0]!.start <= 2);
}

{
  const avg = Array.from({ length: 21 }, () => 25);
  const max = avg.map((_, i) => {
    if (i >= 4 && i <= 5) return 30.05;
    if (i >= 10 && i <= 13) return 32;
    if (i >= 16 && i <= 17) return 30.1;
    return 28;
  });
  const win = findTempAlarmBreachXRange(avg, 10, 30, {
    tempMax: max,
    tempMin: avg.map(() => 24),
    padLeft: 0,
    padRight: 0,
    singleBestRun: true,
  });
  assert.ok(win);
  assert.equal(win!.runCount, 1);
  assert.ok(win!.start <= 10);
  assert.ok(win!.end >= 13);
}

console.log("alarm-breach-x-range.test.ts: ok");

test("module asserts", () => {
  // node:assert 호출은 이 파일을 불러올 때 이미 실행된다.
});
