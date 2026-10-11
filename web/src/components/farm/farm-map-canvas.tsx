"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import type { BarnMapSnapshot, BarnReading } from "@/lib/data/iot";
import { patchBarnGridsAction } from "@/app/(dashboard)/farm/actions";
import { parseBarnCatalogKey } from "@/lib/domain/barn-catalog";
import { type FarmKey } from "@/lib/domain/farm-key";
import {
  DEFAULT_TREND_PERIOD,
  hasStallTrendByPeriod,
  type TrendControllerPeriodData,
  type TrendPeriodData,
  type TrendPeriodId,
} from "@/lib/domain/farm-trend-types";
import {
  clearMapDrillParams,
  currentFarmSearchParams,
  replaceFarmUrlShallow,
} from "@/lib/farm/farm-view-url";
import { GRAPH_BARS, barnIdForReading, useBarnGraphs } from "@/lib/farm/use-barn-graphs";
import { useFarmTourGridAction } from "@/lib/onboarding/use-farm-tour-grid-action";
import type { ControllerGridData } from "@/lib/farm/controller-grid-data";
import { FarmMapControllerDetail } from "./farm-map-controller-detail";
import { FarmMapCard } from "./farm-map-card";
import {
  InlineStatusToast,
  type InlineStatusTone,
} from "@/components/common/inline-status-toast";
import { useFarmLiveRefreshOptional } from "@/lib/navigation/farm-live-refresh";
import { scheduleSafeRouterRefresh } from "@/lib/navigation/safe-router-refresh";
import { motionClass } from "@/lib/ui/motion-classes";
import { cn } from "@/lib/utils";

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
type Props = {
  initialBarns: BarnMapSnapshot[];
  gridCols: number;
  gridRows: number;
  /** 전체 3기간(24h/7d/30d) 추이 시계열 — 그래프 모핑용. */
  trendByPeriod?: Record<TrendPeriodId, TrendPeriodData> | null;
  /** 컨트롤러 단위 3기간 시계열 — 히트맵 확대 시 컨트롤러별 미니 히트맵용(그리드 진입 프리페치). */
  controllerTrendByPeriod?: Record<TrendPeriodId, TrendControllerPeriodData> | null;
  /** in-grid 컨트롤러 카드플립 구동용 데이터. */
  controller?: ControllerGridData | null;
  hubMode?: boolean;
  /** Admin 전체 보기 — 카드 클릭 시 해당 farm scoped URL로 이동 */
  navigateFarmKey?: FarmKey | null;
  trendPeriod?: TrendPeriodId;
  onTrendPeriodChange?: (period: TrendPeriodId) => void;
  trendLoading?: boolean;
  trendStale?: boolean;
  fieldMerge?: boolean;
  onOpenChart?: (reading: BarnReading) => void;
};

const GRID_COL_MIN = "4.75rem";
const GRID_ROW_TRACK = "minmax(3.5rem, auto)";

function gridMinHeight(rows: number): string {
  if (rows <= 2) return "26rem";
  if (rows <= 4) return "34rem";
  if (rows <= 6) return "44rem";
  return "54rem";
}

function moveBarn(
  barns: BarnMapSnapshot[],
  draggedId: string,
  toCol: number,
  toRow: number
): BarnMapSnapshot[] {
  const dragged = barns.find((b) => b.meta.id === draggedId);
  if (!dragged) return barns;
  if (dragged.meta.grid.col === toCol && dragged.meta.grid.row === toRow) {
    return barns;
  }

  const from = dragged.meta.grid;
  const occupant = barns.find(
    (b) =>
      b.meta.id !== draggedId &&
      b.meta.grid.col === toCol &&
      b.meta.grid.row === toRow
  );

  return barns.map((b) => {
    if (b.meta.id === draggedId) {
      return {
        ...b,
        meta: { ...b.meta, grid: { col: toCol, row: toRow } },
      };
    }
    if (occupant && b.meta.id === occupant.meta.id) {
      return {
        ...b,
        meta: { ...b.meta, grid: { col: from.col, row: from.row } },
      };
    }
    return b;
  });
}

function layoutPatch(
  prev: BarnMapSnapshot[],
  next: BarnMapSnapshot[]
): Record<string, { col: number; row: number }> {
  const patch: Record<string, { col: number; row: number }> = {};
  for (const b of next) {
    const old = prev.find((p) => p.meta.id === b.meta.id);
    if (!old) continue;
    if (
      old.meta.grid.col !== b.meta.grid.col ||
      old.meta.grid.row !== b.meta.grid.row
    ) {
      patch[b.meta.id] = { col: b.meta.grid.col, row: b.meta.grid.row };
    }
  }
  return patch;
}

function readCellFromPoint(clientX: number, clientY: number): { col: number; row: number } | null {
  const el = document.elementFromPoint(clientX, clientY);
  const cell = el?.closest("[data-grid-cell]") as HTMLElement | null;
  if (!cell?.dataset.col || !cell?.dataset.row) return null;
  return {
    col: Number(cell.dataset.col),
    row: Number(cell.dataset.row),
  };
}

export function FarmMapCanvas({
  initialBarns,
  gridCols,
  gridRows,
  trendByPeriod,
  controllerTrendByPeriod,
  controller,
  hubMode = false,
  navigateFarmKey = null,
  trendPeriod: trendPeriodProp,
  onTrendPeriodChange,
  trendLoading = false,
  trendStale = false,
  fieldMerge = false,
  onOpenChart,
}: Props) {
  const router = useRouter();
  const liveRefresh = useFarmLiveRefreshOptional();
  const isOverviewFarm = Boolean(navigateFarmKey);
  const [barns, setBarns] = useState(initialBarns);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [pendingSaves, setPendingSaves] = useState(0);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [bulkMode, setBulkMode] = useState(false);
  const [localGraphPeriod, setLocalGraphPeriod] =
    useState<TrendPeriodId>(DEFAULT_TREND_PERIOD);
  const graphPeriod = trendPeriodProp ?? localGraphPeriod;
  const setGraphPeriod = onTrendPeriodChange ?? setLocalGraphPeriod;
  const [selectedSps, setSelectedSps] = useState<Set<string>>(new Set());
  const [statusToast, setStatusToast] = useState<{
    message: string;
    tone: InlineStatusTone;
  } | null>(null);
  const draggedIdRef = useRef<string | null>(null);
  const barnsRef = useRef(barns);
  useEffect(() => {
    barnsRef.current = barns;
  });

  const bulkEnabled = Boolean(controller?.canCommand);

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

  const minHeight = useMemo(() => gridMinHeight(gridRows), [gridRows]);

  /**
   * 근접 레이아웃 — 상세 확대 시 보드를 '사용 중인 행'까지만 축소해
   * 하단 전체폭 상세 패널이 소스 카드 바로 아래에 붙도록 한다.
   */
  const usedRows = useMemo(
    () => barns.reduce((m, b) => Math.max(m, b.meta.grid.row), 1),
    [barns],
  );

  const graphAvailable = hasStallTrendByPeriod(trendByPeriod);
  /** 병합 카드 — 추이 데이터가 있고 일괄모드가 아니면 요약+히트맵을 함께 표시. */
  const graphMode = graphAvailable && !bulkMode;
  /** 병합 카드는 요약(온·습도) + 히트맵이 들어가 요약 전용보다 큰 행 트랙 필요. */
  const rowTrack = graphMode ? "minmax(13rem, auto)" : GRID_ROW_TRACK;
  // 그리드/모바일 공용 — 히트맵 그래프 콘텐츠 + 확대 상세(데이터 없으면 히트맵 미표시).
  const { expanded, setExpanded, graphByBarnId, metricIdsByBarnId, detail } = useBarnGraphs({
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
  const [lastBulkMode, setLastBulkMode] = useState(bulkMode);

  if (bulkMode !== lastBulkMode) {
    if (bulkMode) {
      setExpanded(null);
      setDetailSelectedReadingKey(null);
    }
    setLastBulkMode(bulkMode);
  }

  const handleDetailClose = useCallback(() => {
    setExpanded(null);
    setDetailSelectedReadingKey(null);
  }, [setExpanded]);

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

  useFarmTourGridAction({ barns, metricIdsByBarnId, setExpanded });

  /** 상세 확대 중 — 보드를 '사용 중인 행'까지 축소해 상세 패널을 근접 배치. */
  const focusMode = graphMode && Boolean(expanded);
  const effRows = focusMode ? usedRows : gridRows;

  const barnIdsKey = useMemo(
    () => initialBarns.map((b) => b.meta.id).sort().join("|"),
    [initialBarns]
  );
  const [barnsProp, setBarnsProp] = useState(initialBarns);
  const [seenBarnIdsKey, setSeenBarnIdsKey] = useState(barnIdsKey);
  const prevBarnIdsKeyRef = useRef(barnIdsKey);

  if (initialBarns !== barnsProp) {
    setBarnsProp(initialBarns);
    setBarns(initialBarns);
  }

  if (barnIdsKey !== seenBarnIdsKey) {
    setSeenBarnIdsKey(barnIdsKey);
    // 축사 구성(농장/스코프)이 바뀐 경우에만 그리드로 리셋.
    // 값만 갱신되는 폴링·명령 후 refresh 시에는 열린 그래프/컨트롤러 뷰 유지.
    setExpanded(null);
    setDetailSelectedReadingKey(null);
  }

  useEffect(() => {
    if (prevBarnIdsKeyRef.current === barnIdsKey) return;
    prevBarnIdsKeyRef.current = barnIdsKey;
    const params = currentFarmSearchParams();
    if (params.get("sp") || params.get("stall") || params.get("mapLevel")) {
      clearMapDrillParams(params);
      replaceFarmUrlShallow(params);
    }
  }, [barnIdsKey]);

  const persistPatch = useCallback(
    (prev: BarnMapSnapshot[], next: BarnMapSnapshot[]) => {
      const patch = layoutPatch(prev, next);
      if (Object.keys(patch).length === 0) return;

      setSaveError(null);
      setPendingSaves((n) => n + 1);
      void patchBarnGridsAction(patch)
        .then((result) => {
          if (!result.ok) {
            setBarns(prev);
            setSaveError("위치 저장에 실패했습니다.");
          }
        })
        .catch(() => {
          setBarns(prev);
          setSaveError("위치 저장에 실패했습니다.");
        })
        .finally(() => setPendingSaves((n) => Math.max(0, n - 1)));
    },
    []
  );

  const handleDrop = useCallback(
    (draggedIdValue: string, col: number, row: number) => {
      if (!draggedIdValue) return;
      const prev = barnsRef.current;
      const next = moveBarn(prev, draggedIdValue, col, row);
      if (next === prev) return;
      setBarns(next);
      persistPatch(prev, next);
    },
    [persistPatch]
  );

  const endDrag = useCallback(() => {
    draggedIdRef.current = null;
    setDraggedId(null);
    setDropTarget(null);
    document.body.style.cursor = "";
  }, []);

  const startDrag = useCallback((id: string, e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    draggedIdRef.current = id;
    setDraggedId(id);
    document.body.style.cursor = "grabbing";
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  useEffect(() => {
    if (!draggedId) return;

    const onMove = (e: PointerEvent) => {
      const cell = readCellFromPoint(e.clientX, e.clientY);
      if (cell) {
        setDropTarget(`${cell.col}-${cell.row}`);
      }
    };

    const onUp = (e: PointerEvent) => {
      const id = draggedIdRef.current;
      if (id) {
        const cell = readCellFromPoint(e.clientX, e.clientY);
        if (cell) handleDrop(id, cell.col, cell.row);
      }
      endDrag();
      if (e.target instanceof HTMLElement && e.pointerId) {
        try {
          e.target.releasePointerCapture(e.pointerId);
        } catch {
          /* capture may already be released */
        }
      }
    };

    const onCancel = () => endDrag();

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
    };
  }, [draggedId, handleDrop, endDrag]);

  const cells = Array.from({ length: effRows }, (_, ri) =>
    Array.from({ length: gridCols }, (_, ci) => ({
      col: ci + 1,
      row: ri + 1,
    }))
  ).flat();

  const isDragging = draggedId !== null;

  return (
    <div
      className="relative flex min-h-0 flex-col rounded-md border"
      data-audit-desktop-only
      style={{ minHeight: focusMode ? undefined : minHeight }}
    >
      {bulkEnabled && controller && !isOverviewFarm ? (
        <FarmMapBulkApply
          controller={controller}
          bulkMode={bulkMode}
          selectedSps={Array.from(selectedSps)}
          onEnter={() => {
            setBulkMode(true);
            handleDetailClose();
          }}
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
      {pendingSaves > 0 && (
        <div className="absolute bottom-3 left-3 z-30 flex items-center gap-1.5 rounded-md bg-background/90 px-2 py-1 text-xs text-muted-foreground shadow">
          <Loader2 className="size-3 animate-spin md:size-5" />
          위치 저장 중…
        </div>
      )}
      {saveError ? (
        <div className="absolute bottom-3 right-3 z-30 rounded-md bg-destructive/10 px-2 py-1 text-xs text-destructive shadow">
          {saveError}
        </div>
      ) : null}
      <div
        className={cn(
          fieldMerge &&
            focusMode &&
            "lg:grid lg:grid-cols-2 lg:items-start lg:gap-3 lg:p-3",
        )}
      >
      <div
        className={cn(
          "grid min-h-0 gap-1.5 overflow-auto p-3",
          // 상세 확대 중에는 보드가 남은 높이를 채우지 않도록 flex-1 해제(근접 배치).
          focusMode ? "shrink-0" : "flex-1",
          fieldMerge && focusMode && "lg:p-0",
          "bg-[linear-gradient(to_right,hsl(var(--border)/0.45)_1px,transparent_1px),linear-gradient(to_bottom,hsl(var(--border)/0.45)_1px,transparent_1px)]",
          "bg-[size:20px_20px] bg-muted/10 dark:bg-muted/6",
          isDragging && "select-none"
        )}
        data-tour-id="map-grid"
        style={{
          minHeight: focusMode ? undefined : minHeight,
          gridTemplateColumns: `repeat(${gridCols}, minmax(${GRID_COL_MIN}, 1fr))`,
          gridTemplateRows: `repeat(${effRows}, ${rowTrack})`,
        }}
      >
        {cells.map(({ col, row }) => {
          const key = `${col}-${row}`;
          const isTarget = dropTarget === key;
          return (
            <div
              key={`drop-${key}`}
              data-grid-cell
              data-col={col}
              data-row={row}
              className={cn(
                "z-0 min-h-[3.25rem] rounded-md border border-transparent",
                motionClass.microHover,
                isTarget && "border-emerald-400 bg-emerald-50/60"
              )}
              style={{ gridColumn: col, gridRow: row }}
            />
          );
        })}

        {barns.map((b) => {
          const { col, row } = b.meta.grid;
          const key = `${col}-${row}`;
          const isTarget = dropTarget === key;
          const isThisDragging = draggedId === b.meta.id;
          const spCode = parseBarnCatalogKey(b.meta.id)?.stallTyCode ?? "";
          const selectForDetail =
            fieldMerge && graphMode && !bulkMode
              ? () => {
                  const metrics = metricIdsByBarnId.get(b.meta.id);
                  const metricId = metrics?.[0] ?? "T";
                  setExpanded({ barnId: b.meta.id, metricId });
                }
              : undefined;
          return (
            <div
              key={b.meta.id}
              data-grid-cell
              data-col={col}
              data-row={row}
              className={cn(
                "relative z-20 flex min-h-0 min-w-0 flex-col self-start",
                motionClass.transitionLayout,
                motionClass.easeEnter,
                isTarget && "rounded-lg ring-2 ring-emerald-400 ring-offset-1",
                expanded?.barnId === b.meta.id &&
                  "rounded-lg ring-2 ring-primary/50 ring-offset-1",
                isDragging && "pointer-events-none",
                isThisDragging && "z-30 opacity-60"
              )}
              style={{
                gridColumn: col,
                gridRow: row,
              }}
            >
              <FarmMapCard
                snapshot={b}
                layout="stack"
                compact
                draggable={!bulkMode}
                isDragging={isThisDragging}
                onGripPointerDown={startDrag}
                graphContent={
                  graphMode ? graphByBarnId.get(b.meta.id) : undefined
                }
                selectable={
                  (bulkMode && Boolean(spCode)) || Boolean(selectForDetail)
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
                    : selectForDetail
                }
              />
            </div>
          );
        })}
      </div>
      {graphMode && detail && expanded ? (
        <FarmMapControllerDetail
          label={detail.label}
          metricId={expanded.metricId}
          controllers={detail.controllers}
          gridCols={fieldMerge && focusMode ? 1 : gridCols}
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
          onOpenChart={onOpenChart}
        />
      ) : null}
      </div>
      <InlineStatusToast
        message={statusToast?.message ?? null}
        tone={statusToast?.tone}
        onDismiss={() => setStatusToast(null)}
      />
    </div>
  );
}
