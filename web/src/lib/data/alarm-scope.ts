import { deviceAlarmThresholds, commonDeviceAlarmThresholds } from "./device-alarm-thresholds";
import type { BarnReading } from "@/lib/data/iot";
import { farmKeyId } from "@/lib/data/farm-key";
import { farmShortLabelFromId } from "@/lib/data/farm-summaries";
import {
  stallKeyFromReading,
} from "@/lib/data/reading-hierarchy";
import { normalizeStallTyCode, formatStallTypeLabel } from "@/lib/data/stall-type";
import {
  type AlarmSettings,
  type AlarmThresholds,
} from "@/lib/data/alarms";

type AlarmScopeParts = {
  farmId: string;
  sp?: string;
  stall?: string;
  controllerKey?: string;
};

export function buildAlarmScopeKey(parts: AlarmScopeParts): string {
  const segments = [`farm:${parts.farmId}`];
  if (parts.sp) segments.push(`sp:${parts.sp}`);
  if (parts.stall) segments.push(`stall:${parts.stall}`);
  if (parts.controllerKey) {
    segments.push(`ctrl:${encodeURIComponent(parts.controllerKey)}`);
  }
  return segments.join("|");
}

function parseAlarmScopeKey(key: string): AlarmScopeParts | null {
  if (!key.startsWith("farm:")) return null;
  const parts: AlarmScopeParts = { farmId: "" };
  for (const seg of key.split("|")) {
    if (seg.startsWith("farm:")) parts.farmId = seg.slice(5);
    else if (seg.startsWith("sp:")) parts.sp = seg.slice(3);
    else if (seg.startsWith("stall:")) parts.stall = seg.slice(6);
    else if (seg.startsWith("ctrl:")) {
      parts.controllerKey = decodeURIComponent(seg.slice(5));
    }
  }
  return parts.farmId ? parts : null;
}

export function resolveThresholdsForReading(
  settings: AlarmSettings,
  r: BarnReading
): AlarmThresholds {
  void settings;
  return deviceAlarmThresholds(r);
}

export function alarmThresholdsEqual(
  a: AlarmThresholds,
  b: AlarmThresholds,
): boolean {
  return (
    a.tempLow === b.tempLow &&
    a.tempHigh === b.tempHigh &&
    a.humidityLow === b.humidityLow &&
    a.humidityHigh === b.humidityHigh
  );
}

function childScopeKeyPrefix(parts: AlarmScopeParts): string | null {
  if (parts.controllerKey) return null;
  if (parts.stall && parts.sp) {
    return `${buildAlarmScopeKey({
      farmId: parts.farmId,
      sp: parts.sp,
      stall: parts.stall,
    })}|`;
  }
  if (parts.sp) {
    return `${buildAlarmScopeKey({ farmId: parts.farmId, sp: parts.sp })}|`;
  }
  return null;
}

/** 축사·유형에 직접 값이 없고, 하위 컨트롤러만 있으면 그 값이 모두 같을 때 사용 */
function unanimousChildScopeThresholds(
  settings: AlarmSettings,
  parts: AlarmScopeParts,
): AlarmThresholds | null {
  const prefix = childScopeKeyPrefix(parts);
  const byScope = settings.byScope;
  if (!prefix || !byScope) return null;
  const children: AlarmThresholds[] = [];
  for (const [key, value] of Object.entries(byScope)) {
    if (!key.startsWith(prefix) || !value) continue;
    children.push(value);
  }
  if (!children.length) return null;
  const first = children[0]!;
  if (!children.every((t) => alarmThresholdsEqual(t, first))) return null;
  return first;
}

export function resolveThresholdsForScope(
  settings: AlarmSettings,
  scopeKey: string | null
): AlarmThresholds {
  if (!scopeKey) return settings.global;

  const parts = parseAlarmScopeKey(scopeKey);
  if (!parts) return settings.global;

  const specific: string[] = [];
  if (parts.controllerKey && parts.stall && parts.sp) {
    specific.push(
      buildAlarmScopeKey({
        farmId: parts.farmId,
        sp: parts.sp,
        stall: parts.stall,
        controllerKey: parts.controllerKey,
      }),
    );
  }
  if (parts.stall && parts.sp) {
    specific.push(
      buildAlarmScopeKey({
        farmId: parts.farmId,
        sp: parts.sp,
        stall: parts.stall,
      }),
    );
  }
  if (parts.sp) {
    specific.push(buildAlarmScopeKey({ farmId: parts.farmId, sp: parts.sp }));
  }

  for (const key of specific) {
    const hit = settings.byScope?.[key];
    if (hit) return hit;
  }

  const childHit = unanimousChildScopeThresholds(settings, parts);
  if (childHit) return childHit;

  const farmHit = settings.byScope?.[buildAlarmScopeKey({ farmId: parts.farmId })];
  if (farmHit) return farmHit;

  if (parts.sp && settings.byStallTyCode[parts.sp]) {
    return settings.byStallTyCode[parts.sp];
  }

  return settings.global;
}

/**
 * 차트·집계 칸 — 칸 안 컨트롤러가 필드와 같은 값이면 그걸 쓰고,
 * 서로 다르면 범위 키(축사→유형→농장)로 돌린다.
 */
export function resolveThresholdsForChartScope(
  settings: AlarmSettings,
  scopeKey: string | null,
  readings: BarnReading[],
): AlarmThresholds {
  void settings; void scopeKey;
  return commonDeviceAlarmThresholds(readings);
}

export function activeScopeKeyFromSelection(
  farmId: string,
  spCode: string,
  stallKey: string,
  controllerReadingKey: string,
  readings: BarnReading[]
): string | null {
  if (!farmId || !spCode) return null;

  if (controllerReadingKey) {
    const hit = readings.find((r) => r.key === controllerReadingKey);
    if (hit) {
      return buildAlarmScopeKey({
        farmId,
        sp: spCode,
        stall: stallKey || stallKeyFromReading(hit),
        controllerKey: hit.controllerKey,
      });
    }
  }

  if (stallKey) {
    return buildAlarmScopeKey({ farmId, sp: spCode, stall: stallKey });
  }

  return buildAlarmScopeKey({ farmId, sp: spCode });
}

export function describeAlarmScope(
  farmId: string,
  spCode: string,
  stallKey: string,
  controllerReadingKey: string,
  readings: BarnReading[]
): string {
  if (!farmId) return "농장을 선택하세요.";
  if (!spCode) return "축사유형을 선택하세요.";

  const farmLabel = farmShortLabelFromId(farmId);
  const spLabel = formatStallTypeLabel(spCode);
  if (!stallKey && !controllerReadingKey) {
    return `${farmLabel} · ${spLabel} — 축사유형 일괄 (해당 유형 전체 컨트롤러)`;
  }
  if (stallKey && !controllerReadingKey) {
    return `${farmLabel} · ${spLabel} · 축사 ${stallKey} — 축사 전체`;
  }
  const hit = readings.find((r) => r.key === controllerReadingKey);
  if (hit) {
    return `${farmLabel} · ${spLabel} · 축사 ${stallKey || stallKeyFromReading(hit)} · ${hit.label || hit.eqpmnNo}`;
  }
  return `${farmLabel} · ${spLabel}`;
}

export function filterReadingsForAlarmScope(
  readings: BarnReading[],
  farmId: string,
  spCode: string,
  stallKey: string,
  controllerReadingKey: string
): BarnReading[] {
  if (!farmId || !spCode) return [];

  return readings.filter((r) => {
    if (farmKeyId(r.farmKey) !== farmId) return false;
    if (normalizeStallTyCode(r.stallTyCode) !== spCode) return false;
    if (stallKey && stallKeyFromReading(r) !== stallKey) return false;
    if (controllerReadingKey && r.key !== controllerReadingKey) return false;
    return true;
  });
}

export function mergeScopeThreshold(
  settings: AlarmSettings,
  scopeKey: string,
  thresholds: AlarmThresholds
): AlarmSettings {
  return {
    ...settings,
    byScope: {
      ...(settings.byScope ?? {}),
      [scopeKey]: thresholds,
    },
  };
}

/** ancestorKey 하위(stall·controller) scope override 여부 */
function isDescendantScopeKey(
  scopeKey: string,
  ancestorScopeKey: string
): boolean {
  if (scopeKey === ancestorScopeKey) return false;
  return scopeKey.startsWith(`${ancestorScopeKey}|`);
}

/** SP scope 하위 stall·controller override 제거 */
export function clearDescendantScopeOverrides(
  settings: AlarmSettings,
  ancestorScopeKey: string
): { settings: AlarmSettings; cleared: number } {
  const byScope = settings.byScope;
  if (!byScope || Object.keys(byScope).length === 0) {
    return { settings, cleared: 0 };
  }
  const next = { ...byScope };
  let cleared = 0;
  for (const key of Object.keys(next)) {
    if (isDescendantScopeKey(key, ancestorScopeKey)) {
      delete next[key];
      cleared += 1;
    }
  }
  if (cleared === 0) return { settings, cleared: 0 };
  return { settings: { ...settings, byScope: next }, cleared };
}

function clearStallTyCodeOverrides(
  settings: AlarmSettings,
  stallTyCodes: Iterable<string>
): { settings: AlarmSettings; cleared: number } {
  let next = settings;
  let cleared = 0;
  for (const raw of stallTyCodes) {
    const sp = normalizeStallTyCode(raw);
    if (sp === "UNK" || !next.byStallTyCode[sp]) continue;
    const byStallTyCode = { ...next.byStallTyCode };
    delete byStallTyCode[sp];
    next = { ...next, byStallTyCode };
    cleared += 1;
  }
  return { settings: next, cleared };
}

/**
 * 차트·일괄 공통 — 해당 scope에 임계값 저장 + 하위 override cascade 제거.
 * farm/sp 적용 시 legacy byStallTyCode도 정리해 하위가 동일 값을 상속.
 */
export function applyScopeAlarmThresholdsWithCascade(
  settings: AlarmSettings,
  scopeKey: string,
  thresholds: AlarmThresholds,
  opts?: { stallTyCodesToClear?: Iterable<string> }
): { settings: AlarmSettings; clearedOverrides: number } {
  const clearedDesc = clearDescendantScopeOverrides(settings, scopeKey);
  let next = clearedDesc.settings;
  let clearedOverrides = clearedDesc.cleared;

  const parts = parseAlarmScopeKey(scopeKey);
  const stallTyCodes = new Set<string>();
  if (opts?.stallTyCodesToClear) {
    for (const sp of opts.stallTyCodesToClear) stallTyCodes.add(sp);
  } else if (parts?.sp && !parts.stall && !parts.controllerKey) {
    stallTyCodes.add(parts.sp);
  }

  if (stallTyCodes.size > 0) {
    const clearedTy = clearStallTyCodeOverrides(next, stallTyCodes);
    next = clearedTy.settings;
    clearedOverrides += clearedTy.cleared;
  }

  next = mergeScopeThreshold(next, scopeKey, thresholds);
  return { settings: next, clearedOverrides };
}

export type BulkSpAlarmApplyResult = {
  settings: AlarmSettings;
  spScopeKeys: string[];
  clearedOverrides: number;
};

/**
 * 일괄적용 — farm+sp scope 임계값 저장 + 하위 override cascade 제거.
 * 대상 컨트롤러가 SP 일괄값을 그대로 상속하도록 byScope descendant·byStallTyCode[sp] 정리.
 */
export function applyBulkSpAlarmThresholds(
  settings: AlarmSettings,
  targets: BarnReading[],
  selectedSps: ReadonlySet<string>,
  thresholds: AlarmThresholds
): BulkSpAlarmApplyResult {
  let next = settings;
  const spScopeKeys: string[] = [];
  const seen = new Set<string>();
  let clearedOverrides = 0;

  for (const r of targets) {
    const sp = normalizeStallTyCode(r.stallTyCode);
    if (!selectedSps.has(sp)) continue;
    const scopeKey = buildAlarmScopeKey({ farmId: farmKeyId(r.farmKey), sp });
    if (seen.has(scopeKey)) continue;
    seen.add(scopeKey);
    spScopeKeys.push(scopeKey);

    const applied = applyScopeAlarmThresholdsWithCascade(
      next,
      scopeKey,
      thresholds
    );
    next = applied.settings;
    clearedOverrides += applied.clearedOverrides;
  }

  return { settings: next, spScopeKeys, clearedOverrides };
}

export function clearScopeThreshold(
  settings: AlarmSettings,
  scopeKey: string
): AlarmSettings {
  if (!settings.byScope?.[scopeKey]) return settings;
  const next = { ...settings.byScope };
  delete next[scopeKey];
  return { ...settings, byScope: next };
}

export function hasScopeOverride(
  settings: AlarmSettings,
  scopeKey: string | null
): boolean {
  return Boolean(scopeKey && settings.byScope?.[scopeKey]);
}