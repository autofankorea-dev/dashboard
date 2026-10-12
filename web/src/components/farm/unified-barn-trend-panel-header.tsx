import { PanelRight } from "lucide-react";
import type { ReactNode } from "react";
import { ChartScopeTargetMarks } from "@/components/farm/unified-barn-trend-scope-marks";
import type { UnifiedBarnTrendControllerRef } from "@/components/farm/unified-barn-trend-scope-marks";
import type { FarmChartScope } from "@/lib/farm/farm-chart-scope";
import { dashboardControlFill } from "@/lib/ui/dashboard-page-ui";
import { farmChartUi } from "@/lib/ui/farm-chart-ui-scale";
import { motionClass } from "@/lib/ui/motion-classes";
import { cn } from "@/lib/utils";

export function UnifiedBarnTrendPanelHeader({
  headingMode,
  label,
  chartScope,
  controllers,
  isMobileStack,
  mobileScopeHandle,
  headerActions,
  layerToolbar,
  controllerCount,
  trimmed,
}: {
  headingMode: "full" | "widget" | "overview";
  label: string;
  chartScope: FarmChartScope;
  controllers: UnifiedBarnTrendControllerRef[];
  isMobileStack: boolean;
  mobileScopeHandle: { open: boolean; onOpen: () => void } | null;
  headerActions: ReactNode;
  layerToolbar: ReactNode;
  controllerCount: number;
  trimmed: boolean;
}) {
  const renderHeaderTrailing = (opts?: { spacer?: boolean }) => (
    <div
      className={cn(
        "flex shrink-0 items-center justify-end gap-1",
        opts?.spacer && "invisible pointer-events-none",
      )}
      aria-hidden={opts?.spacer || undefined}
    >
      {isMobileStack && mobileScopeHandle ? (
        <button
          type="button"
          tabIndex={opts?.spacer ? -1 : undefined}
          className={cn(
            "inline-flex shrink-0 items-center justify-center rounded-md border px-2.5 py-1.5",
            farmChartUi.fsBody,
            dashboardControlFill.idle,
            motionClass.microHover,
          )}
          data-tour-id={opts?.spacer ? undefined : "farm-chart-scope-handle"}
          aria-label={`집계 범위 열기 · ${label}`}
          title={label}
          aria-expanded={mobileScopeHandle.open}
          onClick={opts?.spacer ? undefined : mobileScopeHandle.onOpen}
        >
          <PanelRight className="size-[1em] shrink-0" aria-hidden />
        </button>
      ) : null}
      {opts?.spacer ? (
        headerActions ? <div className="size-8" /> : null
      ) : (
        headerActions
      )}
    </div>
  );
  const hasHeaderTrailing = Boolean(
    headerActions || (isMobileStack && mobileScopeHandle),
  );

  if (headingMode === "overview") {
    return (
      <div className="flex h-7 min-w-0 shrink-0 items-center px-2">
        <span
          className="inline-flex min-w-0 items-center truncate text-xs font-medium"
          title={label}
        >
          <ChartScopeTargetMarks
            chartScope={chartScope}
            controllers={controllers}
            fallbackLabel={label}
            typeClassName="text-xs font-medium"
          />
        </span>
      </div>
    );
  }

  if (headingMode === "widget") {
    return (
      <div
        className={cn(
          "grid w-full min-w-0 shrink-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center",
          isMobileStack ? "min-h-11 px-3 pt-2.5 pb-1" : "h-11 px-2",
        )}
      >
        <div className="invisible pointer-events-none" aria-hidden>
          {hasHeaderTrailing ? renderHeaderTrailing({ spacer: true }) : null}
        </div>
        <div className="flex min-w-0 items-center justify-center gap-2">
          <div
            className="flex min-w-0 items-center gap-2 overflow-hidden"
            title={label}
          >
            <span
              className={cn(
                "inline-flex min-w-0 items-center truncate font-semibold",
                farmChartUi.fsTitle,
              )}
            >
              <ChartScopeTargetMarks
                chartScope={chartScope}
                controllers={controllers}
                fallbackLabel={label}
                typeClassName={cn("font-semibold", farmChartUi.fsTitle)}
              />
            </span>
          </div>
          {layerToolbar}
        </div>
        {hasHeaderTrailing ? renderHeaderTrailing() : <span />}
      </div>
    );
  }

  return (
    <div className="flex w-full shrink-0 flex-col items-stretch gap-1 sm:flex-row sm:items-center sm:gap-2">
      <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-2">
        <span className={cn("shrink-0 font-semibold", farmChartUi.fsTitle)}>
          통합 추이
        </span>
        <span
          className={cn(
            "leading-snug text-muted-foreground",
            farmChartUi.fsMeta,
          )}
        >
          {label} · 집계 {controllerCount}대
          {trimmed ? " · 실데이터 구간" : ""}
        </span>
      </div>
      {layerToolbar || hasHeaderTrailing ? (
        <div className="flex shrink-0 items-center gap-1">
          {layerToolbar}
          {hasHeaderTrailing ? renderHeaderTrailing() : null}
        </div>
      ) : null}
    </div>
  );
}
