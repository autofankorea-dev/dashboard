"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
} from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { ControllerThermoSettings } from "@/lib/controllers/controller-settings";
import type { AlarmSettings } from "@/lib/data/alarms";
import type { ThermoCommand } from "@/lib/data/commands";
import type { BarnReading } from "@/lib/data/iot";
import type {
  TrendControllerPeriodData,
  TrendPeriodId,
} from "@/lib/data/farm-trend-types";
import type { ControllerMobileSheetPage } from "@/lib/farm/barn-list-panel-state";
import { SEV_COLOR, type Band } from "@/lib/farm/severity-score";
import {
  currentStackMetricValue,
  formatStackMetricValue,
  worstSingleStackMetric,
  type StackMetric,
} from "@/lib/farm/stack-metric";
import { ControllerAffiliationMarks, ControllerNoMark } from "@/components/farm/controller-summary-parts";
import { TrendChart, type TrendSeries } from "@/components/trends/trend-chart";
import { ControllerSummaryGaugeRow } from "./controller-summary-gauge-row";
import { BarnListGraphPanel } from "./barn-list-graph-panel";
import { PanelCloseButton } from "./panel-close-button";
import { GridMetricLabel, gridMetricAriaLabel } from "@/lib/farm/grid-metric-label";
import { trendPeriodLabel } from "@/lib/farm/farm-view-url";
import { controllerKeyForReadingKey } from "@/lib/farm/use-barn-graphs";
import { downsampleColumnsForChart } from "@/lib/farm/trend-display-buckets";
import { BarnPanelBottomSheet } from "@/components/farm/barn-panel-bottom-sheet";
import { useHydrationSafeDashboardCompact } from "@/components/layout/dashboard-viewport-context";
import { motionClass } from "@/lib/ui/motion-classes";
import { cn } from "@/lib/utils";

/** 지표(행) 탭 — 히트맵 행과 동일한 순서/라벨. */
const METRIC_TABS: { id: string; label: string }[] = [
  { id: "T", label: "온도" },
  { id: "H", label: "습도" },
  { id: "A", label: "1차" },
  { id: "B", label: "2차" },
  { id: "C", label: "3차" },
];

/** 컨트롤러 오버레이 선 색 — 대수 구분 (채널·status 토큰과 분리, plan-cover). */
const CONTROLLER_OVERLAY_COLORS = [
  "var(--plan-cover-0)",
  "var(--plan-cover-1)",
  "var(--plan-cover-2)",
  "var(--plan-cover-3)",
  "var(--plan-cover-4)",
  "var(--plan-cover-5)",
  "color-mix(in oklch, var(--plan-cover-0) 70%, var(--mix-shade))",
  "color-mix(in oklch, var(--plan-cover-1) 70%, var(--mix-shade))",
  "color-mix(in oklch, var(--plan-cover-2) 70%, var(--mix-shade))",
  "color-mix(in oklch, var(--plan-cover-3) 70%, var(--mix-shade))",
  "color-mix(in oklch, var(--plan-cover-4) 70%, var(--mix-shade))",
  "color-mix(in oklch, var(--plan-cover-5) 70%, var(--mix-shade))",
] as const;

function isFeatureTourActive(): boolean {
  return (
    typeof document !== "undefined" &&
    Boolean(document.querySelector('[aria-label="기능 안내 투어"]'))
  );
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export type FarmMapControllerDetailController = {
  key: string;
  eqpmnNo: string;
  label: string;
  reading: BarnReading | null;
  metricsById: Record<string, StackMetric>;
};

export type FarmMapControllerDetailData = {
  barnId: string;
  label: string;
  controllers: FarmMapControllerDetailController[];
};

type Props = {
  label: string;
  metricId: string;
  controllers: FarmMapControllerDetailController[];
  gridCols?: number;
  period: TrendPeriodId;
  bars: number;
  readings: BarnReading[];
  thermoSettings: Record<string, ControllerThermoSettings>;
  commands: ThermoCommand[];
  canCommand: boolean;
  alarmSettings?: AlarmSettings;
  controllerTrendByPeriod?: Record<TrendPeriodId, TrendControllerPeriodData> | null;
  onPeriodChange?: (period: TrendPeriodId) => void;
  trendLoading?: boolean;
  trendStale?: boolean;
  onChangeMetric: (metricId: string) => void;
  onClose: () => void;
  /** 현장 통합 — 선택 컨트롤러 스코프로 차트 탭 이동 */
  onOpenChart?: (reading: BarnReading) => void;
  /** picker·외부 동기화 — BarnReading.key */
  selectedReadingKey?: string | null;
  onSelectedReadingKeyChange?: (readingKey: string | null) => void;
  /** picker에서 다른 축사 컨트롤러 선택 */
  onPickerNavigateReading?: (readingKey: string) => void;
  /**
   * 부모가 bottom sheet를 호스트할 때.
   * Detail이 축사유형 전환으로 remount되어도 sheet는 유지된다.
   */
  hostedMobileSheetOpen?: boolean;
  hostedMobileSheetPage?: ControllerMobileSheetPage;
  onHostedMobileSheetOpenChange?: (open: boolean) => void;
  onHostedMobileSheetPageChange?: (page: ControllerMobileSheetPage) => void;
};

export function FarmMapControllerDetail({
  label,
  metricId,
  controllers,
  gridCols,
  period,
  readings,
  thermoSettings,
  commands,
  canCommand,
  alarmSettings,
  controllerTrendByPeriod,
  onPeriodChange,
  trendLoading = false,
  trendStale = false,
  onChangeMetric,
  onClose,
  onOpenChart,
  selectedReadingKey = null,
  onSelectedReadingKeyChange,
  onPickerNavigateReading: _onPickerNavigateReading,
  hostedMobileSheetOpen = false,
  hostedMobileSheetPage = 0,
  onHostedMobileSheetOpenChange,
  onHostedMobileSheetPageChange,
}: Props) {
  const viewportCompact = useHydrationSafeDashboardCompact();
  const [chartPlotWidth, setChartPlotWidth] = useState(0);
  const onPlotWidthChange = useCallback((w: number) => {
    setChartPlotWidth((prev) => (Math.abs(prev - w) < 8 ? prev : w));
  }, []);
  const plotWidthPx = chartPlotWidth > 32 ? chartPlotWidth : 360;
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [graphOpen, setGraphOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [panelPeriod, setPanelPeriod] = useState<TrendPeriodId>(period);
  const [prevPeriod, setPrevPeriod] = useState(period);
  const [prevLabel, setPrevLabel] = useState(label);
  /** null = 첫 진입 morph · -1/1 = 좌우 전환 슬라이드 */
  const [navDir, setNavDir] = useState<-1 | 1 | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const controllerCardRef = useRef<HTMLDivElement | null>(null);

  if (period !== prevPeriod) {
    setPrevPeriod(period);
    setPanelPeriod(period);
  }

  if (label !== prevLabel) {
    setPrevLabel(label);
    setNavDir(null);
  }

  const panelLayoutVariant = viewportCompact
    ? ("stack" as const)
    : typeof gridCols === "number" && gridCols >= 2
      ? ("grid" as const)
      : ("stack" as const);
  const isMobileStack = panelLayoutVariant === "stack";
  const sheetHosted = typeof onHostedMobileSheetOpenChange === "function";

  const mobileSettingsOpen = sheetHosted
    ? hostedMobileSheetOpen && hostedMobileSheetPage === 1
    : settingsOpen;

  const availableMetricIds = useMemo(() => {
    const has = (id: string) =>
      controllers.some((c) => {
        const m = c.metricsById[id];
        return (
          Boolean(m) && m.values.some((v) => v != null && Number.isFinite(v))
        );
      });
    return METRIC_TABS.filter((t) => has(t.id)).map((t) => t.id);
  }, [controllers]);
  const effectiveMetricId = availableMetricIds.includes(metricId)
    ? metricId
    : (availableMetricIds[0] ?? metricId);

  useEffect(() => {
    if (isFeatureTourActive()) return;
    rootRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [label]);

  useEffect(() => {
    if (!mobileSettingsOpen || !isMobileStack) return;
    if (isFeatureTourActive()) return;
    controllerCardRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [mobileSettingsOpen, isMobileStack]);

  const syncSelectedReadingKey = useCallback(
    (readingKey: string | null) => {
      onSelectedReadingKeyChange?.(readingKey);
    },
    [onSelectedReadingKeyChange],
  );

  const resolveControllerKey = useCallback(
    (readingKey: string): string | null => {
      const fromReading = controllerKeyForReadingKey(readings, readingKey);
      if (fromReading && controllers.some((c) => c.key === fromReading)) {
        return fromReading;
      }
      return controllers.some((c) => c.key === readingKey) ? readingKey : null;
    },
    [controllers, readings],
  );

  const selected = useMemo(() => {
    const fromState =
      selectedKey && controllers.some((c) => c.key === selectedKey)
        ? selectedKey
        : null;
    const fromReading = selectedReadingKey
      ? resolveControllerKey(selectedReadingKey)
      : null;
    const key = fromState ?? fromReading;
    return key ? (controllers.find((c) => c.key === key) ?? null) : null;
  }, [
    controllers,
    selectedKey,
    selectedReadingKey,
    resolveControllerKey,
  ]);

  const sheetOpenRef = useRef(false);
  useEffect(() => {
    sheetOpenRef.current = sheetHosted
      ? hostedMobileSheetOpen
      : graphOpen || settingsOpen;
  });

  const openMobileSheet = useCallback(
    (page: ControllerMobileSheetPage) => {
      const readingKey =
        selected?.reading?.key ??
        selectedReadingKey ??
        null;
      if (readingKey) syncSelectedReadingKey(readingKey);
      if (sheetHosted) {
        onHostedMobileSheetOpenChange?.(true);
        onHostedMobileSheetPageChange?.(page);
        return;
      }
      if (page === 1) {
        setGraphOpen(false);
        setSettingsOpen(true);
      } else {
        setSettingsOpen(false);
        setGraphOpen(true);
      }
    },
    [
      selected?.reading?.key,
      selectedReadingKey,
      sheetHosted,
      onHostedMobileSheetOpenChange,
      onHostedMobileSheetPageChange,
      syncSelectedReadingKey,
    ],
  );

  const closeMobileSheet = useCallback(() => {
    if (sheetHosted) {
      onHostedMobileSheetOpenChange?.(false);
      return;
    }
    setGraphOpen(false);
    setSettingsOpen(false);
  }, [sheetHosted, onHostedMobileSheetOpenChange]);

  const closeDetailDrawer = useCallback(() => {
    setSelectedKey(null);
    setNavDir(null);
    setGraphOpen(false);
    setSettingsOpen(false);
    syncSelectedReadingKey(null);
    closeMobileSheet();
  }, [syncSelectedReadingKey, closeMobileSheet]);

  /** hosted sheet가 닫히면 칩 선택도 해제 (오버레이 유지). */
  const prevHostedOpenRef = useRef(hostedMobileSheetOpen);
  useEffect(() => {
    const wasOpen = prevHostedOpenRef.current;
    prevHostedOpenRef.current = hostedMobileSheetOpen;
    if (!sheetHosted || !wasOpen || hostedMobileSheetOpen) return;
    setSelectedKey(null);
    setNavDir(null);
    syncSelectedReadingKey(null);
  }, [sheetHosted, hostedMobileSheetOpen, syncSelectedReadingKey]);

  if (selectedReadingKey) {
    const ctrlKey = resolveControllerKey(selectedReadingKey);
    if (ctrlKey && ctrlKey !== selectedKey) {
      setSelectedKey(ctrlKey);
      if (!isMobileStack) {
        setGraphOpen(false);
        setSettingsOpen(true);
      }
    }
  }

  useEffect(() => {
    if (!selectedReadingKey) return;
    const ctrlKey = resolveControllerKey(selectedReadingKey);
    if (!ctrlKey) return;
    // sheet가 이미 열려 있으면 페이지(그래프/설정) 유지 — 닫혀 있을 때만 기본 오픈
    if (isMobileStack && !sheetOpenRef.current) {
      openMobileSheet(0);
    }
  }, [
    selectedReadingKey,
    resolveControllerKey,
    isMobileStack,
    openMobileSheet,
  ]);

  const selectController = (key: string) => {
    if (selectedKey === key) {
      closeDetailDrawer();
      return;
    }
    setNavDir(null);
    setSelectedKey(key);
    const reading = controllers.find((c) => c.key === key)?.reading;
    syncSelectedReadingKey(reading?.key ?? null);
    if (isMobileStack) {
      if (!sheetOpenRef.current) openMobileSheet(0);
    } else {
      // PC — 하단 드로어에서 설정+인라인 추이
      setGraphOpen(false);
      setSettingsOpen(true);
    }
  };

  const selectedIndex = useMemo(() => {
    if (!selected) return -1;
    return controllers.findIndex((c) => c.key === selected.key);
  }, [controllers, selected]);

  const navigateAdjacent = useCallback(
    (delta: -1 | 1) => {
      if (selectedIndex < 0) return;
      const next = controllers[selectedIndex + delta];
      if (!next) return;
      // enter-only — exit 레이어 겹침 잔상 방지
      setNavDir(prefersReducedMotion() ? null : delta);
      setSelectedKey(next.key);
      onSelectedReadingKeyChange?.(next.reading?.key ?? null);
      if (isMobileStack && !sheetOpenRef.current) {
        openMobileSheet(0);
      }
    },
    [
      controllers,
      selectedIndex,
      isMobileStack,
      openMobileSheet,
      onSelectedReadingKeyChange,
    ],
  );

  const canGoPrev = selectedIndex > 0;
  const canGoNext =
    selectedIndex >= 0 && selectedIndex < controllers.length - 1;

  const count = controllers.length;

  const overlayMetric = useMemo(() => {
    const rows = controllers.map((c, index) => {
      const metric = c.metricsById[effectiveMetricId] ?? null;
      const color =
        CONTROLLER_OVERLAY_COLORS[index % CONTROLLER_OVERLAY_COLORS.length]!;
      return {
        key: c.key,
        label: c.label,
        eqpmnNo: c.eqpmnNo,
        color,
        metric,
        cur: metric ? currentStackMetricValue(metric.values) : null,
        worst: metric ? worstSingleStackMetric(metric) : ("normal" as const),
      };
    });
    const withData = rows.filter((r) =>
      r.metric?.values.some((v) => v != null && Number.isFinite(v)),
    );
    const sampleLen = Math.max(
      0,
      ...withData.map((r) => r.metric?.values.length ?? 0),
    );
    const rawCats = controllerTrendByPeriod?.[period]?.categories ?? [];
    const categoriesBase =
      rawCats.length === sampleLen && sampleLen > 0
        ? rawCats
        : sampleLen > 0
          ? Array.from({ length: sampleLen }, (_, i) => String(i + 1))
          : [];
    const columnsRaw = withData.map((r) => {
      const values = r.metric?.values ?? [];
      if (values.length === sampleLen) return values;
      const padded = values.slice();
      while (padded.length < sampleLen) padded.push(null);
      return padded.slice(0, sampleLen);
    });
    const downsampled =
      categoriesBase.length > 0
        ? downsampleColumnsForChart(categoriesBase, columnsRaw, plotWidthPx)
        : { categories: [] as string[], columns: [] as (number | null)[][] };
    const series: TrendSeries[] = withData.map((r, i) => ({
      name: r.label,
      data: downsampled.columns[i] ?? r.metric?.values ?? [],
      color: r.color,
    }));
    const sharedBand: Band | null =
      rows.map((r) => r.metric?.band ?? null).find((b) => b != null) ?? null;
    const unit = rows.find((r) => r.metric?.unit)?.metric?.unit ?? "";
    const leftDomain: [number, number] | undefined =
      effectiveMetricId === "T" || effectiveMetricId === "H"
        ? sharedBand
          ? [sharedBand.lo, sharedBand.hi]
          : undefined
        : [0, 100];
    const referenceLines = sharedBand
      ? [
          {
            value: sharedBand.lo,
            axis: "left" as const,
            color: SEV_COLOR.warning,
            label: formatStackMetricValue(sharedBand.lo, unit),
          },
          {
            value: sharedBand.hi,
            axis: "left" as const,
            color: SEV_COLOR.warning,
            label: formatStackMetricValue(sharedBand.hi, unit),
          },
        ]
      : [];
    return {
      rows,
      series,
      categories: downsampled.categories,
      unit,
      leftDomain,
      referenceLines,
      hasData: series.length > 0 && downsampled.categories.length > 0,
    };
  }, [
    controllers,
    effectiveMetricId,
    controllerTrendByPeriod,
    period,
    plotWidthPx,
  ]);

  return (
    <div
      ref={rootRef}
      className={cn(
        "farm-heat-morph border-t bg-muted/20 px-3 py-3",
        isMobileStack &&
          "pb-[calc(4.5rem+env(safe-area-inset-bottom,0px))]",
      )}
      data-tour-id="detail-panel"
    >
      <div
        className="mb-2.5 flex flex-wrap items-center gap-2"
        data-tour-id="detail-panel-header"
      >
        <span className="text-sm font-semibold">{label}</span>
        <span className="text-xs text-muted-foreground">
          · 컨트롤러별 · {trendPeriodLabel(period)} · {controllers.length}대
        </span>
        <div
          className="ml-1 inline-flex overflow-hidden rounded-md border bg-background text-[0.7rem]"
          role="group"
          aria-label="지표"
        >
          {METRIC_TABS.filter((t) => availableMetricIds.includes(t.id)).map(
            (t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => onChangeMetric(t.id)}
                aria-label={gridMetricAriaLabel(t.id, t.label)}
                className={cn(
                  "flex min-w-[2rem] items-center justify-center px-2 py-1 font-medium",
                  motionClass.microHover,
                  effectiveMetricId === t.id
                    ? "bg-channel-info/10 text-channel-info"
                    : "text-muted-foreground hover:bg-muted",
                )}
              >
                <GridMetricLabel
                  id={t.id}
                  label={t.label}
                  mode="icon"
                  iconClassName="size-3.5"
                />
              </button>
            ),
          )}
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          {onOpenChart ? (
            <button
              type="button"
              onClick={() => {
                const reading =
                  selected?.reading ??
                  readings.find((r) => r.key === selectedReadingKey) ??
                  null;
                if (reading) onOpenChart(reading);
              }}
              className={cn(
                "rounded-md border bg-background px-2 py-1 text-xs font-medium text-foreground",
                motionClass.microHover,
              )}
            >
              차트에서 보기
            </button>
          ) : null}
          <PanelCloseButton onClick={onClose} />
        </div>
      </div>

      {controllers.length === 0 ? (
        <div className="rounded-md border bg-background px-3 py-6 text-center text-xs text-muted-foreground">
          컨트롤러 시계열을 불러오는 중이거나 데이터가 없습니다.
        </div>
      ) : (
        <>
          <div
            className="space-y-2 rounded-md border bg-background p-2.5 sm:p-3"
            data-tour-id="detail-panel-charts"
          >
            {overlayMetric.hasData ? (
              <TrendChart
                mode="line"
                categories={overlayMetric.categories}
                series={overlayMetric.series}
                height={isMobileStack ? 140 : 168}
                leftUnit={overlayMetric.unit}
                leftDomain={overlayMetric.leftDomain}
                referenceLines={overlayMetric.referenceLines}
                period={period}
                showLegend={count <= 8}
                showMarkers={false}
                onPlotWidthChange={onPlotWidthChange}
              />
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">
                선택한 기간에 수신된 데이터가 없습니다.
              </p>
            )}
            <div
              className="flex flex-wrap gap-1.5"
              role="group"
              aria-label="컨트롤러 선택"
            >
              {overlayMetric.rows.map((row, index) => {
                const isSel = row.key === selectedKey;
                return (
                  <button
                    key={row.key}
                    type="button"
                    aria-pressed={isSel}
                    data-tour-id={
                      index === 0 ? "detail-panel-chart-first" : undefined
                    }
                    onClick={() => selectController(row.key)}
                    className={cn(
                      "inline-flex min-w-0 items-center gap-1.5 rounded-md border bg-muted/20 px-2 py-1 text-left text-[0.7rem] hover:border-channel-info",
                      motionClass.microHover,
                      isSel && "border-primary ring-2 ring-primary/30",
                      !isSel && row.worst === "warning" && "border-red-500/50",
                      !isSel && row.worst === "caution" && "border-amber-500/50",
                    )}
                  >
                    <span
                      className="inline-block size-2 shrink-0 rounded-sm"
                      style={{ background: row.color }}
                      aria-hidden
                    />
                    <span className="truncate font-semibold">{row.label}</span>
                    <ControllerNoMark
                      eqpmnNo={row.eqpmnNo}
                      className="shrink-0 text-muted-foreground"
                    />
                    <span
                      className="ml-0.5 shrink-0 font-semibold tabular-nums"
                      style={{ color: SEV_COLOR[row.worst] }}
                    >
                      {formatStackMetricValue(row.cur, row.metric?.unit)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* PC·비hosted — 하단 드로어. 모바일 hosted는 부모 BarnListToolbarMobileSheet. */}
          {!sheetHosted && selected ? (
            <BarnPanelBottomSheet
              open
              onClose={closeDetailDrawer}
              title={
                selected.reading ? (
                  <ControllerAffiliationMarks
                    stallTyCode={selected.reading.stallTyCode}
                    stallNo={selected.reading.stallNo}
                    eqpmnNo={selected.reading.eqpmnNo}
                    compactType
                  />
                ) : (
                  selected.label
                )
              }
              auditRegion="farm-map-controller-detail-drawer"
              className="h-[92dvh] max-h-[92dvh] md:h-[92dvh] md:max-h-[92dvh]"
              contentClassName="min-h-0 flex-1 overflow-y-auto"
              suppressFocusOutClose
            >
              {selected.reading ? (
                <div
                  ref={controllerCardRef}
                  className="space-y-3 p-3"
                  data-nav-dir={navDir ?? "enter"}
                >
                  <div
                    key={selected.key}
                    className={cn(
                      motionClass.detailCarouselLayer,
                      navDir === 1 && motionClass.detailSlideEnterNext,
                      navDir === -1 && motionClass.detailSlideEnterPrev,
                      navDir == null && motionClass.emphasisMorph,
                    )}
                    data-role="enter"
                  >
                    <ControllerDetailSlideBody
                      controller={selected}
                      index={selectedIndex}
                      total={controllers.length}
                      showNav={controllers.length > 1}
                      interactive
                      canGoPrev={canGoPrev}
                      canGoNext={canGoNext}
                      onNavigate={navigateAdjacent}
                      readings={readings}
                      thermoSettings={thermoSettings}
                      commands={commands}
                      canCommand={canCommand}
                      alarmSettings={alarmSettings}
                      controllerTrendByPeriod={controllerTrendByPeriod}
                      period={period}
                      panelPeriod={panelPeriod}
                      onPanelPeriodChange={setPanelPeriod}
                      onPeriodChange={onPeriodChange}
                      trendLoading={trendLoading}
                      trendStale={trendStale}
                      gridCols={gridCols}
                      panelLayoutVariant="stack"
                      hideGraphToggle
                      settingsExpanded
                      onToggleSettings={() => {}}
                      onCommandQueued={onClose}
                      suppressPerCardMobileSheet
                      showDesktopGraph={false}
                      showChannelSection={false}
                    />
                  </div>
                </div>
              ) : (
                <div className="px-3 py-6 text-center text-xs text-muted-foreground">
                  이 컨트롤러의 실시간 판독값을 찾을 수 없습니다.
                </div>
              )}
            </BarnPanelBottomSheet>
          ) : null}
        </>
      )}
    </div>
  );
}

type ControllerDetailSlideBodyProps = {
  controller: FarmMapControllerDetailController;
  index: number;
  total: number;
  showNav: boolean;
  interactive: boolean;
  canGoPrev?: boolean;
  canGoNext?: boolean;
  onNavigate?: (delta: -1 | 1) => void;
  readings: BarnReading[];
  thermoSettings: Record<string, ControllerThermoSettings>;
  commands: ThermoCommand[];
  canCommand: boolean;
  alarmSettings?: AlarmSettings;
  controllerTrendByPeriod?: Record<TrendPeriodId, TrendControllerPeriodData> | null;
  period: TrendPeriodId;
  panelPeriod: TrendPeriodId;
  onPanelPeriodChange: (period: TrendPeriodId) => void;
  onPeriodChange?: (period: TrendPeriodId) => void;
  trendLoading: boolean;
  trendStale: boolean;
  gridCols?: number;
  panelLayoutVariant: "stack" | "grid";
  hideGraphToggle?: boolean;
  settingsExpanded: boolean;
  onToggleSettings?: () => void;
  onCommandQueued?: () => void;
  sheetPickerReadings?: BarnReading[];
  onSheetPickerSelect?: (readingKey: string) => void;
  showSheetPickerAffiliation?: boolean;
  suppressPerCardMobileSheet?: boolean;
  showDesktopGraph: boolean;
  showChannelSection?: boolean;
};

function ControllerDetailSlideBody({
  controller,
  index,
  total,
  showNav,
  interactive,
  canGoPrev = false,
  canGoNext = false,
  onNavigate,
  readings,
  thermoSettings,
  commands,
  canCommand,
  alarmSettings,
  controllerTrendByPeriod,
  period,
  panelPeriod,
  onPanelPeriodChange,
  onPeriodChange,
  trendLoading,
  trendStale,
  gridCols,
  panelLayoutVariant,
  hideGraphToggle = false,
  settingsExpanded,
  onToggleSettings,
  onCommandQueued,
  sheetPickerReadings,
  onSheetPickerSelect,
  showSheetPickerAffiliation,
  suppressPerCardMobileSheet,
  showDesktopGraph,
  showChannelSection = true,
}: ControllerDetailSlideBodyProps) {
  const reading = controller.reading;
  if (!reading) return null;

  return (
    <>
      {showNav ? (
        <div
          className="flex items-center gap-2 rounded-md border bg-background px-2 py-2"
          data-tour-id={interactive ? "detail-controller-nav" : undefined}
        >
          <button
            type="button"
            disabled={!interactive || !canGoPrev}
            aria-label="이전 컨트롤러"
            tabIndex={interactive ? undefined : -1}
            onClick={() => onNavigate?.(-1)}
            className={cn(
              "inline-flex size-8 shrink-0 items-center justify-center rounded-md border",
              motionClass.microInteractive,
              interactive && canGoPrev
                ? "hover:bg-muted"
                : "cursor-not-allowed opacity-40",
            )}
          >
            <ChevronLeft className="size-4" aria-hidden />
          </button>
          <div className="min-w-0 flex-1 text-center">
            <p
              className="truncate text-base font-semibold leading-snug md:text-lg"
              aria-label={`${controller.label} · ${index + 1} / ${total}`}
            >
              {controller.label}
            </p>
          </div>
          <button
            type="button"
            disabled={!interactive || !canGoNext}
            aria-label="다음 컨트롤러"
            tabIndex={interactive ? undefined : -1}
            onClick={() => onNavigate?.(1)}
            className={cn(
              "inline-flex size-8 shrink-0 items-center justify-center rounded-md border",
              motionClass.microInteractive,
              interactive && canGoNext
                ? "hover:bg-muted"
                : "cursor-not-allowed opacity-40",
            )}
          >
            <ChevronRight className="size-4" aria-hidden />
          </button>
        </div>
      ) : null}
      <ControllerSummaryGaugeRow
        reading={reading}
        readings={readings}
        thermoSettings={thermoSettings}
        commands={commands}
        canCommand={interactive && canCommand}
        alarmSettings={alarmSettings}
        controllerTrendByPeriod={controllerTrendByPeriod}
        bulkPeriod={period}
        panelPeriodOverrides={{ [reading.key]: panelPeriod }}
        onPanelPeriodChange={
          interactive ? (_, p) => onPanelPeriodChange(p) : undefined
        }
        hideGraphToggle={hideGraphToggle}
        panelPlacement="right"
        gridCols={gridCols}
        panelLayoutVariant={panelLayoutVariant}
        settingsExpanded={settingsExpanded}
        onToggleSettings={interactive ? onToggleSettings : undefined}
        onCloseSettings={interactive ? onCommandQueued : undefined}
        sheetPickerReadings={interactive ? sheetPickerReadings : undefined}
        onSheetPickerSelect={interactive ? onSheetPickerSelect : undefined}
        showSheetPickerAffiliation={showSheetPickerAffiliation}
        suppressPerCardMobileSheet={suppressPerCardMobileSheet}
      />
      {showDesktopGraph ? (
        <BarnListGraphPanel
          reading={reading}
          controllerTrendByPeriod={controllerTrendByPeriod ?? null}
          period={period}
          onPeriodChange={
            interactive
              ? (onPeriodChange ?? (() => {}))
              : () => {}
          }
          alarmSettings={alarmSettings}
          thermoSettings={thermoSettings}
          loading={trendLoading}
          stale={trendStale}
          showChannelSection={showChannelSection}
        />
      ) : null}
    </>
  );
}
