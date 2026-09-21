"use client";

import { Suspense } from "react";
import { CircleHelp } from "lucide-react";
import { usePathname, useSearchParams } from "next/navigation";
import {
  FARM_TOUR_RESTART_EVENT,
  FARM_TOUR_RESTART_FLAG,
  FARM_TOUR_RESTART_SCOPE_KEY,
  buildFarmTourPath,
  tourScopeFromHubView,
  type TourScope,
} from "@/lib/onboarding/tour-steps";
import {
  DEFAULT_FARM,
  parseFarmKeyFromQuery,
  type FarmKey,
} from "@/lib/data/farm-key";
import { resolveFarmHubView } from "@/lib/farm/farm-view-url";
import { dashboardUi } from "@/lib/ui/dashboard-page-ui";
import { cn } from "@/lib/utils";

type Props = {
  /** 투어 이동 시 쓸 농장(스코프 없을 때). */
  tourFarmKey?: FarmKey | null;
};

function TourHelpButtonShell() {
  return (
    <button
      type="button"
      className={cn(dashboardUi.topHeaderActionBtn, "rounded-full")}
      aria-label="기능 안내"
      title="기능 안내"
      data-tour-id="header-feature-tour"
      tabIndex={-1}
      aria-hidden
      suppressHydrationWarning
    >
      <CircleHelp className="size-4 md:size-5" aria-hidden />
    </button>
  );
}

function FeatureTourHelpButtonInner({ tourFarmKey = null }: Props) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  if (!pathname?.startsWith("/farm")) return null;

  const farmScoped = Boolean(
    parseFarmKeyFromQuery(searchParams.get("lsind"), searchParams.get("item")),
  );
  const hubView = resolveFarmHubView(searchParams.get("view"));

  const onClick = () => {
    let scope: TourScope = tourScopeFromHubView(hubView);
    try {
      // shallow URL이 React searchParams보다 앞설 수 있음
      const live = new URLSearchParams(window.location.search);
      scope = tourScopeFromHubView(
        resolveFarmHubView(live.get("view")),
      );
    } catch {
      /* ignore */
    }
    if (farmScoped) {
      window.dispatchEvent(
        new CustomEvent(FARM_TOUR_RESTART_EVENT, { detail: { scope } }),
      );
      return;
    }
    try {
      sessionStorage.setItem(FARM_TOUR_RESTART_FLAG, "1");
      sessionStorage.setItem(FARM_TOUR_RESTART_SCOPE_KEY, scope);
    } catch {
      /* storage 사용 불가 시 이동만 */
    }
    const target = buildFarmTourPath(tourFarmKey ?? DEFAULT_FARM);
    window.location.assign(target);
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(dashboardUi.topHeaderActionBtn, "rounded-full")}
      aria-label="기능 안내"
      title="기능 안내"
      data-tour-id="header-feature-tour"
      suppressHydrationWarning
    >
      <CircleHelp className="size-4 md:size-5" aria-hidden />
    </button>
  );
}

/**
 * 헤더 기능 안내 — 원형 물음표.
 * 현재 탭(현장·차트) 스코프 투어를 시작한다.
 */
export function FeatureTourHelpButton(props: Props) {
  return (
    <Suspense fallback={<TourHelpButtonShell />}>
      <FeatureTourHelpButtonInner {...props} />
    </Suspense>
  );
}
