import type { Ref } from "react";
import { LineChart, List, Map } from "lucide-react";
import { StallUnitIcon } from "@/components/icons/stall-unit-icon";
import type { FarmHubView } from "@/lib/farm/farm-view-url";
import {
  dashboardAffordance,
  dashboardChroma,
  dashboardUi,
} from "@/lib/ui/dashboard-page-ui";
import { motionClass } from "@/lib/ui/motion-classes";
import { cn } from "@/lib/utils";

export function FarmViewToggle({
  hideViewTabs,
  tablistRef,
  embedInScopeHeader,
  viewportCompact,
  gridCompactShell,
  tabPill,
  fieldMerge,
  fieldActive,
  view,
  onView,
}: {
  hideViewTabs: boolean;
  tablistRef: Ref<HTMLDivElement>;
  embedInScopeHeader: boolean;
  viewportCompact: boolean;
  gridCompactShell: boolean;
  tabPill: { left: number; width: number };
  fieldMerge: boolean;
  fieldActive: boolean;
  view: FarmHubView;
  onView: (view: FarmHubView) => void;
}) {
  if (hideViewTabs) return null;

  const tabNavClass =
    gridCompactShell || viewportCompact || embedInScopeHeader
      ? "text-sm font-medium md:text-sm"
      : dashboardUi.tabNav;

  const viewTabBtn = (active: boolean) =>
    cn(
      "relative z-[1] inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg font-medium",
      embedInScopeHeader && viewportCompact
        ? "min-w-0 flex-1 px-2 py-2.5"
        : embedInScopeHeader
          ? "shrink-0 px-2.5 py-1.5 sm:px-3"
          : "shrink-0 gap-2 px-5 py-2.5",
      motionClass.microInteractive,
      tabNavClass,
      active
        ? dashboardChroma.chromeActiveText
        : dashboardAffordance.choiceIdle,
    );

  return (
    <div
      ref={tablistRef}
      className={cn(
        "relative inline-flex max-w-full flex-nowrap rounded-xl border bg-muted/40 p-1",
        embedInScopeHeader && viewportCompact
          ? "w-full text-sm"
          : embedInScopeHeader
            ? "w-auto shrink-0 text-sm"
            : gridCompactShell || viewportCompact
              ? "text-sm md:text-sm"
              : dashboardUi.body,
      )}
      role="tablist"
      aria-label="농장 보기"
      data-tour-id="view-toggle"
    >
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute top-1 bottom-1 z-0 rounded-lg",
          dashboardChroma.viewTabPill,
          motionClass.viewTabPill,
          tabPill.width <= 0 && "opacity-0",
        )}
        style={{
          left: tabPill.left,
          width: tabPill.width,
        }}
      />
      {fieldMerge ? (
        <button
          type="button"
          role="tab"
          aria-selected={fieldActive}
          className={viewTabBtn(fieldActive)}
          onClick={() => onView("map")}
        >
          <StallUnitIcon
            className={dashboardUi.iconSm}
            strokeWidth={dashboardUi.iconStroke}
            aria-hidden
          />
          필드
        </button>
      ) : (
        <>
          <button
            type="button"
            role="tab"
            aria-selected={view === "map"}
            className={viewTabBtn(view === "map")}
            onClick={() => onView("map")}
          >
            <Map
              className={dashboardUi.iconSm}
              strokeWidth={dashboardUi.iconStroke}
              aria-hidden
            />
            그리드
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={view === "list"}
            className={viewTabBtn(view === "list")}
            onClick={() => onView("list")}
          >
            <List
              className={dashboardUi.iconSm}
              strokeWidth={dashboardUi.iconStroke}
              aria-hidden
            />
            목록
          </button>
        </>
      )}
      <button
        type="button"
        role="tab"
        aria-selected={view === "chart"}
        className={viewTabBtn(view === "chart")}
        onClick={() => onView("chart")}
      >
        <LineChart
          className={dashboardUi.iconSm}
          strokeWidth={dashboardUi.iconStroke}
          aria-hidden
        />
        차트
      </button>
    </div>
  );
}
