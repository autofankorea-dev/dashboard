"use client";

import Image from "next/image";
import { useCallback, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { CSSProperties, MouseEvent } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { AppNavLink } from "@/components/layout/app-nav-link";
import { useAppNavigate } from "@/components/layout/use-app-navigate";
import { useFarmScope } from "@/components/layout/farm-scope-provider";
import {
  ADMIN_NATIONAL_MAP_PATH,
  buildFarmMonitoringHomeParams,
  buildFarmMonitoringHomePath,
  currentFarmSearchParams,
  isAdminNationalMapHome,
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
  const { isAdmin } = useFarmScope();
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

  /** SSR·Link — Next searchParams. 클릭 시 window URL을 다시 읽는다. */
  const monitoringHomeHref = useMemo(() => {
    if (isAdmin) return ADMIN_NATIONAL_MAP_PATH;
    return buildFarmMonitoringHomePath(
      new URLSearchParams(searchParams.toString()),
    );
  }, [isAdmin, searchParams]);

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

      // 관리자 홈은 전국 지도. 농장·차트에 남아 있으면 문서 이동으로 돌아간다.
      // shallow는 SSR 농장 키를 유지해서 지도로 바뀌지 않고, 진행 중 전환에 막힌다.
      if (isAdmin) {
        e.preventDefault();
        if (pathname === "/farm" && isAdminNationalMapHome(live)) {
          if (!refreshBusy) runRefresh();
          return;
        }
        window.location.assign(ADMIN_NATIONAL_MAP_PATH);
        return;
      }

      const homeParams = buildFarmMonitoringHomeParams(live);
      const href = buildFarmMonitoringHomePath(live);

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

      e.preventDefault();
      navigate(href, { message: t("nav.monitoring") });
    },
    [isAdmin, pathname, navigate, refreshBusy, runRefresh, t],
  );

  const logoStyle: CSSProperties | undefined =
    mounted && titleWidth != null
      ? ({
          "--brand-title-w": `${Math.round(titleWidth * LOGO_SCALE)}px`,
        } as CSSProperties)
      : undefined;

  const liveParams = new URLSearchParams(searchParams.toString());
  const softHome =
    pathname === "/farm" &&
    (isAdmin
      ? isAdminNationalMapHome(liveParams)
      : isFarmMonitoringSoftHome(liveParams));

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
          mounted && softHome && refreshBusy && "pointer-events-none opacity-70",
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
