"use client";

import { useCallback, useEffect, useState } from "react";
import { FarmPageContent } from "@/components/farm/farm-page-content";
import { FarmPageViewport } from "@/components/farm/farm-page-viewport";
import { TopBar } from "@/components/layout/top-bar";
import { DashboardViewportShell } from "@/components/layout/dashboard-viewport-shell";
import { DashboardMetaShell } from "@/components/layout/dashboard-meta-shell";
import { FarmScopeProvider } from "@/components/layout/farm-scope-provider";
import { ProfileSheetPrefsProvider } from "@/components/account/profile-sheet-prefs";
import { DEFAULT_PROFILE_SHEET_PREFS } from "@/lib/ui/profile-sheet-prefs";
import { dashboardUi } from "@/lib/ui/dashboard-page-ui";
import { cn } from "@/lib/utils";
import { subscribeFarmUrlEpoch } from "@/lib/farm/farm-view-url";
import type { fieldPreviewSnapshot } from "./fixture";

type Snapshot = ReturnType<typeof fieldPreviewSnapshot>;

export function FieldPreview({ initial }: { initial: Snapshot }) {
  // The production controls write /farm URLs. Keep their query state inside
  // this development-only preview so reloads never leave the fixture page.
  useEffect(() => {
    const keepPreviewPath = () => window.history.replaceState(
      window.history.state, "", `/auth/motor-bars-preview${window.location.search}`,
    );
    keepPreviewPath();
    return subscribeFarmUrlEpoch(keepPreviewPath);
  }, []);
  const [snapshot, setSnapshot] = useState(initial);
  const [error, setError] = useState(false);
  const refresh = useCallback(async () => {
    setError(false);
    try {
      const response = await fetch(`/auth/motor-bars-preview/snapshot?revision=${snapshot.revision + 1}`, { cache: "no-store" });
      if (!response.ok) throw new Error("refresh failed");
      setSnapshot(await response.json() as Snapshot);
    } catch {
      setError(true);
    }
  }, [snapshot.revision]);
  const farmKey = initial.readings[0].farmKey;
  return <DashboardMetaShell metas={[]} canEdit={false}>
    <FarmScopeProvider isAdmin={false} fixedFarmKey={farmKey}>
      <ProfileSheetPrefsProvider initial={{ ...DEFAULT_PROFILE_SHEET_PREFS, envCover: false }}>
        <DashboardViewportShell>
          <TopBar user={{ displayName: "필드 UI 미리보기", email: null, role: "operator", avatarUrl: null }} activeFarmKey={farmKey} farmOptions={[farmKey]} />
          <main className={cn(dashboardUi.mainPadWide, "flex min-h-0 min-w-0 flex-col")}>
            <div className={cn(dashboardUi.pageStackWide, "flex min-h-0 min-w-0 flex-1 flex-col")}>
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                <span>개발 미리보기 · 샘플 데이터 · 실제 필드 페이지 컴포넌트</span>
                <span role="status">{error ? "새로고침 실패 · 다시 시도해 주세요" : `갱신 ${snapshot.revision}회 · ${new Date(snapshot.receivedAt).toLocaleTimeString("ko-KR", { timeZone: "Asia/Seoul", hour12: false })} KST`}</span>
              </div>
              <FarmPageViewport initialView="list">
                <FarmPageContent readings={snapshot.readings} barnSnapshots={snapshot.barnSnapshots}
                  gridCols={4} gridRows={3} hubMode initialHubView="list"
                  controller={{ readings: snapshot.readings, thermoSettings: {}, commands: [], canCommand: true }}
                  onRefreshPanels={refresh} />
              </FarmPageViewport>
            </div>
          </main>
        </DashboardViewportShell>
      </ProfileSheetPrefsProvider>
    </FarmScopeProvider>
  </DashboardMetaShell>;
}
