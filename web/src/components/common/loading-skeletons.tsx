import {
  CONTROLLER_GRID_FLAT,
  FIELD_LIST_CONTAINER,
} from "@/lib/farm/controller-grid-layout";
import { dashboardUi } from "@/lib/ui/dashboard-page-ui";
import { cn } from "@/lib/utils";

/** 공통 shimmer 블록 */
function SkeletonBone({ className }: { className?: string }) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-muted/60", className)}
      aria-hidden
    />
  );
}

/** ControllerSummaryGaugeRow 골격 — 헤더 · EnvMetric · 채널 strip */
export function ControllerCardSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex flex-col overflow-hidden rounded-xl border bg-card",
        className,
      )}
      aria-busy="true"
      aria-label="컨트롤러 카드 불러오는 중"
    >
      <div className="px-2.5 pt-2.5 sm:px-3 sm:pt-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <SkeletonBone className="h-4 w-[5.5rem] sm:h-[1.1rem]" />
          <div className="flex shrink-0 gap-1">
            <SkeletonBone className="size-7 rounded-full sm:size-9" />
            <SkeletonBone className="size-7 rounded-full sm:size-9" />
            <SkeletonBone className="size-7 rounded-full sm:size-9" />
          </div>
        </div>
      </div>

      <div className="flex flex-1 flex-col px-2.5 pb-2.5 sm:px-3 sm:pb-3">
        <div className="mb-2 space-y-2.5 rounded-lg border border-border/80 bg-muted/10 p-2 sm:p-2.5">
          <div className="flex items-center justify-between gap-2">
            <SkeletonBone className="h-3 w-8" />
            <SkeletonBone className="h-3.5 w-10" />
          </div>
          <SkeletonBone className="h-2 w-full rounded-full" />
          <div className="flex items-center justify-between gap-2 pt-0.5">
            <SkeletonBone className="h-3 w-8" />
            <SkeletonBone className="h-3.5 w-10" />
          </div>
          <SkeletonBone className="h-2 w-full rounded-full" />
        </div>

        <div className="grid grid-cols-3 gap-1.5">
          <SkeletonBone className="h-8 rounded-md sm:h-9" />
          <SkeletonBone className="h-8 rounded-md sm:h-9" />
          <SkeletonBone className="h-8 rounded-md sm:h-9" />
        </div>
      </div>
    </div>
  );
}

/** 그래프 패널 — period chips + 차트 3단 */
export function GraphPanelSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn("space-y-3 px-2.5 pb-2.5 sm:px-3 sm:pb-3", className)}
      aria-busy="true"
      aria-label="추이 그래프 불러오는 중"
    >
      <div className="flex flex-wrap gap-1 rounded-lg border bg-muted/20 p-0.5">
        <SkeletonBone className="h-8 w-12 rounded-md" />
        <SkeletonBone className="h-8 w-12 rounded-md" />
        <SkeletonBone className="h-8 w-12 rounded-md" />
      </div>
      <div className="space-y-2 rounded-lg border bg-background p-2.5 sm:p-3">
        <SkeletonBone className="h-3 w-24" />
        <SkeletonBone className="h-[5.5rem] w-full rounded-md" />
        <SkeletonBone className="mt-2 h-3 w-24" />
        <SkeletonBone className="h-[4.5rem] w-full rounded-md" />
      </div>
      <div className="rounded-lg border bg-background p-2.5 sm:p-3">
        <SkeletonBone className="mb-2 h-3 w-28" />
        <SkeletonBone className="h-20 w-full rounded-md" />
      </div>
    </div>
  );
}

type FarmListSkeletonProps = {
  count?: number;
  className?: string;
};

/** BarnTable / view=list — SectionCard + 컨트롤러 카드 그리드 */
export function FarmListSkeleton({
  count = 6,
  className,
}: FarmListSkeletonProps) {
  return (
    <div
      className={cn(
        "rounded-xl border bg-card max-md:text-base md:text-[1.75rem]",
        className,
      )}
      aria-busy="true"
      aria-live="polite"
      data-audit-region="farm-list-skeleton"
    >
      <div
        className={cn(
          "flex flex-row flex-wrap items-start justify-between gap-3 border-b px-4 py-4 md:px-6",
          dashboardUi.cardHeaderLg,
        )}
      >
        <SkeletonBone className="h-6 w-28 md:h-7" />
        <div className="flex flex-wrap gap-2">
          <SkeletonBone className="h-9 w-24" />
          <SkeletonBone className="h-9 w-[5.5rem]" />
          <SkeletonBone className="h-9 w-32" />
        </div>
      </div>
      <div className={cn("p-4 md:p-6", dashboardUi.cardContentLg)}>
        <div className={cn(FIELD_LIST_CONTAINER, "min-w-0")}>
          <div className={CONTROLLER_GRID_FLAT}>
            {Array.from({ length: count }, (_, i) => (
              <ControllerCardSkeleton key={i} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

type AdminHubFarmSkeletonProps = {
  embedded?: boolean;
  className?: string;
};

/** Admin hub / FarmScopedPanel — 탭 + 지도 그리드 골격 */
export function AdminHubFarmSkeleton({
  embedded = false,
  className,
}: AdminHubFarmSkeletonProps) {
  return (
    <div
      className={cn(
        "flex flex-col overflow-hidden rounded-xl border bg-card",
        embedded ? "h-full min-h-[12rem]" : "min-h-[16rem]",
        className,
      )}
      aria-busy="true"
      aria-live="polite"
      data-audit-region={
        embedded ? "admin-hub-farm-scoped-mobile" : "admin-hub-farm-scoped"
      }
    >
      {!embedded ? (
        <div className="shrink-0 border-b px-3 py-2 md:px-4">
          <SkeletonBone className="h-4 w-44 md:h-5" />
        </div>
      ) : null}

      <div className="flex shrink-0 gap-2 border-b px-3 py-2 md:px-4">
        <SkeletonBone className="h-9 w-[4.5rem] rounded-lg" />
        <SkeletonBone className="h-9 w-[4.5rem] rounded-lg" />
      </div>

      <div className="min-h-0 flex-1 overflow-hidden p-3 md:p-4">
        <div
          className={cn(
            "grid min-h-[12rem] gap-1.5 rounded-md border bg-muted/10 p-3",
            "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4",
          )}
        >
          {Array.from({ length: 12 }, (_, i) => (
            <SkeletonBone
              key={i}
              className="aspect-[5/4] min-h-[3.5rem] rounded-md"
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/** Admin 전국 허브 — farm별 그리드 지연 로드 skeleton */
export function AdminHubGridSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn("space-y-6", className)}
      aria-busy="true"
      aria-label="농장 그리드 불러오는 중"
    >
      {Array.from({ length: 2 }, (_, i) => (
        <AdminHubFarmSkeleton key={i} />
      ))}
    </div>
  );
}

/** farm Suspense — view=list 이면 목록, 아니면 hub 지도 */
export function FarmContentSkeleton({
  view,
  className,
}: {
  view?: string | null;
  className?: string;
}) {
  if (view === "list") {
    return <FarmListSkeleton className={className} />;
  }
  return <AdminHubFarmSkeleton className={className} />;
}
