"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useSearchParams } from "next/navigation";
import type { BarnMapSnapshot, BarnReading } from "@/lib/data/iot";
import {
  farmTrendIdleExtends30d,
  type TrendPeriodData,
  type TrendPeriodId,
} from "@/lib/domain/farm-trend-types";
import {
  firstControllerKeyForBarn,
  readingsMatchingBarn,
} from "@/components/farm/farm-field-status-grid";
import {
  currentFarmSearchParams,
  resolveListLayoutParam,
  resolveListViewMode,
  resolveTrendPeriodParam,
  type FarmHubView,
} from "@/lib/farm/farm-view-url";
import { resolveFarmChartLabSelection } from "@/lib/farm/farm-chart-scope";
import { useFarmHubViewShell } from "@/components/farm/use-farm-hub-view-shell";
import { farmFieldMergeEnabled } from "@/lib/farm/farm-field-merge-enabled";
import { isScopedControllerEnriched } from "@/lib/farm/farm-scoped-panel-utils";
import type { ControllerGridData } from "@/lib/farm/controller-grid-data";
import {
  farmKeyId,
  parseFarmKeyId,
  type FarmKey,
} from "@/lib/domain/farm-key";
import {
  invalidateFarmControllerTrendCache,
  prefetchFarmControllerTrend,
  useFarmControllerTrend,
} from "@/components/farm/use-farm-controller-trend";
import {
  invalidateFarmStallTrendCache,
  prefetchFarmStallTrend,
} from "@/components/farm/use-farm-stall-trend";
import { fetchFarmScopedPanelDataAction } from "@/app/(dashboard)/farm/actions";
import { fetchFarmPanelEnrichShared } from "@/lib/farm/fetch-farm-panel-enrich";
import {
  readFarmPanelCache,
  useFarmLiveRefreshOptional,
} from "@/components/farm/farm-live-refresh";
import { useHydrationSafeDashboardCompact } from "@/components/layout/dashboard-viewport-context";
import {
  PC_RAIL_OPEN_MIN_PX,
  pcWidthBand,
} from "@/lib/ui/layout-breakpoints";
import { useFieldListFilterMotion } from "@/components/farm/use-field-list-filter-motion";
import { useFarmTourActive } from "@/lib/onboarding/use-farm-tour-active";
import { useFarmPageChartActions } from "@/components/farm/use-farm-page-chart-actions";

export type FarmPageContentStateInput = {
  readings: BarnReading[];
  barnSnapshots: BarnMapSnapshot[];
  trendByPeriod?: Record<TrendPeriodId, TrendPeriodData> | null;
  controller?: ControllerGridData | null;
  hubMode: boolean;
  hideViewTabs: boolean;
  hubUrlEpoch: number;
  onHubUrlChange?: () => void;
  gridCompactShell: boolean;
  liveRefreshManaged: boolean;
  lazyListEnrichment: boolean;
  initialHubView?: FarmHubView;
  lazyListFarmKey: FarmKey | null;
};

export function useFarmPageContentState({
  readings,
  barnSnapshots,
  hubMode,
  hideViewTabs,
  hubUrlEpoch,
  onHubUrlChange,
  lazyListEnrichment,
  lazyListFarmKey,
  initialHubView,
}: FarmPageContentStateInput) {
  const viewportCompact = useHydrationSafeDashboardCompact();
  const tourActive = useFarmTourActive();
  const searchParams = useSearchParams();
  const liveRefresh = useFarmLiveRefreshOptional();
  const liveRefreshRef = useRef(liveRefresh);
  useEffect(() => {
    liveRefreshRef.current = liveRefresh;
  });
  const enrichFarmRef = useRef<string | null>(null);
  const enrichGenRef = useRef(0);
  const tourActiveRef = useRef(tourActive);
  useEffect(() => {
    tourActiveRef.current = tourActive;
  });

  const tablistRef = useRef<HTMLDivElement>(null);
  const [tabPill, setTabPill] = useState({ left: 0, width: 0 });
  /** TopBar 보기 토글 슬롯 — undefined=미확인, null=없음, Element=portal */
  const [scopeToggleSlot, setScopeToggleSlot] = useState<
    Element | null | undefined
  >(undefined);

  useEffect(() => {
    if (hideViewTabs || !hubMode) {
      queueMicrotask(() => setScopeToggleSlot(null));
      return;
    }
    const attr = viewportCompact ? "mobile" : "desktop";
    queueMicrotask(() => {
      setScopeToggleSlot(
        document.querySelector(`[data-farm-view-toggle-slot="${attr}"]`),
      );
    });
  }, [hideViewTabs, hubMode, viewportCompact]);

  const gridFarmKey = useMemo<FarmKey | null>(() => {
    const first = readings[0]?.farmKey ?? null;
    if (!first) return null;
    const firstId = farmKeyId(first);
    const allSame = readings.every(
      (r) => r.farmKey && farmKeyId(r.farmKey) === firstId,
    );
    return allSame ? first : null;
  }, [readings]);

  const keepAliveFarmId = gridFarmKey ? farmKeyId(gridFarmKey) : "";
  const prevTrendFarmIdRef = useRef(keepAliveFarmId);

  useEffect(() => {
    const prev = prevTrendFarmIdRef.current;
    if (prev && prev !== keepAliveFarmId) {
      const left = parseFarmKeyId(prev);
      if (left) {
        invalidateFarmStallTrendCache(left);
        invalidateFarmControllerTrendCache(left);
      }
    }
    prevTrendFarmIdRef.current = keepAliveFarmId;
  }, [keepAliveFarmId]);

  const enrichListIfNeeded = useCallback(async () => {
    if (!lazyListEnrichment || !lazyListFarmKey) return;
    if (tourActiveRef.current) return;

    const lr = liveRefreshRef.current;
    if (!lr) return;

    const sliceController = lr.slice.controller;
    if (isScopedControllerEnriched(sliceController)) return;

    const farmId = farmKeyId(lazyListFarmKey);
    const cached = readFarmPanelCache(farmId);
    if (cached && isScopedControllerEnriched(cached.controller)) {
      lr.hydrateScopedPanel(cached);
      return;
    }

    const gen = ++enrichGenRef.current;
    try {
      const data = await fetchFarmPanelEnrichShared(
        lazyListFarmKey,
        fetchFarmScopedPanelDataAction,
      );
      if (gen !== enrichGenRef.current) return;
      if (farmKeyId(data.farmKey) !== farmId) return;
      liveRefreshRef.current?.hydrateScopedPanel(data);
    } catch {
      // 목록은 grid readings로 제한 표시 — enrich 실패해도 기존 카드 유지
    }
  }, [lazyListEnrichment, lazyListFarmKey]);

  const {
    view,
    viewSlide,
    urlHydrated,
    urlTick,
    setUrlTick,
    listEverOpened,
    chartEverOpened,
    setView,
  } = useFarmHubViewShell({
    hubMode,
    hubUrlEpoch,
    onHubUrlChange,
    initialHubView,
    searchParams,
    keepAliveFarmId,
    onOpenList: () => {
      void enrichListIfNeeded();
    },
  });

  const fieldMerge = farmFieldMergeEnabled();
  const fieldActive = view === "map" || view === "list";
  const [fieldFocusCtrl, setFieldFocusCtrl] = useState<string | null>(null);
  const [fieldSelectedBarnId, setFieldSelectedBarnId] = useState<string | null>(
    null,
  );
  /** PC 스플릿 — 좌측 현황 열. 1280px 미만은 접힌 채로 시작한다. */
  const [fieldStatusOpen, setFieldStatusOpenState] = useState(true);
  const railToggledRef = useRef(false);
  const setFieldStatusOpen = useCallback((open: boolean) => {
    railToggledRef.current = true;
    document.documentElement.dataset.fieldRailUser = "1";
    setFieldStatusOpenState(open);
  }, []);

  useLayoutEffect(() => {
    const sync = () => {
      document.documentElement.dataset.pcBand = pcWidthBand(window.innerWidth);
      if (railToggledRef.current) return;
      setFieldStatusOpenState(window.innerWidth >= PC_RAIL_OPEN_MIN_PX);
    };
    sync();
    window.addEventListener("resize", sync);
    return () => window.removeEventListener("resize", sync);
  }, []);

  const selectBarnForList = useCallback(
    (barn: BarnMapSnapshot) => {
      setFieldSelectedBarnId((prev) => {
        if (prev === barn.meta.id) {
          setFieldFocusCtrl(null);
          return null;
        }
        const key = firstControllerKeyForBarn(barn, readings);
        setFieldFocusCtrl(null);
        if (key) {
          requestAnimationFrame(() => {
            setFieldFocusCtrl(key);
          });
        }
        return barn.meta.id;
      });
    },
    [readings],
  );

  const clearFieldBarnFilter = useCallback(() => {
    setFieldSelectedBarnId(null);
    setFieldFocusCtrl(null);
  }, []);

  const fieldListReadings = useMemo(() => {
    if (!fieldMerge || !fieldSelectedBarnId) return readings;
    const barn = barnSnapshots.find((b) => b.meta.id === fieldSelectedBarnId);
    if (!barn) return readings;
    return readingsMatchingBarn(barn, readings);
  }, [fieldMerge, fieldSelectedBarnId, barnSnapshots, readings]);

  const fieldFilterKey = fieldSelectedBarnId ?? "all";
  const {
    displayRows: fieldMotionRows,
    phase: fieldFilterPhase,
    enterEpoch: fieldFilterEnterEpoch,
  } = useFieldListFilterMotion(fieldFilterKey, fieldListReadings);

  useEffect(() => {
    if (!fieldMerge || !fieldActive) return;
    void enrichListIfNeeded();
  }, [fieldMerge, fieldActive, enrichListIfNeeded]);

  useEffect(() => {
    enrichGenRef.current += 1;
  }, [lazyListFarmKey]);

  useEffect(() => {
    enrichFarmRef.current = null;
  }, [lazyListFarmKey]);

  /** LIVE 안정 후 — 24시간 추이는 스플래시와 겹치게 즉시. 30일은 차트 탭·idle */
  useEffect(() => {
    if (!gridFarmKey || tourActive) return;
    void prefetchFarmControllerTrend(gridFarmKey);
  }, [gridFarmKey, tourActive]);

  useEffect(() => {
    if (!gridFarmKey || tourActive) return;
    let cancelled = false;
    let idleId = 0;
    const run = () => {
      if (cancelled) return;
      if (
        view === "map" ||
        view === "chart" ||
        view === "list"
      ) {
        void prefetchFarmStallTrend(
          gridFarmKey,
          (trend) => {
            if (cancelled) return;
            liveRefreshRef.current?.hydrateStallTrend(gridFarmKey, trend);
          },
          { extend30d: farmTrendIdleExtends30d(view) },
        );
      }
      if (view === "list" || (fieldMerge && view === "map")) {
        void enrichListIfNeeded();
      }
    };
    const ric =
      typeof window !== "undefined" && "requestIdleCallback" in window
        ? window.requestIdleCallback.bind(window)
        : null;
    if (ric) {
      idleId = ric(run, { timeout: 2500 });
    } else {
      idleId = window.setTimeout(run, 600);
    }
    return () => {
      cancelled = true;
      if (ric && "cancelIdleCallback" in window) {
        window.cancelIdleCallback(idleId);
      } else {
        window.clearTimeout(idleId);
      }
    };
  }, [gridFarmKey, tourActive, enrichListIfNeeded, view, fieldMerge]);

  useEffect(() => {
    if (!lazyListEnrichment || !lazyListFarmKey) return;
    if (tourActive) return;
    if (view !== "list") return;

    const farmId = farmKeyId(lazyListFarmKey);
    if (enrichFarmRef.current === farmId) return;
    if (isScopedControllerEnriched(liveRefresh?.slice.controller)) {
      enrichFarmRef.current = farmId;
      return;
    }

    enrichFarmRef.current = farmId;
    void enrichListIfNeeded();
  // eslint-disable-next-line react-hooks/exhaustive-deps -- 의도적 생략
  }, [
    lazyListEnrichment,
    lazyListFarmKey,
    tourActive,
    view,
    liveRefresh?.slice.controller?.alarmSettings,
    liveRefresh?.slice.controller?.thermoSettings,
    enrichListIfNeeded,
  ]);

  const wasTourActiveRef = useRef(false);
  useEffect(() => {
    const wasActive = wasTourActiveRef.current;
    wasTourActiveRef.current = tourActive;
    if (tourActive || !wasActive) return;
    if (!listEverOpened && view !== "list") return;
    if (!lazyListEnrichment || !lazyListFarmKey) return;
    if (isScopedControllerEnriched(liveRefresh?.slice.controller)) return;
    enrichFarmRef.current = null;
    queueMicrotask(() => {
      void enrichListIfNeeded();
    });
  }, [
    tourActive,
    listEverOpened,
    view,
    lazyListEnrichment,
    lazyListFarmKey,
    liveRefresh?.slice.controller,
    enrichListIfNeeded,
  ]);

  const shallowParams = useMemo(() => {
    void urlTick;
    void hubUrlEpoch;
    if (!urlHydrated) {
      return new URLSearchParams(searchParams.toString());
    }
    return currentFarmSearchParams();
  }, [urlHydrated, hubUrlEpoch, urlTick, searchParams]);
  const trendPeriod = useMemo(
    () => resolveTrendPeriodParam(shallowParams),
    [shallowParams],
  );

  const {
    data: gridControllerTrend,
    loading: gridTrendLoading,
    isStale: gridTrendStale,
    error: gridTrendError,
    window15m: gridTrendWindow15m,
    extending: gridTrendExtending,
    window15mLoading: gridTrendWindowLoading,
    ensureWindow15m: ensureGridTrendWindow15m,
  } = useFarmControllerTrend({
      farmKey: gridFarmKey,
      enabled:
        Boolean(gridFarmKey) &&
        (view === "map" ||
          view === "chart" ||
          view === "list"),
      extend30d: view === "chart",
    });

  const urlCtrl = shallowParams.get("ctrl");
  const listSp =
    fieldMerge || view === "list"
      ? shallowParams.get("sp") ?? undefined
      : undefined;
  const listMode = useMemo(() => {
    return resolveListViewMode(shallowParams, "controller");
  }, [shallowParams]);
  const listLayout = resolveListLayoutParam(shallowParams);
  const chartLabSelection = useMemo(
    () => resolveFarmChartLabSelection(shallowParams),
    [shallowParams],
  );

  const {
    onTrendPeriodChange,
    onOpenControllerChart,
    onChartLabSelectionChange,
  } = useFarmPageChartActions({ view, setView, setUrlTick });

  return {
    viewportCompact,
    tablistRef,
    tabPill,
    scopeToggleSlot,
    view,
    viewSlide,
    setView,
    listEverOpened,
    chartEverOpened,
    fieldMerge,
    fieldActive,
    fieldFocusCtrl,
    fieldStatusOpen,
    setFieldStatusOpen,
    selectBarnForList,
    clearFieldBarnFilter,
    fieldSelectedBarnId,
    fieldMotionRows,
    fieldFilterPhase,
    fieldFilterEnterEpoch,
    enrichListIfNeeded,
    keepAliveFarmId,
    gridFarmKey,
    trendPeriod,
    gridControllerTrend,
    gridTrendLoading,
    gridTrendStale,
    gridTrendError,
    gridTrendWindow15m,
    gridTrendExtending,
    gridTrendWindowLoading,
    ensureGridTrendWindow15m,
    urlCtrl,
    listSp,
    listMode,
    listLayout,
    chartLabSelection,
    onTrendPeriodChange,
    onOpenControllerChart,
    onChartLabSelectionChange,
    setTabPill,
  };
}
