"use client";

import { useMemo, useSyncExternalStore, useTransition } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { Capacitor } from "@capacitor/core";
import { ChevronDown, Loader2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  appendFarmKeyParams,
  farmKeyId,
  type FarmKey,
} from "@/lib/domain/farm-key";
import {
  farmShortLabel,
  type FarmSummaryRow,
} from "@/lib/domain/farm-summaries";
import {
  clearHubFarmDrillParams,
  currentFarmSearchParams,
  replaceFarmUrlShallow,
} from "@/lib/farm/farm-view-url";
import { useAdminHubPanelsOptional } from "@/lib/navigation/admin-hub-panels-context";
import { useAppNavigate } from "@/components/layout/use-app-navigate";
import { accountMenuLayout } from "@/lib/ui/account-menu-layout";
import { dashboardUi } from "@/lib/ui/dashboard-page-ui";
import { cn } from "@/lib/utils";
import { useSheetCopy } from "@/components/account/profile-sheet-prefs";

const emptySubscribe = () => () => {};

type FarmSwitcherProps = {
  farmOptions: FarmKey[];
  activeFarmKey: FarmKey | null;
  farmSummaries?: FarmSummaryRow[];
  /** OpsScopeBar — compact pill trigger */
  compact?: boolean;
  /**
   * dropdown: 기본 트리거+메뉴
   * inline: 부모 안에 목록만 (중첩 메뉴 방지)
   * matrix: 계정 시트 하단 격자
   */
  variant?: "dropdown" | "inline" | "matrix";
  /** inline 선택 후 부모 메뉴 닫기 등 */
  onNavigated?: () => void;
  /** inline 목록 컨테이너 class (계정 메뉴 탭 body 등) */
  inlineListClassName?: string;
};

/** useSearchParams — 클라이언트 마운트 후 렌더로 hydration 불일치 방지 */
export function FarmSwitcher(props: FarmSwitcherProps) {
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);

  if (!mounted) {
    if (props.variant === "inline" || props.variant === "matrix") {
      return (
        <div
          className={
            props.variant === "matrix"
              ? accountMenuLayout.farmMatrixGrid
              : "min-h-8 px-3 py-2"
          }
          aria-hidden
          data-tour-id="farm-switcher"
        />
      );
    }
    return (
      <div
        className={cn(
          "max-w-full",
          props.compact ? "min-h-[3.25rem]" : "min-h-[3rem]",
          !props.compact && dashboardUi.body
        )}
        aria-hidden
      />
    );
  }

  return <FarmSwitcherBody {...props} />;
}

function FarmSwitcherBody({
  farmOptions,
  activeFarmKey,
  farmSummaries = [],
  compact = false,
  variant = "dropdown",
  onNavigated,
  inlineListClassName,
}: FarmSwitcherProps) {
  const t = useSheetCopy();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const hubPanels = useAdminHubPanelsOptional();
  const { navigate: appNavigate, isPending: navPending } = useAppNavigate();
  const [shallowPending, startShallowTransition] = useTransition();
  const switchPending = navPending || shallowPending;

  const alarmByFarmId = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of farmSummaries) {
      map.set(farmKeyId(row.farmKey), row.alarmCount);
    }
    return map;
  }, [farmSummaries]);

  const liveByFarmId = useMemo(() => {
    const map = new Map<string, boolean>();
    for (const row of farmSummaries) {
      map.set(farmKeyId(row.farmKey), row.controllerCount > 0);
    }
    return map;
  }, [farmSummaries]);

  const orderedFarmOptions = useMemo(() => {
    if (liveByFarmId.size === 0) return farmOptions;
    return [...farmOptions].sort((a, b) => {
      const aLive = liveByFarmId.get(farmKeyId(a)) === true ? 0 : 1;
      const bLive = liveByFarmId.get(farmKeyId(b)) === true ? 0 : 1;
      if (aLive !== bLive) return aLive - bLive;
      return farmKeyId(a).localeCompare(farmKeyId(b));
    });
  }, [farmOptions, liveByFarmId]);

  const navigate = (farmKey: FarmKey | null) => {
    onNavigated?.();
    // /farm shallow는 window URL 기준 — useSearchParams는 탭·기간 desync됨.
    const params =
      pathname === "/farm"
        ? new URLSearchParams(currentFarmSearchParams().toString())
        : new URLSearchParams(searchParams.toString());
    params.delete("lsind");
    params.delete("item");

    if (pathname === "/farm") {
      clearHubFarmDrillParams(params);
    }

    if (farmKey) {
      appendFarmKeyParams(params, farmKey);
    }

    const query = params.toString();
    const href = query ? `${pathname}?${query}` : pathname;
    // Capacitor WebView: router.push/shallow는 window.location·RSC 스코프가
    // 어긋나 허브 빈 문구("표시할 농장 그리드가 없습니다")로 남는 경우가 있다.
    // 네이티브는 document 로드로 SSR 단건 패널을 확정한다.
    if (Capacitor.isNativePlatform()) {
      window.location.assign(href);
      return;
    }

    const useShallow =
      pathname === "/farm" &&
      hubPanels?.ready === true &&
      hubPanels.panels.length > 0;

    if (useShallow) {
      startShallowTransition(() => {
        replaceFarmUrlShallow(params);
        hubPanels.notifyHubUrlChange();
      });
      return;
    }

    appNavigate(href, { message: "농장 전환 중…" });
  };

  if (farmOptions.length === 0) return null;

  const activeId = activeFarmKey ? farmKeyId(activeFarmKey) : null;
  const triggerLabel =
    activeFarmKey === null
      ? t("farm.all", { count: farmOptions.length })
      : farmShortLabel(activeFarmKey);

  const itemClass = (active: boolean) =>
    cn(
      compact
        ? dashboardUi.scopePillMenuItem
        : "gap-3 rounded-lg px-3 py-2.5 text-sm leading-snug md:text-[length:var(--density-meta-md)]",
      active && dashboardUi.menuItemActive,
    );

  const farmRows = (
    <>
      <button
        type="button"
        onClick={() => navigate(null)}
        className={cn(
          "flex w-full cursor-default items-center rounded-sm px-3 py-2 text-left outline-none select-none hover:bg-muted",
          itemClass(activeId === null),
        )}
      >
        <span className="flex-1 font-medium">
          {t("farm.all", { count: farmOptions.length })}
        </span>
      </button>
      {orderedFarmOptions.map((farmKey) => {
        const id = farmKeyId(farmKey);
        const alarms = alarmByFarmId.get(id);
        const hasLiveSummary = liveByFarmId.has(id);
        const isLive = liveByFarmId.get(id) === true;
        return (
          <button
            type="button"
            key={id}
            onClick={() => navigate(farmKey)}
            className={cn(
              "flex w-full cursor-default items-center rounded-sm px-3 py-2 text-left outline-none select-none hover:bg-muted",
              itemClass(activeId === id),
            )}
          >
            <span className="flex min-w-0 flex-1 items-center gap-2">
              <span className="truncate">{farmShortLabel(farmKey)}</span>
              {hasLiveSummary ? (
                isLive ? (
                  <span className={dashboardUi.brandChip}>LIVE</span>
                ) : (
                  <span className={dashboardUi.locationChip}>
                    위치만
                  </span>
                )
              ) : null}
            </span>
            {alarms !== undefined ? (
              <span
                className={cn(
                  "tabular-nums font-semibold",
                  "text-sm leading-snug md:text-[length:var(--density-meta-md)]",
                  alarms > 0
                    ? "text-status-warn"
                    : "text-muted-foreground",
                )}
              >
                {alarms}
              </span>
            ) : null}
          </button>
        );
      })}
    </>
  );

  if (variant === "matrix") {
    return (
      <div
        id="account-menu-farm-matrix"
        className={accountMenuLayout.farmMatrix}
        data-tour-id="farm-switcher"
        aria-busy={switchPending || undefined}
        aria-label="농장 선택"
        onPointerDown={(e) => e.stopPropagation()}
      >
        {switchPending ? (
          <p className="mb-1.5 flex items-center gap-2 text-[length:var(--density-meta)] text-muted-foreground">
            <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
            전환 중…
          </p>
        ) : null}
        <div className={accountMenuLayout.farmMatrixGrid}>
          <button
            type="button"
            onClick={() => navigate(null)}
            className={cn(
              accountMenuLayout.farmMatrixCell,
              activeId === null && accountMenuLayout.farmMatrixCellActive,
            )}
            aria-current={activeId === null ? "true" : undefined}
          >
            <span className={accountMenuLayout.farmMatrixLabel}>
              {t("farm.all", { count: farmOptions.length })}
            </span>
          </button>
          {orderedFarmOptions.map((farmKey) => {
            const id = farmKeyId(farmKey);
            const alarms = alarmByFarmId.get(id);
            const hasLiveSummary = liveByFarmId.has(id);
            const isLive = liveByFarmId.get(id) === true;
            return (
              <button
                type="button"
                key={id}
                onClick={() => navigate(farmKey)}
                className={cn(
                  accountMenuLayout.farmMatrixCell,
                  activeId === id && accountMenuLayout.farmMatrixCellActive,
                )}
                aria-current={activeId === id ? "true" : undefined}
              >
                <span className={accountMenuLayout.farmMatrixLabel}>
                  {farmShortLabel(farmKey)}
                </span>
                <span className={accountMenuLayout.farmMatrixMeta}>
                  {hasLiveSummary ? (
                    isLive ? (
                      <span className={dashboardUi.brandChip}>LIVE</span>
                    ) : (
                      <span className={dashboardUi.locationChip}>
                        위치만
                      </span>
                    )
                  ) : (
                    <span aria-hidden>{"\u00a0"}</span>
                  )}
                  {alarms !== undefined ? (
                    <span
                      className={cn(
                        accountMenuLayout.farmMatrixCount,
                        alarms > 0 && "font-medium text-status-warn",
                      )}
                    >
                      {alarms}
                    </span>
                  ) : (
                    <span aria-hidden>{"\u00a0"}</span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  if (variant === "inline") {
    return (
      <div
        className={cn(
          "max-h-[min(50vh,20rem)] overflow-y-auto p-1.5",
          inlineListClassName,
        )}
        data-tour-id="farm-switcher"
        aria-busy={switchPending || undefined}
        aria-label="농장 선택"
      >
        {switchPending ? (
          <p className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            전환 중…
          </p>
        ) : null}
        {farmRows}
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-busy={switchPending || undefined}
        className={cn(
          "inline-flex shrink-0 items-center gap-2 font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
          compact
            ? cn(
                dashboardUi.scopePill,
                dashboardUi.scopePillText,
                dashboardUi.scopePillActive,
              )
            : cn(
                "gap-3 rounded-xl px-5 py-2",
                dashboardUi.body,
                activeId === null
                  ? cn(dashboardUi.menuItemActive, "text-foreground")
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              ),
        )}
        aria-label={switchPending ? "농장 전환 중" : "농장 선택"}
        data-tour-id="farm-switcher"
      >
        <span className={compact ? "max-w-[18rem] truncate" : undefined}>
          {switchPending ? "전환 중…" : triggerLabel}
        </span>
        {switchPending ? (
          <Loader2
            className={cn(
              "shrink-0 animate-spin opacity-70",
              compact ? "size-6" : "size-8",
            )}
            aria-hidden
          />
        ) : (
          <ChevronDown
            className={cn(
              "shrink-0 opacity-70",
              compact ? "size-6" : "size-8",
            )}
            aria-hidden
          />
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        sideOffset={8}
        className={cn(
          compact
            ? cn(dashboardUi.scopePillMenu, "!w-auto min-w-[var(--anchor-width)]")
            : "min-w-[28rem] rounded-xl p-2 text-sm leading-snug md:text-[length:var(--density-meta-md)] !w-auto",
        )}
      >
        <DropdownMenuItem
          onClick={() => navigate(null)}
          className={itemClass(activeId === null)}
        >
          <span className="flex-1 font-medium">
            {t("farm.all", { count: farmOptions.length })}
          </span>
        </DropdownMenuItem>
        {orderedFarmOptions.map((farmKey) => {
          const id = farmKeyId(farmKey);
          const alarms = alarmByFarmId.get(id);
          const hasLiveSummary = liveByFarmId.has(id);
          const isLive = liveByFarmId.get(id) === true;
          return (
            <DropdownMenuItem
              key={id}
              onClick={() => navigate(farmKey)}
              className={itemClass(activeId === id)}
            >
              <span className="flex min-w-0 flex-1 items-center gap-2">
                <span className="truncate">{farmShortLabel(farmKey)}</span>
                {hasLiveSummary ? (
                  isLive ? (
                    <span className={dashboardUi.brandChip}>LIVE</span>
                  ) : (
                    <span className={dashboardUi.locationChip}>
                      위치만
                    </span>
                  )
                ) : null}
              </span>
              {alarms !== undefined ? (
                <span
                  className={cn(
                    "tabular-nums font-semibold",
                    "text-sm leading-snug md:text-[length:var(--density-meta-md)]",
                    alarms > 0
                      ? "text-status-warn"
                      : "text-muted-foreground",
                  )}
                >
                  {alarms}
                </span>
              ) : null}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
