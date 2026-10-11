import type { AlarmRow } from "@/lib/domain/alarms";
import type { BarnReading, ControllerStatus } from "@/lib/data/iot";
import { sensorValueForDisplay } from "@/lib/domain/reading-display";

function avg(nums: number[]): number | null {
  if (nums.length === 0) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

const STATUS_RANK: Record<ControllerStatus, number> = {
  normal: 0,
  caution: 1,
  offline: 2,
};

export function worstControllerStatus(
  statuses: ControllerStatus[]
): ControllerStatus {
  if (statuses.length === 0) return "offline";
  return statuses.reduce((w, s) =>
    STATUS_RANK[s] > STATUS_RANK[w] ? s : w
  );
}

export type ReadingGroupSummary = {
  status: ControllerStatus;
  tempC: number | null;
  humidityPct: number | null;
  fanSupply: number | null;
  fanExhaust: number | null;
  fanIntake: number | null;
  latestReceivedAt: string | null;
};

export function summarizeReadings(
  readings: BarnReading[]
): ReadingGroupSummary {
  const temps: number[] = [];
  const humidities: number[] = [];
  const supplies: number[] = [];
  const exhausts: number[] = [];
  const intakes: number[] = [];
  let latest: string | null = null;

  for (const r of readings) {
    const t = sensorValueForDisplay(r.status, r.tempC);
    const h = sensorValueForDisplay(r.status, r.humidityPct);
    const fs = sensorValueForDisplay(r.status, r.fanSupply);
    const fe = sensorValueForDisplay(r.status, r.fanExhaust);
    const fi = sensorValueForDisplay(r.status, r.fanIntake);
    if (t != null) temps.push(t);
    if (h != null) humidities.push(h);
    if (fs != null) supplies.push(fs);
    if (fe != null) exhausts.push(fe);
    if (fi != null) intakes.push(fi);
    if (!latest || new Date(r.receivedAt) > new Date(latest)) {
      latest = r.receivedAt;
    }
  }

  return {
    status: worstControllerStatus(readings.map((r) => r.status)),
    tempC: avg(temps),
    humidityPct: avg(humidities),
    fanSupply: avg(supplies),
    fanExhaust: avg(exhausts),
    fanIntake: avg(intakes),
    latestReceivedAt: latest,
  };
}

export type AlarmGroupSummary = {
  latestOccurredAt: string | null;
  criticalCount: number;
  warningCount: number;
  dominantAlarmType: string | null;
};

export function summarizeAlarms(alarms: AlarmRow[]): AlarmGroupSummary {
  let latest: string | null = null;
  let criticalCount = 0;
  let warningCount = 0;
  const typeCounts = new Map<string, number>();

  for (const a of alarms) {
    if (a.severity === "critical") criticalCount += 1;
    else warningCount += 1;
    typeCounts.set(a.alarmType, (typeCounts.get(a.alarmType) ?? 0) + 1);
    if (!latest || new Date(a.occurredAt) > new Date(latest)) {
      latest = a.occurredAt;
    }
  }

  let dominantAlarmType: string | null = null;
  let maxCount = 0;
  for (const [type, count] of typeCounts) {
    if (count > maxCount) {
      maxCount = count;
      dominantAlarmType = type;
    }
  }

  return {
    latestOccurredAt: latest,
    criticalCount,
    warningCount,
    dominantAlarmType,
  };
}
