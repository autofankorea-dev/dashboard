/**
 * 실행: npx tsx src/lib/data/alarm-scope-cascade.test.ts
 *
 * 차트·일괄 — scope 저장 시 하위 override cascade.
 */
import assert from "node:assert/strict";
import {
  applyScopeAlarmThresholdsWithCascade,
  buildAlarmScopeKey,
  resolveThresholdsForChartScope,
  resolveThresholdsForScope,
} from "./alarm-scope";
import {
  DEFAULT_ALARM_SETTINGS,
  DEFAULT_ALARM_THRESHOLDS,
  type AlarmSettings,
} from "./alarms";

const farmId = "FARM01";
const farmKey = buildAlarmScopeKey({ farmId });
const spKey = buildAlarmScopeKey({ farmId, sp: "자돈" });
const stallKey = buildAlarmScopeKey({ farmId, sp: "자돈", stall: "01" });
const ctrlKey = buildAlarmScopeKey({
  farmId,
  sp: "자돈",
  stall: "01",
  controllerKey: "c06",
});

const farm26: typeof DEFAULT_ALARM_THRESHOLDS = {
  ...DEFAULT_ALARM_THRESHOLDS,
  tempHigh: 26,
};
const ctrl27: typeof DEFAULT_ALARM_THRESHOLDS = {
  ...DEFAULT_ALARM_THRESHOLDS,
  tempHigh: 27,
};

const base: AlarmSettings = {
  ...DEFAULT_ALARM_SETTINGS,
  byScope: {
    [ctrlKey]: ctrl27,
    [stallKey]: { ...DEFAULT_ALARM_THRESHOLDS, tempHigh: 28 },
  },
  byStallTyCode: {
    자돈: { ...DEFAULT_ALARM_THRESHOLDS, tempHigh: 29 },
  },
};

{
  const { settings, clearedOverrides } = applyScopeAlarmThresholdsWithCascade(
    base,
    farmKey,
    farm26,
    { stallTyCodesToClear: ["자돈"] },
  );
  assert.ok(clearedOverrides >= 2);
  assert.equal(settings.byScope?.[ctrlKey], undefined);
  assert.equal(settings.byScope?.[stallKey], undefined);
  assert.equal(settings.byScope?.[farmKey]?.tempHigh, 26);
  assert.equal(settings.byStallTyCode["자돈"], undefined);
  assert.equal(resolveThresholdsForScope(settings, ctrlKey).tempHigh, 26);
}

{
  const { settings } = applyScopeAlarmThresholdsWithCascade(
    base,
    spKey,
    farm26,
  );
  assert.equal(settings.byScope?.[ctrlKey], undefined);
  assert.equal(settings.byScope?.[spKey]?.tempHigh, 26);
  assert.equal(settings.byStallTyCode["자돈"], undefined);
  assert.equal(resolveThresholdsForScope(settings, ctrlKey).tempHigh, 26);
}

{
  /** 축사 칸 — 컨트롤러에만 저장된 알람을 필드와 같이 쓴다 */
  const stallOnlyCtrl: AlarmSettings = {
    ...DEFAULT_ALARM_SETTINGS,
    byScope: {
      [farmKey]: { ...DEFAULT_ALARM_THRESHOLDS, tempLow: 23, tempHigh: 27 },
      [ctrlKey]: { ...DEFAULT_ALARM_THRESHOLDS, tempLow: 16, tempHigh: 19 },
      [buildAlarmScopeKey({
        farmId,
        sp: "자돈",
        stall: "01",
        controllerKey: "c07",
      })]: { ...DEFAULT_ALARM_THRESHOLDS, tempLow: 16, tempHigh: 19 },
    },
  };
  const stallResolved = resolveThresholdsForScope(stallOnlyCtrl, stallKey);
  assert.equal(stallResolved.tempLow, 16);
  assert.equal(stallResolved.tempHigh, 19);

  const mixed: AlarmSettings = {
    ...DEFAULT_ALARM_SETTINGS,
    byScope: {
      [farmKey]: { ...DEFAULT_ALARM_THRESHOLDS, tempLow: 23, tempHigh: 27 },
      [ctrlKey]: { ...DEFAULT_ALARM_THRESHOLDS, tempLow: 16, tempHigh: 19 },
      [buildAlarmScopeKey({
        farmId,
        sp: "자돈",
        stall: "01",
        controllerKey: "c07",
      })]: { ...DEFAULT_ALARM_THRESHOLDS, tempLow: 20, tempHigh: 24 },
    },
  };
  const mixedResolved = resolveThresholdsForScope(mixed, stallKey);
  assert.equal(mixedResolved.tempLow, 23);
  assert.equal(mixedResolved.tempHigh, 27);
  assert.equal(
    resolveThresholdsForChartScope(stallOnlyCtrl, stallKey, []).tempHigh,
    NaN,
  );
}

console.log("alarm-scope-cascade: ok");
