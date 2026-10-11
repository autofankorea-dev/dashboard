"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import type { BarnMapSnapshot, BarnReading } from "@/lib/data/iot";
import { parseBarnCatalogKey } from "@/lib/domain/barn-catalog";
import {
  DEFAULT_TREND_PERIOD,
  hasStallTrendByPeriod,
  type TrendControllerPeriodData,
  type TrendPeriodData,
  type TrendPeriodId,
} from "@/lib/domain/farm-trend-types";
import type { ControllerMobileSheetPage } from "@/lib/farm/barn-list-panel-state";
import { GRAPH_BARS, barnIdForReading, useBarnGraphs } from "@/components/farm/use-barn-graphs";
import { cn } from "@/lib/utils";
import { motionClass } from "@/lib/ui/motion-classes";
import { motionDuration } from "@/lib/ui/motion-tokens";
import type { ControllerGridData } from "@/lib/farm/controller-grid-data";
import { firstReadingKeyForBarn, readingsMatchingBarn } from "./farm-field-status-grid";
import { FarmMapCard } from "./farm-map-card";
import { worstControllerEnvCoverLevel } from "@/lib/farm/controller-env-cover";
import { FarmMapControllerDetail } from "./farm-map-controller-detail";
import { BarnListToolbarMobileSheet } from "./barn-list-toolbar-mobile-sheet";
import {
  InlineStatusToast,
  type InlineStatusTone,
} from "@/components/common/inline-status-toast";
import { useFarmTourGridAction } from "@/components/onboarding/use-farm-tour-grid-action";
import { useFarmLiveRefreshOptional } from "@/lib/navigation/farm-live-refresh";
import { scheduleSafeRouterRefresh } from "@/lib/navigation/safe-router-refresh";
import { FARM_TOUR_ACTION_EVENT } from "@/lib/onboarding/tour-steps";
import type { TourGridAction } from "@/lib/onboarding/tour-grid-actions";
import {
  afterFrames,
  dispatchTourGridActionDone,
  waitForTourTarget,
} from "@/lib/onboarding/tour-timing";

const FarmMapBulkApply = dynamic(
  () =>
    import("./farm-map-bulk-apply").then((m) => ({
      default: m.FarmMapBulkApply,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="h-11 shrink-0 animate-pulse rounded-md bg-muted/30" />
    ),
  },
);

/** 차트 탭 등장(moderate) + 인지 여유(emphasis) 뒤에 시트 접힘 */
const CHART_THEN_PEEK_MS =
  motionDuration.moderate + motionDuration.emphasis;

type Props = {
  barns: BarnMapSnapshot[];
  trendByPeriod?: Record<TrendPeriodId, TrendPeriodData> | null;
  controllerTrendByPeriod?: Record<TrendPeriodId, TrendControllerPeriodData> | null;
  controller?: ControllerGridData | null;
  hubMode?: boolean;
  trendPeriod?: TrendPeriodId;
  onTrendPeriodChange?: (period: TrendPeriodId) => void;
  trendLoading?: boolean;
  trendStale?: boolean;
  fieldMerge?: boolean;
  onOpenChart?: (reading: BarnReading) => void;
  /** 차트 탭 — peek 핸들 포털만 억제(상태는 유지) */
  suppressBottomOverlays?: boolean;
};

/**
 * lg 미만 — 데스크톱 그리드와 동일 정책(요약+히트맵 병합 카드, 이상 행 클릭 시 인라인 상세)을
 * 모바일 세로 단일 컬럼으로 적용. 레거시 드릴 그래프(FarmMapGraphStage) 미사용.
 */
export function FarmMapMobileStage({
  barns,
  trendByPeriod,
  controllerTrendByPeriod,
  controller,
  hubMode = false,
  trendPeriod: trendPeriodProp,
  onTrendPeriodChange,
  trendLoading = false,
  trendStale = false,
  fieldMerge = false,
  onOpenChart,
  suppressBottomOverlays = false,
}: Props) {
  const router = useRouter();
  const liveRefresh = useFarmLiveRefreshOptional();
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedSps, setSelectedSps] = useState<Set<string>>(new Set());
  const [localGraphPeriod, setLocalGraphPeriod] =
    useState<TrendPeriodId>(DEFAULT_TREND_PERIOD);
  const graphPeriod = trendPeriodProp ?? localGraphPeriod;
  const setGraphPeriod = onTrendPeriodChange ?? setLocalGraphPeriod;
  const [statusToast, setStatusToast] = useState<{
    message: string;
    tone: InlineStatusTone;
  } | null>(null);

  const bulkEnabled = Boolean(controller?.canCommand);
  const graphMode = hasStallTrendByPeriod(trendByPeriod) && !bulkMode;

  const { expanded, setExpanded, graphByBarnId, metricIdsByBarnId, detail } =
    useBarnGraphs({
      barns,
      trendByPeriod,
      controllerTrendByPeriod,
      controller,
      graphPeriod,
      enabled: graphMode,
    });
  const [detailSelectedReadingKey, setDetailSelectedReadingKey] = useState<
    string | null
  >(null);
  const [hostedSheetOpen, setHostedSheetOpen] = useState(false);
  const [hostedSheetPeek, setHostedSheetPeek] = useState(false);
  const [sheetFollowsChart, setSheetFollowsChart] = useState(false);
  const peekAfterChartRef = useRef<number | null>(null);

  const clearPeekAfterChart = useCallback(() => {
    if (peekAfterChartRef.current == null) return;
    window.clearTimeout(peekAfterChartRef.current);
    peekAfterChartRef.current = null;
  }, []);

  useEffect(() => () => clearPeekAfterChart(), [clearPeekAfterChart]);
  const [hostedSheetPage, setHostedSheetPage] =
    useState<ControllerMobileSheetPage>(0);
  /** sheet 설정 페이지 그래프 — 카드별 기간 오버라이드 (미전달 시 토글 no-op 버그) */
  const [panelPeriodOverrides, setPanelPeriodOverrides] = useState<
    Record<string, TrendPeriodId>
  >({});
  const handlePanelPeriodChange = useCallback(
    (key: string, period: TrendPeriodId) => {
      setPanelPeriodOverrides((prev) => ({ ...prev, [key]: period }));
    },
    [],
  );

  const closeHostedSheet = useCallback(() => {
    clearPeekAfterChart();
    setHostedSheetOpen(false);
    setHostedSheetPeek(false);
    setSheetFollowsChart(false);
    if (fieldMerge) {
      setExpanded(null);
      setDetailSelectedReadingKey(null);
    }
  }, [clearPeekAfterChart, fieldMerge, setExpanded]);

  const handleDetailClose = useCallback(() => {
    clearPeekAfterChart();
    setExpanded(null);
    setDetailSelectedReadingKey(null);
    setHostedSheetOpen(false);
    setHostedSheetPeek(false);
    setSheetFollowsChart(false);
  }, [clearPeekAfterChart, setExpanded]);

  /** 현장 통합 모바일 — 인라인 상세 없이 Bottom sheet 직행 */
  const openFieldMergeSheet = useCallback(
    (barn: BarnMapSnapshot) => {
      const metrics = metricIdsByBarnId.get(barn.meta.id);
      const metricId = metrics?.[0] ?? "T";
      const readingKey = firstReadingKeyForBarn(
        barn,
        controller?.readings ?? [],
      );
      setExpanded({ barnId: barn.meta.id, metricId });
      setDetailSelectedReadingKey(readingKey);
      setHostedSheetPage(0);
      clearPeekAfterChart();
      setHostedSheetPeek(false);
      setSheetFollowsChart(false);
      setHostedSheetOpen(true);
    },
    [clearPeekAfterChart, controller?.readings, metricIdsByBarnId, setExpanded],
  );

  const handlePickerNavigateReading = useCallback(
    (readingKey: string) => {
      const allReadings = controller?.readings ?? [];
      const reading = allReadings.find((r) => r.key === readingKey);
      if (!reading || !expanded) return;
      const targetBarnId = barnIdForReading(barns, reading);
      if (!targetBarnId) return;
      setDetailSelectedReadingKey(readingKey);
      if (targetBarnId !== expanded.barnId) {
        setExpanded((e) => (e ? { ...e, barnId: targetBarnId } : e));
      }
    },
    [barns, controller?.readings, expanded, setExpanded],
  );

  const handleHostedSheetSelectKey = useCallback(
    (readingKey: string) => {
      const allReadings = controller?.readings ?? [];
      const reading = allReadings.find((r) => r.key === readingKey);
      if (!reading || !expanded) {
        setDetailSelectedReadingKey(readingKey);
        return;
      }
      const targetBarnId = barnIdForReading(barns, reading);
      setDetailSelectedReadingKey(readingKey);
      if (targetBarnId && targetBarnId !== expanded.barnId) {
        setExpanded((e) => (e ? { ...e, barnId: targetBarnId } : e));
      }
      if (sheetFollowsChart) onOpenChart?.(reading);
    },
    [
      barns,
      controller?.readings,
      expanded,
      onOpenChart,
      setExpanded,
      sheetFollowsChart,
    ],
  );

  useFarmTourGridAction({ barns, metricIdsByBarnId, setExpanded });

  const barnsRef = useRef(barns);
  const readingsRef = useRef(controller?.readings ?? []);
  const metricIdsRef = useRef(metricIdsByBarnId);
  useEffect(() => {
    barnsRef.current = barns;
  });
  useEffect(() => {
    readingsRef.current = controller?.readings ?? [];
  });
  useEffect(() => {
    metricIdsRef.current = metricIdsByBarnId;
  });

  /** fieldMerge 모바일 — 투어가 PC list-mode 대신 시트를 열고 페이지를 맞춤 */
  useEffect(() => {
    if (!fieldMerge) return;

    const openFirstSheet = (page: ControllerMobileSheetPage) => {
      const list = barnsRef.current;
      const readings = readingsRef.current;
      const barn =
        list.find((b) => firstReadingKeyForBarn(b, readings)) ?? list[0];
      if (!barn) return false;
      const metrics = metricIdsRef.current.get(barn.meta.id);
      const metricId = metrics?.[0] ?? "T";
      const readingKey =
        firstReadingKeyForBarn(barn, readings) ?? readings[0]?.key ?? null;
      if (!readingKey) return false;
      setExpanded({ barnId: barn.meta.id, metricId });
      setDetailSelectedReadingKey(readingKey);
      setHostedSheetPage(page);
      clearPeekAfterChart();
      setHostedSheetPeek(false);
      setSheetFollowsChart(false);
      setHostedSheetOpen(true);
      return true;
    };

    const onTourAction = (e: Event) => {
      const action = (e as CustomEvent<{ action?: TourGridAction }>).detail
        ?.action;
      if (
        action !== "field-mobile-sheet-controller" &&
        action !== "field-mobile-sheet-settings" &&
        action !== "field-mobile-sheet-close"
      ) {
        return;
      }

      if (action === "field-mobile-sheet-close") {
        clearPeekAfterChart();
        setHostedSheetOpen(false);
        setHostedSheetPeek(false);
        setSheetFollowsChart(false);
        setExpanded(null);
        setDetailSelectedReadingKey(null);
        void (async () => {
          await afterFrames(2);
          await waitForTourTarget([
            '[data-tour-id="map-grid"]',
            '[data-tour-id="barn-card"]',
            '[data-tour-id="header-feature-tour"]',
          ]);
          dispatchTourGridActionDone(action);
        })();
        return;
      }

      const page: ControllerMobileSheetPage =
        action === "field-mobile-sheet-settings" ? 1 : 0;
      const opened = openFirstSheet(page);
      void (async () => {
        await afterFrames(2);
        if (opened) {
          const settle =
            action === "field-mobile-sheet-settings"
              ? [
                  '[data-tour-id="controller-mobile-sheet-panel"]',
                  '[data-tour-id="list-settings-host"]',
                  '[data-audit-region="controller-mobile-sheet-settings"]',
                ]
              : [
                  '[data-tour-id="controller-gauge-metrics"]',
                  '[data-audit-region="controller-mobile-sheet-controller"]',
                ];
          await waitForTourTarget(settle);
        }
        dispatchTourGridActionDone(action);
      })();
    };

    window.addEventListener(FARM_TOUR_ACTION_EVENT, onTourAction);
    return () => window.removeEventListener(FARM_TOUR_ACTION_EVENT, onTourAction);
  }, [clearPeekAfterChart, fieldMerge, setExpanded]);

  const toggleSp = useCallback((sp: string) => {
    setSelectedSps((prev) => {
      const next = new Set(prev);
      if (next.has(sp)) next.delete(sp);
      else next.add(sp);
      return next;
    });
  }, []);

  const exitBulk = useCallback(() => {
    setBulkMode(false);
    setSelectedSps(new Set());
  }, []);

  return (
    <div
      className="flex min-w-0 flex-col overflow-hidden rounded-md border"
      data-audit-region="farm-map-mobile-list"
    >
      {bulkEnabled && controller ? (
        <FarmMapBulkApply
          controller={controller}
          bulkMode={bulkMode}
          selectedSps={Array.from(selectedSps)}
          onEnter={() => setBulkMode(true)}
          onClearSelection={() => setSelectedSps(new Set())}
          onExit={exitBulk}
          onAfterApply={(result, feedback) => {
            setStatusToast({ message: feedback.message, tone: feedback.tone });
            if (result.alarm?.ok && result.alarm.settings && liveRefresh) {
              liveRefresh.patchAlarmSettings(result.alarm.settings);
            }
            if (liveRefresh) {
              void liveRefresh.revalidateFarmLive();
            } else if (!hubMode) {
              scheduleSafeRouterRefresh(router);
            }
          }}
          onRefreshLive={() => {
            if (liveRefresh?.revalidating) return;
            if (liveRefresh) {
              void liveRefresh.revalidateFarmLive();
            } else if (!hubMode) {
              scheduleSafeRouterRefresh(router);
            }
          }}
        />
      ) : null}

      <div className="flex flex-col gap-2 p-2" data-tour-id="map-grid">
        {barns.map((b) => {
          const spCode = parseBarnCatalogKey(b.meta.id)?.stallTyCode ?? "";
          const isExpanded = expanded?.barnId === b.meta.id;
          return (
            <div
              key={b.meta.id}
              className={cn(
                "flex min-w-0 flex-col",
                motionClass.surfaceRing,
                isExpanded && "rounded-lg ring-2 ring-primary/50 ring-offset-1",
              )}
            >
              <FarmMapCard
                snapshot={b}
                layout="stack"
                compact
                statusCompact={fieldMerge}
                envCoverLevel={
                  fieldMerge
                    ? worstControllerEnvCoverLevel(
                        readingsMatchingBarn(b, controller?.readings ?? []),
                        controller?.alarmSettings,
                      )
                    : undefined
                }
                graphContent={
                  graphMode && !fieldMerge
                    ? graphByBarnId.get(b.meta.id)
                    : undefined
                }
                selectable={
                  (bulkMode && Boolean(spCode)) ||
                  (fieldMerge && !bulkMode)
                }
                selected={
                  bulkMode
                    ? selectedSps.has(spCode)
                    : expanded?.barnId === b.meta.id
                }
                onSelect={
                  bulkMode
                    ? spCode
                      ? () => toggleSp(spCode)
                      : undefined
                    : fieldMerge
                      ? () => openFieldMergeSheet(b)
                      : undefined
                }
              />
              {!fieldMerge && graphMode && detail && isExpanded ? (
                <FarmMapControllerDetail
                  label={detail.label}
                  metricId={expanded.metricId}
                  controllers={detail.controllers}
                  period={graphPeriod}
                  bars={GRAPH_BARS[graphPeriod]}
                  readings={controller?.readings ?? []}
                  thermoSettings={controller?.thermoSettings ?? {}}
                  commands={controller?.commands ?? []}
                  canCommand={Boolean(controller?.canCommand)}
                  alarmSettings={controller?.alarmSettings}
                  controllerTrendByPeriod={controllerTrendByPeriod}
                  onPeriodChange={setGraphPeriod}
                  trendLoading={trendLoading}
                  trendStale={trendStale}
                  onChangeMetric={(metricId) =>
                    setExpanded((e) => (e ? { ...e, metricId } : e))
                  }
                  onClose={handleDetailClose}
                  selectedReadingKey={detailSelectedReadingKey}
                  onSelectedReadingKeyChange={setDetailSelectedReadingKey}
                  onPickerNavigateReading={handlePickerNavigateReading}
                  hostedMobileSheetOpen={hostedSheetOpen}
                  hostedMobileSheetPage={hostedSheetPage}
                  onHostedMobileSheetOpenChange={setHostedSheetOpen}
                  onHostedMobileSheetPageChange={setHostedSheetPage}
                  onOpenChart={onOpenChart}
                />
              ) : null}
            </div>
          );
        })}
      </div>
      {/* Detail remount와 무관하게 sheet 유지 — 축사유형 전환 시 닫힘/재오픈 방지 */}
      <BarnListToolbarMobileSheet
        open={hostedSheetOpen}
        peek={hostedSheetPeek}
        suppressPeekHandle={suppressBottomOverlays}
        readings={controller?.readings ?? []}
        selectedKey={detailSelectedReadingKey}
        onSelectKey={handleHostedSheetSelectKey}
        onClose={closeHostedSheet}
        onPeek={() => setHostedSheetPeek(true)}
        onExpand={() => setHostedSheetPeek(false)}
        thermoSettings={controller?.thermoSettings ?? {}}
        commands={controller?.commands}
        alarmSettings={controller?.alarmSettings}
        canCommand={Boolean(controller?.canCommand)}
        controllerTrendByPeriod={controllerTrendByPeriod}
        trendLoading={trendLoading}
        trendStale={trendStale}
        bulkPeriod={graphPeriod}
        panelPeriodOverrides={panelPeriodOverrides}
        onPanelPeriodChange={handlePanelPeriodChange}
        onOpenChart={
          onOpenChart
            ? (reading) => {
                setSheetFollowsChart(true);
                onOpenChart(reading);
                clearPeekAfterChart();
                const peek = () => {
                  peekAfterChartRef.current = null;
                  setHostedSheetPeek(true);
                };
                if (
                  typeof window !== "undefined" &&
                  window.matchMedia("(prefers-reduced-motion: reduce)").matches
                ) {
                  peek();
                  return;
                }
                peekAfterChartRef.current = window.setTimeout(
                  peek,
                  CHART_THEN_PEEK_MS,
                );
              }
            : undefined
        }
        showPickerAffiliation
      />
      <InlineStatusToast
        message={statusToast?.message ?? null}
        tone={statusToast?.tone}
        onDismiss={() => setStatusToast(null)}
      />
    </div>
  );
}
