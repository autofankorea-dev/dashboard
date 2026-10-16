"use client";

import { useMemo, useState, type ComponentType, type ReactNode } from "react";
import {
  Activity,
  ChevronDown,
  MapPin,
  MapPinned,
  TriangleAlert,
  WifiOff,
} from "lucide-react";
import { AccountFarmAddressSetting } from "@/components/account/account-settings-card";
import { AccountMenuPins } from "@/components/account/account-menu-pins";
import { FarmSwitcher } from "@/components/layout/farm-switcher";
import { isValidFarmKey } from "@/lib/domain/barn-catalog";
import { farmKeyId, type FarmKey } from "@/lib/domain/farm-key";
import {
  collectAdminHubFarmRows,
  summarizeAdminHubTones,
  type AdminHubFarmTone,
} from "@/lib/farm/admin-hub-farm-status";
import type { EditableFarmOption } from "@/lib/data/farm-location";
import type { FarmSummaryRow } from "@/lib/domain/farm-summaries";
import { formatKst } from "@/lib/datetime/kst";
import type { AlarmRow } from "@/lib/domain/alarms";
import type { ModuleReceipt, FarmOverview } from "@/lib/data/iot";
import { accountMenuLayout } from "@/lib/ui/account-menu-layout";
import { cn } from "@/lib/utils";
import { useSheetCopy } from "@/components/account/profile-sheet-prefs";
import type { SheetCopyKey } from "@/lib/ui/sheet-copy";

type Props = {
  farmLabel?: string | null;
  activeFarmKey?: FarmKey | null;
  receipts?: ModuleReceipt[];
  overview?: FarmOverview;
  alarms?: AlarmRow[];
  farmKey?: FarmKey | null;
  farmOptions?: FarmKey[];
  farmSummaries?: FarmSummaryRow[];
  activeFarmLocation?: EditableFarmOption | null;
  canEditLocation?: boolean;
  deferAddressFocus?: boolean;
  onCloseMenu?: () => void;
  onFarmSaved?: () => void;
  header: (identity: ReactNode) => ReactNode;
  beforeTools?: ReactNode;
};

const HUB_TONE_CHIP: Record<
  AdminHubFarmTone | "total",
  { Icon: ComponentType<{ className?: string }>; labelKey: SheetCopyKey; className: string }
> = {
  total: { Icon: MapPin, labelKey: "account.national", className: "text-muted-foreground" },
  live: { Icon: Activity, labelKey: "cover.ok", className: "text-[var(--status-ok-on-canvas)]" },
  alert: { Icon: TriangleAlert, labelKey: "account.alert", className: "text-status-danger" },
  offline: { Icon: WifiOff, labelKey: "account.offline", className: "text-muted-foreground" },
  location: { Icon: MapPinned, labelKey: "farm.locationOnly", className: "text-channel-info" },
};

function HubToneStrip({
  farmOptions,
  farmSummaries,
}: {
  farmOptions: FarmKey[];
  farmSummaries: FarmSummaryRow[];
}) {
  const tones = useMemo(() => {
    const rows = collectAdminHubFarmRows(farmOptions, farmSummaries, []);
    return summarizeAdminHubTones(rows);
  }, [farmOptions, farmSummaries]);

  const t = useSheetCopy();
  if (tones.total === 0) return null;

  const items = [
    ["total", tones.total],
    ["live", tones.live],
    ["alert", tones.alert],
    ["offline", tones.offline],
    ["location", tones.location],
  ] as const;

  return (
    <ul className={accountMenuLayout.hubToneStrip} aria-label={t("account.national")}>
      {items.map(([key, count]) => {
        const chip = HUB_TONE_CHIP[key];
        const Icon = chip.Icon;
        const label = t(chip.labelKey);
        const className = chip.className;
        return (
          <li key={key}>
            <span
              className={accountMenuLayout.hubToneChip}
              title={label}
              aria-label={`${label} ${count}`}
            >
              <Icon className={cn("size-3.5", className)} aria-hidden />
              <span>{count}</span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function statusDotClass(status: ModuleReceipt["status"] | undefined) {
  if (status === "caution") return accountMenuLayout.liveStatusDotWarn;
  if (status === "offline") return accountMenuLayout.liveStatusDotOffline;
  return accountMenuLayout.liveStatusDot;
}

export function AccountMenuSplitBody({
  farmLabel,
  activeFarmKey = null,
  receipts = [],
  overview,
  alarms = [],
  farmKey = null,
  farmOptions = [],
  farmSummaries = [],
  activeFarmLocation = null,
  canEditLocation = false,
  deferAddressFocus = false,
  onCloseMenu,
  onFarmSaved,
  header,
  beforeTools,
}: Props) {
  const tFarm = useSheetCopy();
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const showFarmSwitcher = farmOptions.length > 1;

  const liveStatus = useMemo(() => {
    const valid = receipts.filter((r) => isValidFarmKey(r.farmKey));
    const scoped =
      activeFarmKey != null
        ? valid.find((r) => farmKeyId(r.farmKey) === farmKeyId(activeFarmKey))
        : valid[0];
    const receipt = scoped ?? valid[0];
    if (!receipt) return null;
    return {
      status: receipt.status,
      statusLabel: tFarm(
        receipt.status === "caution"
          ? "cover.caution"
          : receipt.status === "offline"
            ? "account.offline"
            : "cover.ok",
      ),
      timeLabel: formatKst(receipt.receivedAt, "short"),
    };
  }, [activeFarmKey, receipts, tFarm]);

  const offline = overview?.offlineCount ?? 0;

  const liveLine = useMemo(() => {
    if (!liveStatus) return null;
    const parts: string[] = [];
    if (liveStatus.status === "offline" && offline > 0) {
      parts.push(tFarm("tools.offlineCount", { count: offline }));
    } else {
      parts.push(liveStatus.statusLabel);
      if (offline > 0) {
        parts.push(tFarm("tools.offlineCount", { count: offline }));
      }
    }
    parts.push(liveStatus.timeLabel);
    return parts.join(" · ");
  }, [liveStatus, offline, tFarm]);

  const farmControl = farmLabel ? (
    showFarmSwitcher ? (
      <button
        type="button"
        className={cn(
          accountMenuLayout.contextFarmBtn,
          "inline-flex min-w-0 max-w-full items-center gap-1",
        )}
        aria-expanded={switcherOpen}
        aria-controls="account-menu-farm-matrix"
        onClick={() => setSwitcherOpen((v) => !v)}
      >
        <span className="min-w-0 truncate">{farmLabel}</span>
        <ChevronDown
          className={cn(
            "size-3 shrink-0 text-muted-foreground transition-transform",
            switcherOpen && "rotate-180",
          )}
          aria-hidden
        />
      </button>
    ) : (
      <p className={cn(accountMenuLayout.contextFarm, "truncate")}>{farmLabel}</p>
    )
  ) : showFarmSwitcher ? (
    <button
      type="button"
      className={cn(
        accountMenuLayout.contextFarmBtn,
        "inline-flex min-w-0 max-w-full items-center gap-1",
      )}
      aria-expanded={switcherOpen}
      aria-controls="account-menu-farm-matrix"
      onClick={() => setSwitcherOpen((v) => !v)}
    >
      <span className="min-w-0 truncate">{tFarm("header.farmSelect")}</span>
      <ChevronDown
        className={cn(
          "size-3 shrink-0 text-muted-foreground transition-transform",
          switcherOpen && "rotate-180",
        )}
        aria-hidden
      />
    </button>
  ) : null;

  const identity = (
    <div
      className={accountMenuLayout.sheetFarmCluster}
      data-tour-id="account-menu-summary"
    >
      {farmControl}
      {farmLabel && liveLine ? (
        <p className={cn(accountMenuLayout.liveStrip, "min-w-0")}>
          <span className={statusDotClass(liveStatus?.status)} aria-hidden />
          <span className="min-w-0 truncate">{liveLine}</span>
        </p>
      ) : null}
      {farmKey ? (
        <AccountFarmAddressSetting
          farmKey={farmKey}
          location={activeFarmLocation?.location}
          farmLabel={farmLabel}
          canEditLocation={canEditLocation}
          deferAddressFocus={deferAddressFocus}
          onSaved={onFarmSaved}
        />
      ) : null}
      {!farmLabel ? (
        <HubToneStrip farmOptions={farmOptions} farmSummaries={farmSummaries} />
      ) : null}
    </div>
  );

  return (
    <>
      {header(identity)}
      {switcherOpen && showFarmSwitcher ? (
        <FarmSwitcher
          farmOptions={farmOptions}
          activeFarmKey={activeFarmKey}
          farmSummaries={farmSummaries}
          compact
          variant="matrix"
          onNavigated={() => {
            setSwitcherOpen(false);
            onCloseMenu?.();
          }}
        />
      ) : null}
      {beforeTools}
      <div
        className={accountMenuLayout.sheetTools}
        onPointerDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <AccountMenuPins
          variant="tile"
          overview={overview}
          alarms={alarms}
          farmKey={activeFarmKey ? farmKey : null}
          onCloseMenu={onCloseMenu}
        />
      </div>
    </>
  );
}
