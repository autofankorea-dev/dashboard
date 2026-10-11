import { filterReadingsByFarmKey } from "@/lib/auth/farm-access";
import {
  buildThermoSettingsFromReadings,
  mergeThermoSettingsMaps,
  type ControllerThermoSettings,
} from "@/lib/controllers/controller-settings";
import type { ControllerGridData } from "@/lib/farm/controller-grid-data";
import {
  getBarnLayoutPrefs,
  type BarnLayoutPrefs,
} from "@/lib/data/barn-meta";
import {
  buildAutoBarnMap,
  filterBarnLayoutPrefsForFarm,
  gridDimensionsForBarnMap,
} from "@/lib/domain/barn-map";
import {
  FARM_CHART_COMMAND_HISTORY_LIMIT,
  farmChartCommandHistoryOptions,
  getThermoCommandHistory,
  getThermoSettingsMap,
  type ThermoCommand,
} from "@/lib/data/commands";
import { getAlarmSettings } from "@/lib/data/alarm-settings";
import type { AlarmRow, AlarmSettings } from "@/lib/domain/alarms";
import { fetchActiveModuleAlarms } from "@/lib/data/module-alarms";
import type { TrendPeriodData, TrendPeriodId } from "@/lib/domain/farm-trend-types";
import type { FarmKey } from "@/lib/domain/farm-key";
import type { BarnMapSnapshot, BarnReading } from "@/lib/data/iot";
import { getLiveReadings } from "@/lib/data/iot";

export type BarnLayoutsToPersist = Record<string, { col: number; row: number }>;

export type FarmScopedPanelData = {
  farmKey: FarmKey;
  readings: BarnReading[];
  barnSnapshots: BarnMapSnapshot[];
  gridCols: number;
  gridRows: number;
  /** Phase B — SSR/enrich는 null; stall trend는 client idle hydrate */
  trendByPeriod: Record<TrendPeriodId, TrendPeriodData> | null;
  controller: ControllerGridData;
  /** Phase C — 읽기 경로 write 제거; client idle persist */
  layoutsToPersist?: BarnLayoutsToPersist;
};

/** soft refresh / ACK 폴링 — LIVE(+layout)만. settings·trend 제외 · slim readings */
export type FarmScopedLiveData = {
  farmKey: FarmKey;
  readings: BarnReading[];
  barnSnapshots: BarnMapSnapshot[];
  gridCols: number;
  gridRows: number;
  layoutsToPersist?: BarnLayoutsToPersist;
  /** 모듈 경보 View — 셸 이상상황 정본 */
  moduleAlarms: AlarmRow[];
};

function buildScopedBarnMap(
  farmKey: FarmKey,
  readings: BarnReading[],
  layoutPrefs: BarnLayoutPrefs,
): {
  scopedReadings: BarnReading[];
  barnSnapshots: BarnMapSnapshot[];
  gridCols: number;
  gridRows: number;
  layoutsToPersist: BarnLayoutsToPersist;
} {
  const scopedReadings = filterReadingsByFarmKey(readings, farmKey);
  const scopedLayoutPrefs = filterBarnLayoutPrefsForFarm(layoutPrefs, farmKey);

  const { snapshots: barnSnapshots, layoutsToPersist } = buildAutoBarnMap(
    scopedReadings,
    scopedLayoutPrefs,
  );

  // Phase C — SSR/soft read path에서 profiles write 제거 (idle client persist)
  const mergedLayouts = {
    ...scopedLayoutPrefs.layouts,
    ...layoutsToPersist,
  };
  const gridSize = gridDimensionsForBarnMap(barnSnapshots, mergedLayouts);

  return {
    scopedReadings,
    barnSnapshots,
    gridCols: gridSize.cols,
    gridRows: gridSize.rows,
    layoutsToPersist,
  };
}

/** LIVE tier only — soft refresh / command confirm용 (list-tier slim, channels 생략) */
export async function loadFarmScopedLiveData(params: {
  farmKey: FarmKey;
  layoutPrefs?: BarnLayoutPrefs;
}): Promise<FarmScopedLiveData> {
  const { farmKey } = params;
  const [readings, layoutPrefs, moduleAlarms] = await Promise.all([
    getLiveReadings({ farmKey, slim: true }),
    params.layoutPrefs
      ? Promise.resolve(params.layoutPrefs)
      : getBarnLayoutPrefs(),
    fetchActiveModuleAlarms(farmKey),
  ]);

  const map = buildScopedBarnMap(farmKey, readings, layoutPrefs);
  return {
    farmKey,
    readings: map.scopedReadings,
    barnSnapshots: map.barnSnapshots,
    gridCols: map.gridCols,
    gridRows: map.gridRows,
    layoutsToPersist:
      Object.keys(map.layoutsToPersist).length > 0
        ? map.layoutsToPersist
        : undefined,
    moduleAlarms,
  };
}

export async function loadFarmScopedPanelData(params: {
  farmKey: FarmKey;
  commandThermoMap?: Record<string, ControllerThermoSettings>;
  history?: ThermoCommand[];
  alarmSettings?: AlarmSettings;
  layoutPrefs?: BarnLayoutPrefs;
  canCommand: boolean;
}): Promise<FarmScopedPanelData> {
  const { farmKey, canCommand } = params;

  const [readings, layoutPrefs, alarmSettings, commandThermoMap, history] =
    await Promise.all([
      getLiveReadings({ farmKey }),
      params.layoutPrefs
        ? Promise.resolve(params.layoutPrefs)
        : getBarnLayoutPrefs(),
      params.alarmSettings
        ? Promise.resolve(params.alarmSettings)
        : getAlarmSettings(),
      params.commandThermoMap
        ? Promise.resolve(params.commandThermoMap)
        : getThermoSettingsMap(500),
      params.history
        ? Promise.resolve(params.history)
        : getThermoCommandHistory(
            FARM_CHART_COMMAND_HISTORY_LIMIT,
            farmChartCommandHistoryOptions(farmKey),
          ),
    ]);

  const map = buildScopedBarnMap(farmKey, readings, layoutPrefs);
  const thermoSettingsForFarm = mergeThermoSettingsMaps(
    commandThermoMap,
    buildThermoSettingsFromReadings(map.scopedReadings),
  );

  return {
    farmKey,
    readings: map.scopedReadings,
    barnSnapshots: map.barnSnapshots,
    gridCols: map.gridCols,
    gridRows: map.gridRows,
    trendByPeriod: null,
    layoutsToPersist:
      Object.keys(map.layoutsToPersist).length > 0
        ? map.layoutsToPersist
        : undefined,
    controller: {
      readings: map.scopedReadings,
      thermoSettings: thermoSettingsForFarm,
      commands: history,
      canCommand,
      alarmSettings,
    },
  };
}
