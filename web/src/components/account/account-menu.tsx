"use client";

import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { ProfileAvatar } from "@/components/account/profile-avatar";
import { RecentActivityMenuSection } from "@/components/account/recent-activity-menu-section";
import { AccountMenuHub } from "@/components/account/account-menu-hub";
import { AccountMenuSplitBody } from "@/components/account/account-menu-split";
import { AccountMenuSheet } from "@/components/account/account-menu-sheet";
import type { EditableFarmOption } from "@/lib/data/farm-location";
import {
  farmShortLabel,
  type FarmSummaryRow,
} from "@/lib/domain/farm-summaries";
import {
  appendFarmKeyParams,
  farmKeyId,
  type FarmKey,
} from "@/lib/domain/farm-key";
import type { ModuleReceipt, FarmOverview } from "@/lib/data/iot";
import type { AlarmRow } from "@/lib/domain/alarms";
import { setProfileAccountMenuOpen } from "@/lib/ui/profile-pin-tools-store";
import { signOut } from "@/app/auth/actions";
import { useAppNavigate } from "@/components/layout/use-app-navigate";
import { accountMenuLayout } from "@/lib/ui/account-menu-layout";
import { dashboardControlFill, dashboardUi } from "@/lib/ui/dashboard-page-ui";
import { motionClass } from "@/lib/ui/motion-classes";
import { useMobileLayout } from "@/lib/ui/use-mobile-layout";
import { cn } from "@/lib/utils";
import { useSheetCopy } from "@/components/account/profile-sheet-prefs";

const emptySubscribe = () => () => {};

type Role = "admin" | "operator" | "viewer";

const roleLabel: Record<Role, string> = {
  admin: "관리자",
  operator: "운영자",
  viewer: "뷰어",
};

type Props = {
  user: {
    displayName: string | null;
    email: string | null;
    role: Role | null;
    avatarUrl: string | null;
  };
  receipts?: ModuleReceipt[];
  farmLocationOptions?: EditableFarmOption[];
  farmOptions?: FarmKey[];
  activeFarmKey?: FarmKey | null;
  farmSummaries?: FarmSummaryRow[];
  canEditLocation?: boolean;
  overview?: FarmOverview;
  alarms?: AlarmRow[];
};

export function AccountMenu({
  user,
  receipts = [],
  farmLocationOptions = [],
  farmOptions = [],
  activeFarmKey = null,
  farmSummaries = [],
  canEditLocation = false,
  overview,
  alarms = [],
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const { navigate: appNavigate } = useAppNavigate();
  const mobile = useMobileLayout();
  const [open, setOpen] = useState(false);
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);
  const t = useSheetCopy();
  const name = user.displayName?.trim() || user.email || "사용자";

  const activeFarmLocation = useMemo(() => {
    if (activeFarmKey) {
      const id = farmKeyId(activeFarmKey);
      return (
        farmLocationOptions.find((o) => farmKeyId(o.farmKey) === id) ?? null
      );
    }
    return farmLocationOptions[0] ?? null;
  }, [activeFarmKey, farmLocationOptions]);

  const navigateToFarm = useCallback(
    (farmKey: FarmKey) => {
      setOpen(false);
      const params = new URLSearchParams(window.location.search);
      params.delete("lsind");
      params.delete("item");
      appendFarmKeyParams(params, farmKey);
      const query = params.toString();
      const href = query ? `/farm?${query}` : "/farm";
      if (pathname === "/farm") {
        appNavigate(href, { message: "농장으로 이동 중…" });
        return;
      }
      router.push(href);
    },
    [appNavigate, pathname, router],
  );

  const handleOpenChange = useCallback((next: boolean) => {
    setOpen(next);
    setProfileAccountMenuOpen(next);
  }, []);

  const triggerClassName = cn(
    dashboardUi.headerAccountTrigger,
    motionClass.microInteractive,
    mounted && open ? dashboardControlFill.active : dashboardControlFill.idle,
  );

  const triggerInner = (
    <>
      <ProfileAvatar url={user.avatarUrl} />
      <div className="hidden min-w-0 leading-tight sm:block">
        <p className={dashboardUi.headerAccountName} suppressHydrationWarning>
          {name}
        </p>
        <p className={dashboardUi.headerAccountRole} suppressHydrationWarning>
          {user.role ? roleLabel[user.role] : "권한 없음"}
        </p>
      </div>
      <ChevronDown
        className={cn(
          "hidden size-4 shrink-0 text-muted-foreground sm:block",
          motionClass.transitionTransform,
          motionClass.durationNormal,
          motionClass.easeStandard,
          mounted && open && "rotate-180",
        )}
        aria-hidden
      />
    </>
  );

  const identityFarmLabel =
    activeFarmLocation?.label ??
    (activeFarmKey ? farmShortLabel(activeFarmKey) : null);

  const logoutAction = (
    <button
      type="button"
      className={accountMenuLayout.headerLogout}
      data-tour-id="account-menu-account"
      onClick={() => {
        void signOut();
      }}
    >
      {t("header.logout")}
    </button>
  );

  return (
    <>
      <button
        type="button"
        className={triggerClassName}
        data-tour-id="header-account"
        aria-label="계정 메뉴"
        aria-expanded={open}
        aria-controls="account-menu-sheet"
        onClick={() => handleOpenChange(!open)}
        suppressHydrationWarning
      >
        {triggerInner}
      </button>

      {mounted ? (
        <AccountMenuSheet open={open} onOpenChange={handleOpenChange}>
        <AccountMenuHub
          name={name}
          avatarUrl={user.avatarUrl}
          trailing={logoutAction}
        />

        <AccountMenuSplitBody
          farmLabel={identityFarmLabel}
          activeFarmKey={activeFarmKey}
          receipts={receipts}
          overview={overview}
          alarms={alarms}
          farmKey={activeFarmKey}
          farmOptions={farmOptions}
          farmSummaries={farmSummaries}
          activeFarmLocation={activeFarmLocation}
          canEditLocation={canEditLocation}
          deferAddressFocus={mobile && open}
          onCloseMenu={() => handleOpenChange(false)}
          onFarmSaved={() => router.refresh()}
        />

        <RecentActivityMenuSection
          receipts={receipts}
          farmKeyFilter={activeFarmKey}
          excludeActiveFarm
          max={6}
          variant="chips"
          onItemNavigate={navigateToFarm}
        />
      </AccountMenuSheet>
      ) : null}
    </>
  );
}
