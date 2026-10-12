"use client";

import dynamic from "next/dynamic";
import { SectionCard } from "@/components/common/section-card";
import type { BarnMapSnapshot, BarnReading } from "@/lib/data/iot";
import {
  farmGridEmptyCopy,
  resolveFarmGridEmptyReason,
} from "@/lib/domain/farm-grid-empty";
import type { FarmKey } from "@/lib/domain/farm-key";
import type {
  TrendControllerPeriodData,
  TrendPeriodData,
  TrendPeriodId,
} from "@/lib/domain/farm-trend-types";
import type { ControllerGridData } from "@/lib/farm/controller-grid-data";
import { useHydrationSafeDashboardCompact } from "@/components/layout/dashboard-viewport-context";

const FarmMapCanvas = dynamic(
  () =>
    import("./farm-map-canvas").then((m) => ({ default: m.FarmMapCanvas })),
  {
    ssr: false,
    loading: () => (
      <div className="min-h-[24rem] animate-pulse rounded-md bg-muted/30" />
    ),
  },
);

const FarmMapMobileStage = dynamic(
  () =>
    import("./farm-map-mobile-stage").then((m) => ({
      default: m.FarmMapMobileStage,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="min-h-[24rem] animate-pulse rounded-md bg-muted/30" />
    ),
  },
);

type Props = {
  barns: BarnMapSnapshot[];
  readings?: BarnReading[];
  gridCols?: number;
  gridRows?: number;
  trendByPeriod?: Record<TrendPeriodId, TrendPeriodData> | null;
  controllerTrendByPeriod?: Record<
    TrendPeriodId,
    TrendControllerPeriodData
  > | null;
  hubMode?: boolean;
  compactShell?: boolean;
  controller?: ControllerGridData | null;
  sectionTitle?: string;
  navigateFarmKey?: FarmKey | null;
  trendPeriod?: TrendPeriodId;
  onTrendPeriodChange?: (period: TrendPeriodId) => void;
  trendLoading?: boolean;
  trendStale?: boolean;
  /** 그리드·목록 통합 — 카드 선택·차트 이동 */
  fieldMerge?: boolean;
  onOpenChart?: (reading: BarnReading) => void;
  /** 차트 탭 활성 시 하단 peek 핸들 등 오버레이 억제(브러시 영역 확보) */
  suppressBottomOverlays?: boolean;
};

export function FarmMapView({
  barns,
  readings = [],
  gridCols = 4,
  gridRows = 4,
  trendByPeriod,
  controllerTrendByPeriod,
  controller,
  hubMode = false,
  compactShell = false,
  sectionTitle,
  navigateFarmKey = null,
  trendPeriod,
  onTrendPeriodChange,
  trendLoading = false,
  trendStale = false,
  fieldMerge = false,
  onOpenChart,
  suppressBottomOverlays = false,
}: Props) {
  const viewportCompact = useHydrationSafeDashboardCompact();
  const emptyReason =
    barns.length === 0 ? resolveFarmGridEmptyReason(readings) : null;
  const emptyCopy = emptyReason ? farmGridEmptyCopy(emptyReason) : null;
  const sectionSize =
    compactShell || viewportCompact ? ("default" as const) : ("lg" as const);

  return (
    <div className="min-w-0">
      <SectionCard
        title={sectionTitle}
        description={undefined}
        size={sectionSize}
        className="overflow-hidden"
      >
        {emptyCopy ? (
          <div className="flex min-h-[24rem] flex-col items-center justify-center gap-3 rounded-md border border-dashed bg-muted/30 px-4 py-8 text-center">
            <p
              className={
                compactShell
                  ? "text-sm text-muted-foreground"
                  : "text-sm text-muted-foreground md:text-base"
              }
            >
              {emptyCopy.title}
            </p>
            <p className="text-xs text-muted-foreground">{emptyCopy.detail}</p>
          </div>
        ) : viewportCompact ? (
          <FarmMapMobileStage
            barns={barns}
            trendByPeriod={trendByPeriod}
            controllerTrendByPeriod={controllerTrendByPeriod}
            controller={controller}
            hubMode={hubMode}
            trendPeriod={trendPeriod}
            onTrendPeriodChange={onTrendPeriodChange}
            trendLoading={trendLoading}
            trendStale={trendStale}
            fieldMerge={fieldMerge}
            onOpenChart={onOpenChart}
            suppressBottomOverlays={suppressBottomOverlays}
          />
        ) : (
          <FarmMapCanvas
            initialBarns={barns}
            gridCols={gridCols}
            gridRows={gridRows}
            trendByPeriod={trendByPeriod}
            controllerTrendByPeriod={controllerTrendByPeriod}
            controller={controller}
            hubMode={hubMode}
            navigateFarmKey={navigateFarmKey}
            trendPeriod={trendPeriod}
            onTrendPeriodChange={onTrendPeriodChange}
            trendLoading={trendLoading}
            trendStale={trendStale}
            fieldMerge={fieldMerge}
            onOpenChart={onOpenChart}
          />
        )}
      </SectionCard>
    </div>
  );
}
