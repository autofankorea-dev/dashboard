import type { ControllerThermoSettings } from "@/lib/controllers/controller-settings";
import type { ThermoCommand } from "@/lib/data/commands";
import type { ControllerReading } from "@/lib/data/iot";
import type { AlarmSettings } from "@/lib/domain/alarms";

/** ???·??·???? ?? ? ?? ? map/ops ???? ??? ?? */
export type ControllerGridData = {
  readings: ControllerReading[];
  thermoSettings: Record<string, ControllerThermoSettings>;
  commands: ThermoCommand[];
  canCommand: boolean;
  alarmSettings?: AlarmSettings;
};
