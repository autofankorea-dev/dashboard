import { TopBar } from "./top-bar";
import { getAdminOpsShellContext } from "@/lib/data/admin-ops-shell-data";
import { fetchActiveModuleAlarms } from "@/lib/data/module-alarms";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { dashboardUi } from "@/lib/ui/dashboard-page-ui";
import { cn } from "@/lib/utils";

type Props = {
  children: React.ReactNode;
};

/** 운영(/admin/ops) 전용 — TopBar overview + 모듈 이상상황 (LIVE farm-scoped 병렬 조회 없음) */
export async function AdminOpsPageShell({ children }: Props) {
  const [ctx, user, alarms] = await Promise.all([
    getAdminOpsShellContext(),
    getCurrentUser(),
    fetchActiveModuleAlarms(null, { limit: 100 }),
  ]);

  return (
    <>
      <TopBar
        overview={ctx.overview}
        alarms={alarms}
        farmLocationOptions={[]}
        canEditLocation={false}
        user={{
          displayName: user?.displayName ?? null,
          email: user?.email ?? null,
          role: user?.role ?? null,
          avatarUrl: user?.avatarUrl ?? null,
        }}
      />
      <main
        className={cn(
          dashboardUi.mainPadWide,
          "flex min-h-0 min-w-0 flex-col overflow-hidden",
        )}
      >
        <div
          className={cn(
            dashboardUi.pageStackWide,
            "flex min-h-0 min-w-0 flex-1 flex-col",
          )}
        >
          {children}
        </div>
      </main>
    </>
  );
}
