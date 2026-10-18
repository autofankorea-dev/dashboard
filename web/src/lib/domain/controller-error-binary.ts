import type { AlarmRow } from "./alarms";
import type { BarnReading } from "./iot-types";

/** Keep distinct wire codes separate: these bytes are enums, not a bitmask. */
export function controllerErrorBytes(reading: BarnReading, alarms: AlarmRow[]) {
  const seen = new Set<string>();
  return alarms
    .filter((alarm) =>
      alarm.source === "module" && alarm.status === "active" &&
      alarm.farmKey.lsindRegistNo === reading.farmKey.lsindRegistNo &&
      alarm.farmKey.itemCode === reading.farmKey.itemCode &&
      alarm.moduleUid === reading.moduleUid &&
      (!alarm.controllerKey || alarm.controllerKey === reading.controllerKey) &&
      Number.isInteger(alarm.errCode) && alarm.errCode! >= 0 && alarm.errCode! <= 255,
    )
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
    .flatMap((alarm) => {
      const scope = alarm.controllerKey ? "controller" : "module";
      const key = `${scope}:${alarm.errCode}`;
      if (seen.has(key)) return [];
      seen.add(key);
      return [{
        key,
        scope,
        binary: alarm.errCode!.toString(2).padStart(8, "0"),
        hex: `0x${alarm.errCode!.toString(16).toUpperCase().padStart(2, "0")}`,
        label: alarm.alarmType,
        receivedAt: alarm.occurredAt,
      }];
    });
}
