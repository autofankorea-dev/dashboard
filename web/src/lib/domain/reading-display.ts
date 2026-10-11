import type { ControllerReading, ControllerStatus } from "@/lib/data/iot";

export function isReadingOnline(status: ControllerStatus | undefined): boolean {
  return !!status && status !== "offline";
}

/** 오프라인 판정 시 센서·팬 수치를 UI에 노출하지 않음 */
export function sensorValueForDisplay(
  status: ControllerStatus | undefined,
  value: number | null | undefined
): number | null {
  if (!isReadingOnline(status)) return null;
  return value != null && Number.isFinite(value) ? value : null;
}

/** 미수신·null — 「--」 대신 값 미표시 */
export function formatSensorNumber(
  value: number | null | undefined,
  digits = 1
): string | null {
  if (value == null || !Number.isFinite(value)) return null;
  return value.toFixed(digits);
}

export function formatSensorNumberForDisplay(
  status: ControllerStatus | undefined,
  value: number | null | undefined,
  digits = 1
): string | null {
  return formatSensorNumber(sensorValueForDisplay(status, value), digits);
}

export function formatTempForDisplay(
  status: ControllerStatus | undefined,
  value: number | null | undefined
): string | null {
  const v = sensorValueForDisplay(status, value);
  return v != null ? `${v.toFixed(1)}℃` : null;
}

export function formatPctForDisplay(
  status: ControllerStatus | undefined,
  value: number | null | undefined
): string | null {
  const v = sensorValueForDisplay(status, value);
  return v != null ? `${Math.round(v)}%` : null;
}

export function operationPctForDisplay(
  reading?: Pick<
    ControllerReading,
    "status" | "fanSupply" | "fanExhaust" | "fanIntake"
  >
): number | null {
  if (!reading || !isReadingOnline(reading.status)) return null;
  const vals = [reading.fanSupply, reading.fanExhaust, reading.fanIntake].filter(
    (v): v is number => v != null && Number.isFinite(v)
  );
  if (vals.length === 0) return null;
  const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
  return Math.max(0, Math.min(100, Math.round(avg)));
}

export function formatOperationPctForDisplay(
  reading?: Pick<
    ControllerReading,
    "status" | "fanSupply" | "fanExhaust" | "fanIntake"
  >
): string | null {
  const pct = operationPctForDisplay(reading);
  return pct != null ? `${pct}%` : null;
}
