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
import { compareFarmKey, farmKeyId, type FarmKey } from "@/lib/data/farm-key";
import { fetchFarmOverviewRows } from "@/lib/data/iot-live-fetch";
import { farmShortLabel } from "@/lib/data/farm-summaries";
import { OpsInspectorFrame } from "@/components/admin/ops-inspector-frame";
import { opsLayout, opsTypography } from "@/lib/ui/dashboard-page-ui";
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
      {configError ? (
        <p
          className={cn(
            "rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-amber-900",
            opsTypography.alert,
          )}
        >
          SUPABASE_SERVICE_ROLE_KEY가 설정되지 않았습니다.{" "}
          <code>web/.env.local</code>에 service_role 키를 입력해야 사용자
          목록/권한 부여가 동작합니다.
        </p>
      ) : null}
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
