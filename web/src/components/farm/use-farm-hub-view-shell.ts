"use client";

/**
 * `/farm` 허브 탭 state · URL sync · keep-alive 마운트 TTL.
 * 계약: docs/farm-hub-url.md — epoch 이중 구조·기간 변경 시 hub bump 금지 유지.
 */
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import type { ReadonlyURLSearchParams } from "next/navigation";
import {
  applyHubScopedViewParams,
  applyMapGridParams,
  applyChartViewParams,
  currentFarmSearchParams,
  isFarmChartWorkspaceView,
  normalizeLegacyListModeParam,
  publishLiveFarmHubView,
  replaceFarmUrlShallow,
  resolveFarmHubView,
  subscribeFarmHubViewResync,
  type FarmHubView,
} from "@/lib/farm/farm-view-url";
import {
  canUnmountKeepAlivePanel,
  FARM_HUB_KEEPALIVE_PANELS,
  FARM_HUB_KEEPALIVE_TTL_MS,
  keepAliveFlagsForActiveView,
  keepAliveRemainingMs,
  nextPanelInactiveSince,
  type FarmHubKeepAlivePanel,
} from "@/lib/farm/farm-hub-keepalive";

const FARM_HUB_VIEW_ORDER: Record<FarmHubView, number> = {
  map: 0,
  list: 1,
  chart: 2,
  chartlab: 2,
  aria: 3,
};

/** globals.css farm-view-slide-* (moderate enter + exit) */
export const FARM_VIEW_SLIDE_MS = 280;

export type FarmViewSlide = {
  from: FarmHubView;
  to: FarmHubView;
  dir: 1 | -1;
};

export type UseFarmHubViewShellArgs = {
  hubMode: boolean;
  hubUrlEpoch: number;
  onHubUrlChange?: () => void;
  initialHubView?: FarmHubView;
  searchParams: ReadonlyURLSearchParams;
  /** 농장 키 id — 변경 시 비활성 keep-alive flush */
  keepAliveFarmId: string;
  /** 목록 탭 진입 시 (enrich 등) */
  onOpenList?: () => void;
};

export type FarmHubViewShell = {
  view: FarmHubView;
  viewSlide: FarmViewSlide | null;
  urlHydrated: boolean;
  urlTick: number;
  setUrlTick: Dispatch<SetStateAction<number>>;
  listEverOpened: boolean;
  chartEverOpened: boolean;
  setView: (next: FarmHubView) => void;
  setTourView: (next: FarmHubView) => void;
};

export function useFarmHubViewShell({
  hubMode,
  hubUrlEpoch,
  onHubUrlChange,
  initialHubView,
  searchParams,
  keepAliveFarmId,
  onOpenList,
}: UseFarmHubViewShellArgs): FarmHubViewShell {
  const onOpenListRef = useRef(onOpenList);
  useEffect(() => {
    onOpenListRef.current = onOpenList;
  });

  const [urlHydrated, setUrlHydrated] = useState(false);
  const bootstrapView: FarmHubView =
    initialHubView ?? resolveFarmHubView(searchParams.get("view"));
  const [view, setViewState] = useState<FarmHubView>(bootstrapView);
  const [viewSlide, setViewSlide] = useState<FarmViewSlide | null>(null);
  const [listEverOpened, setListEverOpened] = useState(bootstrapView === "list");
  const [chartEverOpened, setChartEverOpened] = useState(
    bootstrapView === "chart" || bootstrapView === "chartlab",
  );
  const [panelInactiveSince, setPanelInactiveSince] = useState<
    Partial<Record<FarmHubKeepAlivePanel, number>>
  >({});
  const prevViewForKeepAliveRef = useRef(bootstrapView);
  const prevKeepAliveFarmIdRef = useRef("");
  const [keepAliveVisTick, setKeepAliveVisTick] = useState(0);
  const [urlTick, setUrlTick] = useState(0);

  const beginViewSlide = useCallback((from: FarmHubView, to: FarmHubView) => {
    if (from === to) return;
    if (
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      setViewSlide(null);
      return;
    }
    const dir: 1 | -1 =
      FARM_HUB_VIEW_ORDER[to] >= FARM_HUB_VIEW_ORDER[from] ? 1 : -1;
    setViewSlide({ from, to, dir });
  }, [setViewSlide]);

  const syncViewFromUrl = useCallback(
    (opts?: {
      viewRaw?: string | null;
      animate?: boolean;
      bumpUrlTick?: boolean;
    }) => {
      if (hubMode && opts?.viewRaw === undefined) {
        const params = currentFarmSearchParams();
        let rewritten = normalizeLegacyListModeParam(params);
        const raw = params.get("view");
        if (
          raw === "aria" ||
          raw === "jarvis" ||
          raw === "plan" ||
          raw === "model"
        ) {
          applyMapGridParams(params);
          rewritten = true;
        }
        if (params.get("view") === "chartlab") {
          applyChartViewParams(params);
          rewritten = true;
        }
        if (rewritten) {
          replaceFarmUrlShallow(params);
          setUrlTick((n) => n + 1);
        }
      }
      const next = resolveFarmHubView(
        opts?.viewRaw !== undefined
          ? opts.viewRaw
          : currentFarmSearchParams().get("view"),
      );
      const animate = opts?.animate ?? true;
      setViewState((prev) => {
        if (prev === next) return prev;
        if (animate) {
          queueMicrotask(() => beginViewSlide(prev, next));
        }
        return next;
      });
      if (next === "list") setListEverOpened(true);
      if (next === "chart" || next === "chartlab") setChartEverOpened(true);
      if (opts?.bumpUrlTick) setUrlTick((n) => n + 1);
    },
    [beginViewSlide, hubMode],
  );

  useEffect(() => {
    queueMicrotask(() => setUrlHydrated(true));
  }, []);

  const hubViewSyncedOnceRef = useRef(false);
  useEffect(() => {
    if (!urlHydrated) return;
    const first = !hubViewSyncedOnceRef.current;
    hubViewSyncedOnceRef.current = true;
    queueMicrotask(() =>
      syncViewFromUrl({ animate: Boolean(hubMode && !first) }),
    );
  }, [urlHydrated, hubMode, hubUrlEpoch, syncViewFromUrl]);

  useEffect(() => {
    if (!hubMode) return;
    return subscribeFarmHubViewResync(() => {
      queueMicrotask(() =>
        syncViewFromUrl({ animate: true, bumpUrlTick: true }),
      );
    });
  }, [hubMode, syncViewFromUrl]);

  const [lastViewParam, setLastViewParam] = useState<string | null>(
    () => searchParams.get("view"),
  );
  const viewParam = searchParams.get("view");
  if (!hubMode && viewParam !== lastViewParam) {
    setLastViewParam(viewParam);
    syncViewFromUrl({ viewRaw: viewParam, animate: true });
  }

  if (view === "list" && !listEverOpened) {
    setListEverOpened(true);
  }
  if ((view === "chart" || view === "chartlab") && !chartEverOpened) {
    setChartEverOpened(true);
  }

  useLayoutEffect(() => {
    publishLiveFarmHubView(view);
  }, [view]);

  useEffect(() => {
    const from = prevViewForKeepAliveRef.current;
    const to = view;
    if (from === to) return;
    prevViewForKeepAliveRef.current = to;
    setPanelInactiveSince((prev) =>
      nextPanelInactiveSince(prev, from, to, Date.now()),
    );
  }, [view]);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible") {
        setKeepAliveVisTick((n) => n + 1);
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  useEffect(() => {
    if (!keepAliveFarmId) return;
    const prev = prevKeepAliveFarmIdRef.current;
    if (prev === keepAliveFarmId) return;
    const hadPrev = prev !== "";
    prevKeepAliveFarmIdRef.current = keepAliveFarmId;
    if (!hadPrev) return;
    const flags = keepAliveFlagsForActiveView(view);
    setListEverOpened(flags.list);
    setChartEverOpened(flags.chart);
    setPanelInactiveSince({});
  }, [keepAliveFarmId, view]);

  const applyViewChange = useCallback(
    (next: FarmHubView) => {
      const target: FarmHubView =
        next === "aria"
          ? "map"
          : next === "chartlab"
            ? "chart"
            : next;
      if (target === "list") {
        setListEverOpened(true);
        onOpenListRef.current?.();
      }
      if (isFarmChartWorkspaceView(target)) {
        setChartEverOpened(true);
      }
      beginViewSlide(view, target);
      setViewState(target);
      publishLiveFarmHubView(target);
      if (hubMode) {
        const params = new URLSearchParams(
          currentFarmSearchParams().toString(),
        );
        applyHubScopedViewParams(params, target);
        replaceFarmUrlShallow(params);
        onHubUrlChange?.();
        setUrlTick((n) => n + 1);
        return;
      }
      const params = new URLSearchParams(currentFarmSearchParams().toString());
      params.delete("tab");
      if (target === "list") {
        params.set("view", "list");
      } else if (isFarmChartWorkspaceView(target)) {
        params.set("view", "chart");
        params.delete("listMode");
      } else {
        params.delete("view");
        params.delete("listMode");
      }
      replaceFarmUrlShallow(params);
      setUrlTick((n) => n + 1);
    },
    [hubMode, onHubUrlChange, beginViewSlide, view],
  );

  const setView = useCallback(
    (next: FarmHubView) => {
      applyViewChange(next);
    },
    [applyViewChange],
  );

  const setTourView = useCallback(
    (next: FarmHubView) => {
      applyViewChange(next);
    },
    [applyViewChange],
  );

  useEffect(() => {
    if (!viewSlide) return;
    const t = window.setTimeout(() => setViewSlide(null), FARM_VIEW_SLIDE_MS);
    return () => window.clearTimeout(t);
  }, [viewSlide]);

  const keepAliveViewRef = useRef(view);
  const keepAliveSlideRef = useRef(viewSlide);
  useEffect(() => {
    keepAliveViewRef.current = view;
    keepAliveSlideRef.current = viewSlide;
  });

  useEffect(() => {
    void keepAliveVisTick;
    const timers: number[] = [];
    const now = Date.now();
    const openedOf = (panel: FarmHubKeepAlivePanel) =>
      panel === "list" ? listEverOpened : chartEverOpened;
    const clearOf = (panel: FarmHubKeepAlivePanel) => {
      if (panel === "list") setListEverOpened(false);
      else setChartEverOpened(false);
      setPanelInactiveSince((prev) => {
        if (prev[panel] == null) return prev;
        const next = { ...prev };
        delete next[panel];
        return next;
      });
    };

    for (const panel of FARM_HUB_KEEPALIVE_PANELS) {
      if (!openedOf(panel)) continue;
      if (
        !canUnmountKeepAlivePanel(
          panel,
          keepAliveViewRef.current,
          keepAliveSlideRef.current,
        )
      ) {
        continue;
      }
      const leftAt = panelInactiveSince[panel];
      if (leftAt == null) continue;
      const delay = keepAliveRemainingMs(
        leftAt,
        now,
        FARM_HUB_KEEPALIVE_TTL_MS[panel],
      );
      timers.push(
        window.setTimeout(() => {
          if (
            !canUnmountKeepAlivePanel(
              panel,
              keepAliveViewRef.current,
              keepAliveSlideRef.current,
            )
          ) {
            return;
          }
          clearOf(panel);
        }, delay),
      );
    }
    return () => {
      for (const t of timers) window.clearTimeout(t);
    };
  }, [
    view,
    viewSlide,
    listEverOpened,
    chartEverOpened,
    panelInactiveSince,
    keepAliveVisTick,
  ]);

  return {
    view,
    viewSlide,
    urlHydrated,
    urlTick,
    setUrlTick,
    listEverOpened,
    chartEverOpened,
    setView,
    setTourView,
  };
}
