"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";
import {
  fetchActiveModuleAlarmsAction,
  fetchFarmScopedLiveDataAction,
  persistBarnLayoutsQuietAction,
  revalidateFarmLiveAction,
} from "@/app/(dashboard)/farm/actions";
import { fetchFarmPanelEnrichShared } from "@/lib/farm/fetch-farm-panel-enrich";
import type { ControllerGridData } from "@/lib/farm/controller-grid-data";
import type { AlarmSettings, AlarmRow } from "@/lib/data/alarms";
import { mergeSituationAlarms } from "@/lib/data/alarms";
import type { ThermoCommand } from "@/lib/data/commands";
import { farmKeyId, type FarmKey } from "@/lib/data/farm-key";
import {
  buildThermoSettingsFromReadings,
  mergeThermoSettingsMaps,
  settingsFromCommand,
  thermoSettingsKey,
  type ControllerThermoSettings,
} from "@/lib/controllers/controller-settings";
import {
  farmPanelCacheFromSlice,
  hasThermoSettings,
  shouldSkipScopedPanelHydrate,
} from "@/lib/farm/farm-scoped-panel-utils";
import {
  mergeLiveBarnSnapshots,
  mergeLiveReadings,
  retainLiveList,
} from "@/lib/farm/merge-live-slice";
import {
  getFarmPanelCache,
  setFarmPanelCache,
} from "@/lib/farm/farm-panel-cache";
import type {
  BarnLayoutsToPersist,
  FarmScopedLiveData,
  FarmScopedPanelData,
} from "@/lib/farm/load-farm-scoped-panel-data";
import type { BarnMapSnapshot, BarnReading } from "@/lib/data/iot";
import type { TrendPeriodData, TrendPeriodId } from "@/lib/data/farm-trend-types";
import { hasStallTrendByPeriod } from "@/lib/data/farm-trend-types";
import { useFarmTourActive } from "@/lib/onboarding/use-farm-tour-active";
import { registerFarmLiveRefreshHandler } from "@/lib/navigation/farm-live-refresh-bridge";
import { scheduleSafeRouterRefresh } from "@/lib/navigation/safe-router-refresh";
import {
  clearShellAlarms,
  publishShellAlarms,
} from "@/lib/navigation/shell-live-alarms-store";

/** Phase C — 신규 SP 좌표 idle persist (read path write 대체) */
function schedulePersistLayouts(layouts?: BarnLayoutsToPersist): void {
  if (!layouts || Object.keys(layouts).length === 0) return;
  if (typeof window === "undefined") return;
  const run = () => {
    void persistBarnLayoutsQuietAction(layouts);
  };
  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(run, { timeout: 4000 });
  } else {
    globalThis.setTimeout(run, 800);
  }
}

/** soft refresh LIVE coalesce */
const liveInflight = new Map<string, Promise<FarmScopedLiveData>>();

/** map/list — LIVE·모듈 경보 주기 갱신 (모바일 push 대비 웹 폴링) */
const FARM_LIVE_POLL_MS = 30_000;

function fetchFarmLiveShared(farmKey: FarmKey): Promise<FarmScopedLiveData> {
  const id = farmKeyId(farmKey);
  const pending = liveInflight.get(id);
  if (pending) return pending;
  const req = fetchFarmScopedLiveDataAction(farmKey).finally(() => {
    if (liveInflight.get(id) === req) liveInflight.delete(id);
  });
  liveInflight.set(id, req);
  return req;
}

export type FarmLiveRevalidateMode = "live" | "full";

export type FarmLiveSlice = {
  readings: BarnReading[];
  barnSnapshots: BarnMapSnapshot[];
  gridCols: number;
  gridRows: number;
  trendByPeriod?: Record<TrendPeriodId, TrendPeriodData> | null;
  controller?: ControllerGridData | null;
  /** Phase C — SSR 응답의 신규 SP 좌표 → idle quiet persist */
  layoutsToPersist?: BarnLayoutsToPersist;
};

type FarmLiveRefreshContextValue = {
  farmKey: FarmKey | null;
  slice: FarmLiveSlice;
  revalidating: boolean;
  isStale: boolean;
  /** admin defer 등 — farmKey는 있으나 readings 로딩 중 (빈 화면 대신 스켈레톤) */
  isBootstrapping: boolean;
  /** 기본 `live` — soft refresh/ACK. `full`은 bootstrap·강제 전체 갱신 */
  revalidateFarmLive: (opts?: {
    mode?: FarmLiveRevalidateMode;
  }) => Promise<void>;
  patchAlarmSettings: (settings: AlarmSettings) => void;
  /** 적용 직후 thermoSettings·commands에 명령값 즉시 반영 (낙관적) */
  patchThermoFromCommand: (cmd: ThermoCommand) => void;
  hydrateScopedPanel: (data: FarmScopedPanelData) => void;
  /** Phase B — stall trend idle hydrate (SSR에서 제외) */
  hydrateStallTrend: (
    farmKey: FarmKey,
    trendByPeriod: Record<TrendPeriodId, TrendPeriodData>,
  ) => void;
};

const FarmLiveRefreshContext =
  createContext<FarmLiveRefreshContextValue | null>(null);

function sliceFromPanel(data: FarmScopedPanelData): FarmLiveSlice {
  return {
    readings: data.readings,
    barnSnapshots: data.barnSnapshots,
    gridCols: data.gridCols,
    gridRows: data.gridRows,
    trendByPeriod: data.trendByPeriod,
    controller: data.controller,
  };
}

function sliceFingerprint(slice: FarmLiveSlice): string {
  const alarm = slice.controller?.alarmSettings?.global;
  return [
    slice.readings.length,
    slice.readings[0]?.key ?? "",
    slice.readings[0]?.tempC ?? "",
    alarm?.tempLow ?? "",
    alarm?.tempHigh ?? "",
  ].join("|");
}

type ApplyPanelArgs = {
  farmId: string;
  data: FarmScopedPanelData;
  setSlice: React.Dispatch<React.SetStateAction<FarmLiveSlice>>;
  setAlarmPatch: React.Dispatch<React.SetStateAction<AlarmSettings | null>>;
  setThermoPatch: React.Dispatch<
    React.SetStateAction<Record<string, ControllerThermoSettings>>
  >;
};

function retainCardSlice(prev: FarmLiveSlice, next: FarmLiveSlice): FarmLiveSlice {
  const readings = retainLiveList(prev.readings, next.readings);
  const barnSnapshots = retainLiveList(prev.barnSnapshots, next.barnSnapshots);
  const controller = next.controller
    ? {
        ...next.controller,
        readings: retainLiveList(
          prev.controller?.readings ?? prev.readings,
          next.controller.readings,
        ),
      }
    : prev.controller;
  if (
    readings === next.readings &&
    barnSnapshots === next.barnSnapshots &&
    controller === next.controller
  ) {
    return next;
  }
  return { ...next, readings, barnSnapshots, controller };
}

function applyFreshPanel({
  farmId,
  data,
  setSlice,
  setAlarmPatch,
  setThermoPatch,
}: ApplyPanelArgs): void {
  setSlice((prev) => {
    const next = retainCardSlice(prev, sliceFromPanel(data));
    const merged: FarmLiveSlice =
      !hasStallTrendByPeriod(next.trendByPeriod) &&
      hasStallTrendByPeriod(prev.trendByPeriod)
        ? { ...next, trendByPeriod: prev.trendByPeriod }
        : next;
    setFarmPanelCache(farmId, farmPanelCacheFromSlice(data.farmKey, merged));
    return merged;
  });
  setAlarmPatch(null);
  setThermoPatch({});
  schedulePersistLayouts(data.layoutsToPersist);
}

type ApplyLiveArgs = {
  farmKey: FarmKey;
  data: FarmScopedLiveData;
  setSlice: React.Dispatch<React.SetStateAction<FarmLiveSlice>>;
  moduleAlarmsRef: React.MutableRefObject<AlarmRow[]>;
};

/** LIVE만 패치 — trend·alarm·command history·낙관적 patch 유지.
 *  readings/barnSnapshots는 측정값이 같으면 이전 참조 재사용.
 *  빈 응답은 기존 카드를 유지한다. */
function applyLivePatch({
  farmKey,
  data,
  setSlice,
  moduleAlarmsRef,
}: ApplyLiveArgs): void {
  let alarmSettings: AlarmSettings | undefined;
  let appliedReadings = data.readings;
  setSlice((prev) => {
    alarmSettings = prev.controller?.alarmSettings;
    const readings = mergeLiveReadings(prev.readings, data.readings);
    appliedReadings = readings;
    const barnSnapshots = mergeLiveBarnSnapshots(
      prev.barnSnapshots,
      data.barnSnapshots,
    );
    const gridUnchanged =
      prev.gridCols === data.gridCols && prev.gridRows === data.gridRows;
    const readingsUnchanged = readings === prev.readings;
    const barnsUnchanged = barnSnapshots === prev.barnSnapshots;

    const readingThermo = buildThermoSettingsFromReadings(data.readings);
    const nextController = prev.controller
      ? {
          ...prev.controller,
          readings: mergeLiveReadings(prev.controller.readings, data.readings),
          thermoSettings: mergeThermoSettingsMaps(
            prev.controller.thermoSettings,
            readingThermo,
          ),
        }
      : {
          readings,
          thermoSettings: readingThermo,
          commands: [],
          canCommand: false,
        };

    if (
      readingsUnchanged &&
      barnsUnchanged &&
      gridUnchanged &&
      prev.controller &&
      nextController.readings === prev.controller.readings &&
      nextController.thermoSettings === prev.controller.thermoSettings
    ) {
      return prev;
    }

    const next: FarmLiveSlice = {
      ...prev,
      readings,
      barnSnapshots,
      gridCols: data.gridCols,
      gridRows: data.gridRows,
      controller: nextController,
    };
    setFarmPanelCache(farmKeyId(farmKey), farmPanelCacheFromSlice(farmKey, next));
    return next;
  });
  schedulePersistLayouts(data.layoutsToPersist);
  moduleAlarmsRef.current = data.moduleAlarms;
  publishSituationFromRef(
    moduleAlarmsRef,
    appliedReadings,
    alarmSettings,
  );
}

function alarmSettingsFingerprint(
  settings: AlarmSettings | null | undefined,
): string {
  const g = settings?.global;
  if (!g) return "";
  return `${g.tempLow}|${g.tempHigh}|${g.humidityLow}|${g.humidityHigh}`;
}

function publishSituationFromRef(
  moduleAlarmsRef: React.MutableRefObject<AlarmRow[]>,
  readings: BarnReading[],
  settings?: AlarmSettings | null,
): void {
  publishShellAlarms(
    mergeSituationAlarms(
      moduleAlarmsRef.current,
      readings ?? [],
      settings,
    ),
  );
}

type ProviderProps = {
  farmKey: FarmKey | null;
  initial: FarmLiveSlice;
  children: React.ReactNode;
};

export function FarmLiveRefreshProvider({
  farmKey,
  initial,
  children,
}: ProviderProps) {
  const router = useRouter();
  const tourActive = useFarmTourActive();
  const [, startTransition] = useTransition();
  const [slice, setSlice] = useState<FarmLiveSlice>(() => {
    if (farmKey && initial.readings.length === 0) {
      const cached = getFarmPanelCache(farmKeyId(farmKey));
      if (cached) return sliceFromPanel(cached);
    }
    return initial;
  });
  const [revalidating, setRevalidating] = useState(false);
  const [isBootstrapping, setIsBootstrapping] = useState(() => {
    if (!farmKey || initial.readings.length > 0) return false;
    return !getFarmPanelCache(farmKeyId(farmKey));
  });
  const [alarmPatch, setAlarmPatch] = useState<AlarmSettings | null>(null);
  const [thermoPatch, setThermoPatch] = useState<
    Record<string, ControllerThermoSettings>
  >({});
  const revalidateSeq = useRef(0);
  const layoutsPersistOnceRef = useRef(false);
  const sliceRef = useRef(slice);
  const moduleAlarmsRef = useRef<AlarmRow[]>([]);
  useEffect(() => {
    sliceRef.current = slice;
  });

  // SSR panel에 실려 온 신규 SP 좌표 — 한 번만 idle persist
  useEffect(() => {
    if (layoutsPersistOnceRef.current) return;
    if (!initial.layoutsToPersist) return;
    layoutsPersistOnceRef.current = true;
    schedulePersistLayouts(initial.layoutsToPersist);
  }, [initial.layoutsToPersist]);

  const serverFingerprint = useMemo(() => sliceFingerprint(initial), [initial]);
  const farmId = farmKey ? farmKeyId(farmKey) : null;

  // Prop sync during render — initial/serverFingerprint 변경 시 slice 정렬
  const [prevSyncKey, setPrevSyncKey] = useState(
    () => `${farmId ?? ""}|${serverFingerprint}`,
  );
  const syncKey = `${farmId ?? ""}|${serverFingerprint}`;
  if (syncKey !== prevSyncKey) {
    setPrevSyncKey(syncKey);
    if (
      farmKey &&
      initial.readings.length === 0 &&
      slice.readings.length > 0
    ) {
      // keep client-hydrated slice while server still empty
      setIsBootstrapping(false);
    } else if (farmKey && initial.readings.length === 0) {
      const cached = getFarmPanelCache(farmKeyId(farmKey));
      if (cached) {
        setSlice(sliceFromPanel(cached));
        setIsBootstrapping(false);
      } else {
        setSlice(initial);
        setAlarmPatch(null);
        setThermoPatch({});
        setIsBootstrapping(true);
      }
    } else {
      const next =
        !hasStallTrendByPeriod(initial.trendByPeriod) &&
        hasStallTrendByPeriod(slice.trendByPeriod)
          ? { ...initial, trendByPeriod: slice.trendByPeriod }
          : initial;
      setSlice(next);
      setAlarmPatch(null);
      setThermoPatch({});
      if (farmKey && initial.readings.length > 0) {
        setIsBootstrapping(false);
      }
    }
  } else if (isBootstrapping && slice.readings.length > 0) {
    setIsBootstrapping(false);
  } else if (
    isBootstrapping &&
    (!farmKey || initial.readings.length > 0)
  ) {
    setIsBootstrapping(false);
  }

  // Cache write only — no setState (side effect of successful server payload)
  useEffect(() => {
    if (farmKey && initial.readings.length > 0) {
      setFarmPanelCache(
        farmKeyId(farmKey),
        farmPanelCacheFromSlice(farmKey, initial),
      );
    }
  }, [farmKey, serverFingerprint, initial]);

  const fetchAndApplyPanel = useCallback((key: FarmKey) => {
    const farmId = farmKeyId(key);
    let cancelled = false;
    void fetchFarmPanelEnrichShared(key)
      .then((data) => {
        if (cancelled) return;
        if (farmKeyId(data.farmKey) !== farmId) return;
        applyFreshPanel({
          farmId,
          data,
          setSlice,
          setAlarmPatch,
          setThermoPatch,
        });
        setIsBootstrapping(false);
      })
      .catch(() => {
        /* cold bootstrap / hub warm — 실패 시 기존 slice 유지 */
        if (!cancelled) setIsBootstrapping(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  /** Admin defer — readings 없이 진입 시 cold bootstrap (async only) */
  useEffect(() => {
    if (!farmKey || initial.readings.length > 0) return;
    if (sliceRef.current.readings.length > 0) return;
    if (getFarmPanelCache(farmKeyId(farmKey))) return;
    return fetchAndApplyPanel(farmKey);
  }, [farmKey, fetchAndApplyPanel, initial.readings.length]);

  const patchAlarmSettings = useCallback((settings: AlarmSettings) => {
    setAlarmPatch(settings);
    setSlice((prev) =>
      prev.controller
        ? {
            ...prev,
            controller: { ...prev.controller, alarmSettings: settings },
          }
        : prev,
    );
  }, []);

  const patchThermoFromCommand = useCallback(
    (cmd: ThermoCommand) => {
      const key = thermoSettingsKey(
        cmd.farmKey,
        cmd.moduleUid,
        cmd.controllerKey,
        cmd.channel,
      );
      const settings = settingsFromCommand(cmd);
      setThermoPatch((prev) => ({ ...prev, [key]: settings }));
      setSlice((prev) => {
        if (!prev.controller) return prev;
        const thermoSettings = {
          ...prev.controller.thermoSettings,
          [key]: settings,
        };
        const commands = [
          cmd,
          ...prev.controller.commands.filter((c) => c.id !== cmd.id),
        ];
        const next: FarmLiveSlice = {
          ...prev,
          controller: { ...prev.controller, thermoSettings, commands },
        };
        if (farmKey) {
          setFarmPanelCache(
            farmKeyId(farmKey),
            farmPanelCacheFromSlice(farmKey, next),
          );
        }
        return next;
      });
    },
    [farmKey],
  );

  const hydrateScopedPanel = useCallback((data: FarmScopedPanelData) => {
    // skip 시 캐시도 갱신하지 않음 — UI·캐시 신선도 불일치 방지
    if (shouldSkipScopedPanelHydrate(sliceRef.current, data)) return;
    setSlice((prev) => {
      const next = retainCardSlice(prev, sliceFromPanel(data));
      const merged: FarmLiveSlice =
        !hasStallTrendByPeriod(next.trendByPeriod) &&
        hasStallTrendByPeriod(prev.trendByPeriod)
          ? { ...next, trendByPeriod: prev.trendByPeriod }
          : next;
      setFarmPanelCache(
        farmKeyId(data.farmKey),
        farmPanelCacheFromSlice(data.farmKey, merged),
      );
      return merged;
    });
    setAlarmPatch(null);
    setThermoPatch({});
    setIsBootstrapping(false);
    schedulePersistLayouts(data.layoutsToPersist);
  }, []);

  const hydrateStallTrend = useCallback(
    (
      key: FarmKey,
      trendByPeriod: Record<TrendPeriodId, TrendPeriodData>,
    ) => {
      if (farmKey && farmKeyId(farmKey) !== farmKeyId(key)) return;
      setSlice((prev) => {
        const next: FarmLiveSlice = { ...prev, trendByPeriod };
        setFarmPanelCache(
          farmKeyId(key),
          farmPanelCacheFromSlice(key, next),
        );
        return next;
      });
    },
    [farmKey],
  );

  /** Admin hub — readings만 있는 slice에 thermo·alarm 패널 데이터 보강 */
  useEffect(() => {
    if (tourActive) return;
    if (!farmKey || initial.readings.length === 0) return;
    if (hasThermoSettings(sliceRef.current.controller?.thermoSettings)) {
      return;
    }
    return fetchAndApplyPanel(farmKey);
  }, [farmKey, fetchAndApplyPanel, initial.readings.length, tourActive]);

  const revalidateFarmLive = useCallback(
    async (opts?: { mode?: FarmLiveRevalidateMode }) => {
      if (!farmKey) {
        startTransition(() => scheduleSafeRouterRefresh(router));
        return;
      }
      const mode = opts?.mode ?? "live";
      const farmId = farmKeyId(farmKey);
      const seq = ++revalidateSeq.current;
      setRevalidating(true);
      try {
        await revalidateFarmLiveAction(farmKey);
        if (mode === "full") {
          const fresh = await fetchFarmPanelEnrichShared(farmKey);
          if (seq !== revalidateSeq.current) return;
          applyFreshPanel({
            farmId,
            data: fresh,
            setSlice,
            setAlarmPatch,
            setThermoPatch,
          });
          const moduleAlarms = await fetchActiveModuleAlarmsAction(farmKey);
          if (seq !== revalidateSeq.current) return;
          moduleAlarmsRef.current = moduleAlarms;
          publishShellAlarms(
            mergeSituationAlarms(
              moduleAlarms,
              fresh.readings ?? [],
              fresh.controller?.alarmSettings,
            ),
          );
          return;
        }
        const live = await fetchFarmLiveShared(farmKey);
        if (seq !== revalidateSeq.current) return;
        applyLivePatch({
          farmKey,
          data: live,
          setSlice,
          moduleAlarmsRef,
        });
      } catch {
        if (seq !== revalidateSeq.current) return;
        try {
          const live = await fetchFarmLiveShared(farmKey);
          if (seq !== revalidateSeq.current) return;
          applyLivePatch({
            farmKey,
            data: live,
            setSlice,
            moduleAlarmsRef,
          });
        } catch {
          /* 마지막 good slice 유지 — 다음 poll에서 재시도. router.refresh는 RSC 경합 유발 */
        }
      } finally {
        if (seq === revalidateSeq.current) setRevalidating(false);
      }
    },
    [farmKey, router],
  );

  useEffect(() => {
    registerFarmLiveRefreshHandler(() => revalidateFarmLive());
    return () => registerFarmLiveRefreshHandler(null);
  }, [revalidateFarmLive]);

  const mergedSlice = useMemo(() => {
    if (!slice.controller) return slice;
    const hasThermo = Object.keys(thermoPatch).length > 0;
    if (!alarmPatch && !hasThermo) return slice;
    return {
      ...slice,
      controller: {
        ...slice.controller,
        ...(alarmPatch ? { alarmSettings: alarmPatch } : {}),
        ...(hasThermo
          ? {
              thermoSettings: {
                ...slice.controller.thermoSettings,
                ...thermoPatch,
              },
            }
          : {}),
      },
    };
  }, [alarmPatch, thermoPatch, slice]);

  const situationSettingsFp = alarmSettingsFingerprint(
    alarmPatch ?? slice.controller?.alarmSettings,
  );

  /** TopBar — 모듈 에러 + LIVE 통신두절·알람값 초과·권장 이탈 */
  useEffect(() => {
    if (!farmKey) {
      moduleAlarmsRef.current = [];
      clearShellAlarms();
      return;
    }
    let cancelled = false;
    void fetchActiveModuleAlarmsAction(farmKey)
      .then((rows) => {
        if (cancelled) return;
        moduleAlarmsRef.current = rows;
        publishSituationFromRef(
          moduleAlarmsRef,
          sliceRef.current.readings ?? [],
          alarmPatch ?? sliceRef.current.controller?.alarmSettings,
        );
      })
      .catch(() => {
        if (!cancelled) {
          moduleAlarmsRef.current = [];
          clearShellAlarms();
        }
      });
    return () => {
      cancelled = true;
    };
    // readings/settings는 아래 effect에서 merge
    // eslint-disable-next-line react-hooks/exhaustive-deps -- farmKey only for fetch
  }, [farmKey]);

  useEffect(() => {
    if (!farmKey) return;
    publishSituationFromRef(
      moduleAlarmsRef,
      sliceRef.current.readings ?? [],
      alarmPatch ?? sliceRef.current.controller?.alarmSettings,
    );
    // alarmPatch·settings 객체 식별자는 situationSettingsFp로만 본다.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fingerprint
  }, [farmKey, slice.readings, situationSettingsFp]);

  /** LIVE + 모듈 경보 — 탭 visible 시 주기 갱신 (모바일 push 대비) */
  useEffect(() => {
    if (!farmKey || tourActive) return;
    const tick = () => {
      if (document.visibilityState !== "visible") return;
      void revalidateFarmLive({ mode: "live" });
    };
    const onVis = () => {
      if (document.visibilityState === "visible") tick();
    };
    const id = window.setInterval(tick, FARM_LIVE_POLL_MS);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [farmKey, revalidateFarmLive, tourActive]);

  useEffect(() => () => clearShellAlarms(), []);

  const value = useMemo(
    (): FarmLiveRefreshContextValue => ({
      farmKey,
      slice: mergedSlice,
      revalidating,
      isStale: revalidating && slice.readings.length > 0,
      isBootstrapping,
      revalidateFarmLive,
      patchAlarmSettings,
      patchThermoFromCommand,
      hydrateScopedPanel,
      hydrateStallTrend,
    }),
    [
      farmKey,
      mergedSlice,
      patchAlarmSettings,
      patchThermoFromCommand,
      hydrateScopedPanel,
      hydrateStallTrend,
      revalidateFarmLive,
      revalidating,
      isBootstrapping,
      slice.readings.length,
    ],
  );

  return (
    <FarmLiveRefreshContext.Provider value={value}>
      {children}
    </FarmLiveRefreshContext.Provider>
  );
}

export function useFarmLiveRefresh(): FarmLiveRefreshContextValue {
  const ctx = useContext(FarmLiveRefreshContext);
  if (!ctx) {
    throw new Error(
      "useFarmLiveRefresh must be used within FarmLiveRefreshProvider",
    );
  }
  return ctx;
}

/** Provider 밖 — optional fallback (hub embed 등) */
export function useFarmLiveRefreshOptional(): FarmLiveRefreshContextValue | null {
  return useContext(FarmLiveRefreshContext);
}

/** FarmScopedPanel — 모듈 캐시 warm */
export function warmFarmPanelCache(
  farmId: string,
  data: FarmScopedPanelData,
): void {
  setFarmPanelCache(farmId, data);
}

export function readFarmPanelCache(
  farmId: string,
): FarmScopedPanelData | undefined {
  return getFarmPanelCache(farmId);
}

