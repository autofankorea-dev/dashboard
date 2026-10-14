"use client";

import Image from "next/image";
import { useCallback, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { CSSProperties, MouseEvent } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { AppNavLink } from "@/components/layout/app-nav-link";
import { useAppNavigate } from "@/components/layout/use-app-navigate";
import {
  buildFarmMonitoringHomeParams,
  buildFarmMonitoringHomePath,
  currentFarmSearchParams,
  isFarmMonitoringSoftHome,
  replaceFarmUrlShallow,
  requestFarmHubViewResync,
} from "@/lib/farm/farm-view-url";
import {
  hasFarmLiveRefreshHandler,
  requestFarmLiveRefresh,
} from "@/lib/navigation/farm-live-refresh-bridge";
import { useSoftRefresh } from "@/lib/ui/use-soft-refresh";
import { cn } from "@/lib/utils";
import { useSheetCopy } from "@/components/account/profile-sheet-prefs";
import { dashboardUi } from "@/lib/ui/dashboard-page-ui";

const BRAND_TITLE = "IoT Board";
const LOGO_SCALE = 1.3;
const emptySubscribe = () => () => {};

export function AppHeaderBrand() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { navigate } = useAppNavigate();
  const t = useSheetCopy();
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);
  const titleRef = useRef<HTMLParagraphElement>(null);
  const [titleWidth, setTitleWidth] = useState<number | null>(null);

  useLayoutEffect(() => {
    if (!mounted) return;
    const el = titleRef.current;
    if (!el) return;

    const measure = () => {
      const width = el.getBoundingClientRect().width;
      setTitleWidth(width > 0 ? Math.round(width) : null);
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [mounted]);

  /** SSR·Link — Next searchParams. 클릭 시 window shallow URL 재계산 */
  const monitoringHomeHref = useMemo(
    () =>
      buildFarmMonitoringHomePath(new URLSearchParams(searchParams.toString())),
    [searchParams],
  );

  const doLiveRefresh = useCallback(async () => {
    if (hasFarmLiveRefreshHandler()) {
      await requestFarmLiveRefresh();
      return;
    }
    router.refresh();
  }, [router]);

  const {
    run: runRefresh,
    busy: refreshBusy,
    showProgress: refreshShowSpinner,
  } = useSoftRefresh(doLiveRefresh);

  const goMonitoringHome = useCallback(
    (e: MouseEvent<HTMLAnchorElement>) => {
      const live = currentFarmSearchParams();
      const homeParams = buildFarmMonitoringHomeParams(live);
      const href = buildFarmMonitoringHomePath(live);

      // 이미 모니터링 홈 → 새로고침 (ScopeBar 새로고침 대체)
      if (pathname === "/farm" && isFarmMonitoringSoftHome(live)) {
        e.preventDefault();
        if (!refreshBusy) runRefresh();
        return;
      }

      if (pathname === "/farm") {
        e.preventDefault();
        replaceFarmUrlShallow(homeParams);
        requestFarmHubViewResync();
        return;
      }

      // 다른 경로 → soft home (농장·기간 유지)
      e.preventDefault();
      navigate(href, { message: t("nav.monitoring") });
    },
    [pathname, navigate, refreshBusy, runRefresh, t],
  );

  const logoStyle: CSSProperties | undefined =
    mounted && titleWidth != null
      ? ({
          "--brand-title-w": `${Math.round(titleWidth * LOGO_SCALE)}px`,
        } as CSSProperties)
      : undefined;

  const softHome =
    pathname === "/farm" &&
    isFarmMonitoringSoftHome(
      new URLSearchParams(searchParams.toString()),
    );

  return (
    <div
      className={cn(
        dashboardUi.headerBrand,
        "text-2xl font-semibold leading-tight",
      )}
    >
      <AppNavLink
        href={monitoringHomeHref}
        message={softHome ? t("nav.refresh") : t("nav.monitoring")}
        aria-label={softHome ? t("nav.refreshLabel") : t("nav.home")}
        title={softHome ? t("nav.refreshShort") : t("nav.home")}
        aria-busy={mounted && refreshBusy ? true : undefined}
        onClick={goMonitoringHome}
        className={cn(
          dashboardUi.headerBrandIcon,
          mounted && titleWidth != null && "sm:w-[var(--brand-title-w)]",
          "transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          mounted && refreshBusy && "pointer-events-none opacity-70",
        )}
        style={logoStyle}
      >
        <Image
          src="/logo.png"
          alt=""
          fill
          sizes="(max-width: 639px) 187px, 156px"
          className={cn(
            "object-contain p-0.5",
            mounted && refreshShowSpinner && "opacity-40",
          )}
          priority
        />
        {mounted && refreshShowSpinner ? (
          <Loader2
            className="absolute inset-0 m-auto size-5 animate-spin text-muted-foreground"
            aria-hidden
          />
        ) : null}
      </AppNavLink>
      <p
        ref={titleRef}
        className={dashboardUi.headerBrandTitle}
        suppressHydrationWarning
      >
        {BRAND_TITLE}
      </p>
    </div>
  );
}
