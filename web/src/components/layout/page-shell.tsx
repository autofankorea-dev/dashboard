import { TopBar } from "./top-bar";
import { getPageShellContext } from "@/lib/data/page-shell-data";
import type { FarmQueryParams } from "@/lib/auth/farm-access";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { dashboardUi } from "@/lib/ui/dashboard-page-ui";
import { cn } from "@/lib/utils";

type PageShellProps = {
  children: React.ReactNode;
  /** 농장 지도 등 넓은 레이아웃 */
  wide?: boolean;
  searchParams?: FarmQueryParams;
};

export async function PageShell({
  children,
  wide = false,
  searchParams = {},
}: PageShellProps) {
  const [ctx, user] = await Promise.all([
    getPageShellContext(searchParams),
    getCurrentUser(),
  ]);

  return (
    <>
      <TopBar
        overview={ctx.overview}
        alarms={ctx.alarms}
        farmLocationOptions={ctx.farmLocationOptions}
        farmOptions={ctx.farmOptions}
        activeFarmKey={ctx.activeFarmKey}
        farmSummaries={ctx.farmSummaries}
        canEditLocation={ctx.canEditLocation}
        user={{
          displayName: user?.displayName ?? null,
          email: user?.email ?? null,
          role: user?.role ?? null,
          avatarUrl: user?.avatarUrl ?? null,
        }}
      />
      <main
        className={cn(
          wide ? dashboardUi.mainPadWide : dashboardUi.mainPad,
          wide && "flex min-h-0 min-w-0 flex-col",
          !wide && "min-w-0 max-w-screen-2xl"
        )}
      >
        <div
          className={cn(
            wide ? dashboardUi.pageStackWide : dashboardUi.pageStack,
            wide && "flex min-h-0 min-w-0 flex-1 flex-col",
            !wide && "min-w-0"
          )}
        >
          {children}
        </div>
      </main>
    </>
  );
}
