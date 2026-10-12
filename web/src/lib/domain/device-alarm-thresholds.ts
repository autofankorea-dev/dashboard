import type { AlarmThresholds } from "./alarms";
export type DeviceAlarmReading = { alarmLowTempC?: number | null; alarmHighTempC?: number | null };
export function deviceAlarmThresholds(r: DeviceAlarmReading): AlarmThresholds {
  const low = r.alarmLowTempC, high = r.alarmHighTempC;
  const valid = low != null && high != null && Number.isFinite(low) && Number.isFinite(high) && low < high;
  return { tempLow: valid ? low : NaN, tempHigh: valid ? high : NaN, humidityLow: NaN, humidityHigh: NaN };
}
export function commonDeviceAlarmThresholds(readings: DeviceAlarmReading[]): AlarmThresholds {
  const first = deviceAlarmThresholds(readings[0] ?? {});
  return readings.length && readings.every(r => { const t = deviceAlarmThresholds(r); return t.tempLow === first.tempLow && t.tempHigh === first.tempHigh; }) ? first : deviceAlarmThresholds({});
}
