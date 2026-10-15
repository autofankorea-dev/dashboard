import { Suspense } from "react";
import { OpsScanClient } from "@/components/admin/ops-scan-client";
import { AdminDirectoryPanel } from "@/components/admin/admin-directory-panel";
import { AdminCommandPresetsPanel } from "@/components/admin/admin-command-presets-panel";
import { CommandHistorySlim } from "@/components/controllers/command-history-slim";
import { AdminOpsTabContentSkeleton } from "@/components/admin/admin-ops-loading-skeleton";
import { listManagedUsers } from "@/lib/admin/list-users";
import { getEditableFarmLocationOptions } from "@/lib/data/farm-location";
import { getThermoCommandHistory } from "@/lib/data/commands";
import { getCommandDefaults } from "@/lib/data/command-defaults";
import { listAllSharedCommandPresets } from "@/lib/data/command-presets";
import { compareFarmKey, farmKeyId, type FarmKey } from "@/lib/domain/farm-key";
import { fetchFarmOverviewRows } from "@/lib/data/iot-live-fetch";
import { farmShortLabel } from "@/lib/domain/farm-summaries";
import { OpsSectionNav } from "@/components/admin/ops-section-nav";
import { OpsInspectorFrame } from "@/components/admin/ops-inspector-frame";
import { OpsServiceRoleNotice } from "@/components/admin/ops-service-role-notice";
import { opsLayout } from "@/lib/ui/dashboard-page-ui";
import { cn } from "@/lib/utils";

async function loadDirectoryFarmOptions() {
  const overviewRows = await fetchFarmOverviewRows();
  const seen = new Map<string, { farmKey: FarmKey; label: string }>();
  for (const row of overviewRows) {
    const farmKey: FarmKey = {
      lsindRegistNo: row.lsind_regist_no,
      itemCode: row.item_code,
    };
    const id = farmKeyId(farmKey);
    if (!seen.has(id)) {
      seen.set(id, { farmKey, label: farmShortLabel(farmKey) });
    }
  }
  return [...seen.values()].sort((a, b) =>
    compareFarmKey(a.farmKey, b.farmKey),
  );
}

async function DirectorySection() {
  let users: Awaited<ReturnType<typeof listManagedUsers>> = [];
  let configError = false;
  try {
    users = await listManagedUsers();
  } catch {
    configError = true;
  }

  const [farmOptions, locationOptions] = await Promise.all([
    loadDirectoryFarmOptions(),
    getEditableFarmLocationOptions(),
  ]);

  return (
    <section
      id="directory"
      className={cn("order-1 scroll-mt-3 md:order-2", opsLayout.stack)}
    >
      {configError ? <OpsServiceRoleNotice /> : null}
      <AdminDirectoryPanel
        users={users}
        farmOptions={farmOptions}
        locationOptions={locationOptions}
      />
    </section>
  );
}

async function CommandsSection() {
  const commands = await getThermoCommandHistory(10);
  return (
    <section id="commands" className="order-2 scroll-mt-3 md:order-3">
      <CommandHistorySlim commands={commands} />
    </section>
  );
}

async function PresetsSection() {
  const [initialDefaults, initialPresets] = await Promise.all([
    getCommandDefaults(),
    listAllSharedCommandPresets(),
  ]);
  return (
    <AdminCommandPresetsPanel
      initialDefaults={initialDefaults}
      initialPresets={initialPresets}
    />
  );
}

/** 운영 홈 — 스캔(client defer) + 디렉터리(B) + 슬림 명령 + 프리셋. */
export async function AdminOpsHome() {
  return (
    <OpsInspectorFrame>
      <OpsSectionNav />
      <OpsScanClient />
      <Suspense fallback={<AdminOpsTabContentSkeleton label="디렉터리" />}>
        <DirectorySection />
      </Suspense>
      <Suspense fallback={<AdminOpsTabContentSkeleton label="명령" />}>
        <CommandsSection />
      </Suspense>
      <Suspense fallback={<AdminOpsTabContentSkeleton label="프리셋" />}>
        <PresetsSection />
      </Suspense>
    </OpsInspectorFrame>
  );
}
