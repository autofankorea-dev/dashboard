"use client";

import { useMemo, useState, type ComponentType } from "react";
import {
  Activity,
  ChevronDown,
  MapPin,
  MapPinned,
  TriangleAlert,
  WifiOff,
} from "lucide-react";
import { AccountMenuPins } from "@/components/account/account-menu-pins";
import { FarmAddressInput } from "@/components/settings/farm-address-input";
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
import {
  accountMenuLayout,
  CONTROLLER_STATUS_LABEL,
} from "@/lib/ui/account-menu-layout";
import { cn } from "@/lib/utils";

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
};

const HUB_TONE_CHIP: Record<
  AdminHubFarmTone | "total",
  { Icon: ComponentType<{ className?: string }>; label: string; className: string }
> = {
  total: { Icon: MapPin, label: "전국 관제", className: "text-muted-foreground" },
  live: { Icon: Activity, label: "정상", className: "text-[var(--status-ok-on-canvas)]" },
  alert: { Icon: TriangleAlert, label: "경보", className: "text-status-danger" },
  offline: { Icon: WifiOff, label: "오프라인", className: "text-muted-foreground" },
  location: { Icon: MapPinned, label: "위치만", className: "text-channel-info" },
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

  if (tones.total === 0) return null;

  const items = [
    ["total", tones.total],
    ["live", tones.live],
    ["alert", tones.alert],
    ["offline", tones.offline],
    ["location", tones.location],
  ] as const;

  return (
    <ul className={accountMenuLayout.hubToneStrip} aria-label="전국 관제">
      {items.map(([key, count]) => {
        const { Icon, label, className } = HUB_TONE_CHIP[key];
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
}: Props) {
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
      statusLabel: CONTROLLER_STATUS_LABEL[receipt.status],
      timeLabel: formatKst(receipt.receivedAt, "short"),
    };
  }, [activeFarmKey, receipts]);

  const offline = overview?.offlineCount ?? 0;

  const liveLine = useMemo(() => {
    if (!liveStatus) return null;
    const parts: string[] = [];
    if (liveStatus.status === "offline" && offline > 0) {
      parts.push(`오프라인 ${offline}`);
    } else {
      parts.push(liveStatus.statusLabel);
      if (offline > 0) {
        parts.push(`오프라인 ${offline}`);
      }
    }
    parts.push(liveStatus.timeLabel);
    return parts.join(" · ");
  }, [liveStatus, offline]);

  return (
    <>
      <div className={accountMenuLayout.splitBody} data-tour-id="account-menu-hub">
        <div
          className={accountMenuLayout.zoneContext}
          data-tour-id="account-menu-summary"
        >
          <div className={accountMenuLayout.zoneContextStack}>
          {farmLabel ? (
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
              <p className={cn(accountMenuLayout.contextFarm, "truncate")}>
                {farmLabel}
              </p>
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
              <span className="min-w-0 truncate">농장 선택</span>
              <ChevronDown
                className={cn(
                  "size-3 shrink-0 text-muted-foreground transition-transform",
                  switcherOpen && "rotate-180",
                )}
                aria-hidden
              />
            </button>
          ) : null}

          {farmLabel && liveLine ? (
            <p className={accountMenuLayout.liveStrip}>
              <span
                className={statusDotClass(liveStatus?.status)}
                aria-hidden
              />
              <span className="min-w-0 truncate">{liveLine}</span>
            </p>
          ) : null}

          {!farmLabel ? (
            <HubToneStrip
              farmOptions={farmOptions}
              farmSummaries={farmSummaries}
            />
          ) : null}
          </div>
        </div>

        <div
          className={accountMenuLayout.zoneAction}
          onPointerDown={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          <AccountMenuPins
            variant="tile"
            overview={overview}
            alarms={alarms}
            farmKey={farmKey}
            onCloseMenu={onCloseMenu}
          />
        </div>
      </div>

      {activeFarmLocation ? (
        <div
          className={accountMenuLayout.addressRow}
          onPointerDown={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          <FarmAddressInput
            key={farmKeyId(activeFarmLocation.farmKey)}
            farmKey={activeFarmLocation.farmKey}
            location={activeFarmLocation.location}
            disabled={!canEditLocation}
            compact
            saveOnly
            deferFocusUntilTap={deferAddressFocus}
            onSaved={onFarmSaved}
          />
        </div>
      ) : null}

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
    </>
  );
}
