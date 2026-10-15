"use client";

import { useState, useSyncExternalStore } from "react";
import { Bell, FileText, MoreHorizontal, Pencil, RotateCcw, Settings, X } from "lucide-react";
import { DailyReportButton } from "@/components/layout/daily-report-button";
import { AccountMenuAlarmPanel } from "@/components/account/account-menu-alarm-panel";
import { AccountSettingsCard } from "@/components/account/account-settings-card";
import {
  ProfilePinDropSlot,
  ProfilePinToolChip,
} from "@/components/account/profile-pin-tool-chip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { AlarmRow } from "@/lib/domain/alarms";
import type { FarmKey } from "@/lib/domain/farm-key";
import type { FarmLocationRow } from "@/lib/data/farm-location";
import type { FarmOverview } from "@/lib/data/iot";
import { useShellAlarms } from "@/lib/navigation/shell-live-alarms-store";
import {
  PROFILE_PIN_MAX,
  DEFAULT_PROFILE_PINNED_TOOLS,
  type ProfilePinToolId,
} from "@/lib/ui/profile-pin-tools";
import {
  getProfilePinEditMode,
  getProfilePinExpandedPanel,
  getProfilePinnedTools,
  pinProfileTool,
  resetProfilePinnedTools,
  setProfilePinEditMode,
  subscribeProfilePinStore,
  toggleProfilePinExpandedPanel,
} from "@/lib/ui/profile-pin-tools-store";
import { toggleDashboardTheme } from "@/lib/ui/dashboard-theme";
import { accountMenuLayout } from "@/lib/ui/account-menu-layout";
import { cn } from "@/lib/utils";
import { useSheetCopy } from "@/components/account/profile-sheet-prefs";

type Props = {
  overview?: FarmOverview;
  alarms?: AlarmRow[];
  farmKey?: FarmKey | null;
  addressLocation?: FarmLocationRow | null;
  farmLabel?: string | null;
  canEditLocation?: boolean;
  deferAddressFocus?: boolean;
  onFarmSaved?: () => void;
  onCloseMenu?: () => void;
  embedded?: boolean;
  /** tile — Two-Zone Action 2×2 grid */
  variant?: "row" | "tile";
};

export function AccountMenuPins({
  overview,
  alarms = [],
  farmKey = null,
  addressLocation = null,
  farmLabel = null,
  canEditLocation = false,
  deferAddressFocus = false,
  onFarmSaved,
  onCloseMenu,
  embedded = false,
  variant = "row",
}: Props) {
  const t = useSheetCopy();
  const [sheetTool, setSheetTool] = useState<"alarm" | "pdf" | "settings" | null>(null);
  const pinned = useSyncExternalStore(
    subscribeProfilePinStore,
    getProfilePinnedTools,
    () => DEFAULT_PROFILE_PINNED_TOOLS,
  );
  const editMode = useSyncExternalStore(
    subscribeProfilePinStore,
    getProfilePinEditMode,
    () => false,
  );
  const expandedPanel = useSyncExternalStore(
    subscribeProfilePinStore,
    getProfilePinExpandedPanel,
    () => null,
  );

  const liveAlarms = useShellAlarms(alarms);
  const offline = overview?.offlineCount ?? 0;
  const alarmCount = liveAlarms.filter((a) => a.status === "active").length;
  const alert = alarmCount > 0 || offline > 0;
  const emptySlots = Math.max(0, PROFILE_PIN_MAX - pinned.length);

  const handlePinClick = (id: ProfilePinToolId) => {
    if (editMode) return;
    if (id === "theme") {
      toggleDashboardTheme();
      return;
    }
    toggleProfilePinExpandedPanel(id);
  };

  const toolsMenu = (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger
        className={accountMenuLayout.kebabBtn}
        aria-label={t("account.toolsMenu")}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        <MoreHorizontal className="size-4" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={4}
        className="min-w-[10rem]"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        <DropdownMenuItem
          className="gap-2 text-xs"
          onClick={() => setProfilePinEditMode(!editMode)}
        >
          {editMode ? (
            <>
              <X className="size-3.5" aria-hidden />
              {t("account.editDone")}
            </>
          ) : (
            <>
              <Pencil className="size-3.5" aria-hidden />
              {t("account.editTools")}
            </>
          )}
        </DropdownMenuItem>
        {pinned.length > 0 ? (
          <DropdownMenuItem
            className="gap-2 text-xs"
            onClick={() => resetProfilePinnedTools()}
          >
            <RotateCcw className="size-3.5" aria-hidden />
            {t("account.returnHeader")}
          </DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  if (variant === "tile") {
    const tools = [
      { id: "alarm" as const, label: t("settings.alarm"), Icon: Bell, alert, badge: alarmCount > 0 ? alarmCount : undefined },
      { id: "pdf" as const, label: t("settings.report"), Icon: FileText },
      { id: "settings" as const, label: t("settings.user"), Icon: Settings },
    ];
    return (
      <div
        className="flex w-full min-w-0 shrink-0 flex-col gap-2"
        data-tour-id="account-menu-pins"
      >
        <div className={accountMenuLayout.toolGrid}>
          {tools.map((tool) => (
            <button
              key={tool.id}
              type="button"
              aria-label={tool.label}
              aria-pressed={sheetTool === tool.id}
              className={cn(
                accountMenuLayout.toolTile,
                tool.alert && "ring-1 ring-destructive/50",
                sheetTool === tool.id && accountMenuLayout.toolTileActive,
              )}
              onClick={() => setSheetTool((current) => (current === tool.id ? null : tool.id))}
            >
              <tool.Icon className="size-4 md:size-5" aria-hidden />
              {tool.badge ? (
                <span className="absolute right-1 top-1 text-[10px] font-semibold">{tool.badge}</span>
              ) : null}
            </button>
          ))}
        </div>
        {sheetTool ? (
        <div className={accountMenuLayout.toolsCardWell}>
          {sheetTool === "alarm" ? (
            <AccountMenuAlarmPanel
              embedded
              overview={overview}
              alarms={alarms}
              onNavigate={onCloseMenu}
            />
          ) : null}
          {sheetTool === "pdf" ? (
            <DailyReportButton
              farmKey={farmKey}
              presentation="tools-card"
              className="mx-0 mb-0 mt-0 w-full"
            />
          ) : null}
          {sheetTool === "settings" ? (
            <AccountSettingsCard
              farmKey={farmKey}
              location={addressLocation}
              farmLabel={farmLabel}
              canEditLocation={canEditLocation}
              deferAddressFocus={deferAddressFocus}
              onSaved={onFarmSaved}
            />
          ) : null}
        </div>
        ) : null}
      </div>
    );
  }

  const legacyChipRow = (
    <>
      {pinned.map((id) => (
        <ProfilePinToolChip
          key={id}
          toolId={id}
          pinned
          size={embedded ? "sm" : "md"}
          draggable={editMode}
          active={
            !editMode &&
            (id === "alarm"
              ? expandedPanel === "alarm"
              : id === "pdf"
                ? expandedPanel === "pdf"
                : false)
          }
          badge={id === "alarm" && alarmCount > 0 ? alarmCount : undefined}
          alert={id === "alarm" && alert}
          onClick={() => handlePinClick(id)}
        />
      ))}
      {editMode
        ? Array.from({ length: emptySlots }).map((_, i) => (
            <ProfilePinDropSlot
              key={`slot-${i}`}
              active={editMode}
              size={embedded ? "sm" : "md"}
              label="+"
              onDropTool={(id) => {
                pinProfileTool(id);
              }}
            />
          ))
        : null}
    </>
  );

  return (
    <div
      className={cn("shrink-0", !embedded && "border-b")}
      data-tour-id="account-menu-pins"
    >
      <div
        className={cn(
          embedded
            ? accountMenuLayout.toolsStrip
            : "flex items-center justify-between gap-2 px-4 py-2.5",
        )}
        onDragOver={(e) => {
          if (!editMode) return;
          e.preventDefault();
        }}
      >
        {embedded ? (
          <span className={accountMenuLayout.rowLabel}>{t("account.tools")}</span>
        ) : null}
        <div className={accountMenuLayout.toolsCluster}>{legacyChipRow}</div>
        {toolsMenu}
      </div>

      {editMode ? (
        <p className={cn(accountMenuLayout.editHint, !embedded && "px-4")}>
          {t("account.pinHint")}
        </p>
      ) : null}

      {!editMode && expandedPanel === "alarm" && pinned.includes("alarm") ? (
        <AccountMenuAlarmPanel
          embedded={embedded}
          overview={overview}
          alarms={alarms}
          onNavigate={onCloseMenu}
        />
      ) : null}

      {!editMode && expandedPanel === "pdf" && pinned.includes("pdf") ? (
        <div className={cn(embedded ? "px-4 pb-3" : "px-4 pb-2")}>
          <DailyReportButton farmKey={farmKey} presentation="tools-card" />
        </div>
      ) : null}
    </div>
  );
}
