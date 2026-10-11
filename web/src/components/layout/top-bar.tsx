import { AppHeaderAccount } from "@/components/layout/app-header-account";
import { AppHeaderBrand } from "@/components/layout/app-header-brand";
import { FeatureTourHelpButton } from "@/components/layout/feature-tour-help-button";
import { HeaderToolsMenu } from "@/components/layout/header-tools-menu";
import type { AlarmRow } from "@/lib/domain/alarms";
import type { FarmOverview } from "@/lib/data/iot";
import type { EditableFarmOption } from "@/lib/data/farm-location";
import type { FarmKey } from "@/lib/domain/farm-key";
import type { FarmSummaryRow } from "@/lib/domain/farm-summaries";
import { dashboardUi } from "@/lib/ui/dashboard-page-ui";

type Role = "admin" | "operator" | "viewer";

type TopBarProps = {
  overview?: FarmOverview;
  alarms?: AlarmRow[];
  isAdmin?: boolean;
  farmLocationOptions?: EditableFarmOption[];
  farmOptions?: FarmKey[];
  activeFarmKey?: FarmKey | null;
  farmSummaries?: FarmSummaryRow[];
  canEditLocation?: boolean;
  user: {
    displayName: string | null;
    email: string | null;
    role: Role | null;
  };
};

export function TopBar({
  overview,
  alarms = [],
  farmLocationOptions = [],
  farmOptions = [],
  activeFarmKey = null,
  farmSummaries = [],
  canEditLocation = false,
  user,
}: TopBarProps) {
  const isAdmin = user.role === "admin";

  return (
    <header className={dashboardUi.topBar} data-app-header data-tour-id="app-header">
      <div className="flex w-full min-w-0 items-center gap-1.5 md:gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2 md:gap-3">
          <AppHeaderBrand />
          {/* 보기 토글 PC — 브랜드 영역 우측(도구·계정 직전). compact는 하단 독 */}
          <div
            data-farm-view-toggle-slot="desktop"
            className="ml-auto flex shrink-0 items-center empty:hidden [[data-dashboard-compact]_&]:!hidden"
          />
        </div>

        <div className="ml-auto flex shrink-0 items-center justify-end gap-1 md:gap-3">
          <div
            data-tour-id="header-actions"
            className="flex shrink-0 items-center gap-4 md:gap-3"
          >
            <HeaderToolsMenu
              overview={overview}
              alarms={alarms}
              isAdmin={isAdmin}
              farmKey={activeFarmKey}
              variant="header"
            />
            <FeatureTourHelpButton
              tourFarmKey={
                farmLocationOptions.find((o) => o.hasLiveData)?.farmKey ??
                farmLocationOptions[0]?.farmKey ??
                farmOptions[0] ??
                activeFarmKey
              }
            />
            <AppHeaderAccount
              user={user}
              receipts={overview?.receipts}
              farmLocationOptions={farmLocationOptions}
              farmOptions={farmOptions}
              activeFarmKey={activeFarmKey}
              farmSummaries={farmSummaries}
              canEditLocation={canEditLocation}
              overview={overview}
              alarms={alarms}
            />
          </div>
        </div>
      </div>
    </header>
  );
}
