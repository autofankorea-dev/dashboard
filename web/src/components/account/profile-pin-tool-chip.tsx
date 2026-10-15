"use client";

import { useSyncExternalStore } from "react";
import { Bell, FileText, Moon, Sun } from "lucide-react";
import { useSheetCopy } from "@/components/account/profile-sheet-prefs";
import {
  PROFILE_PIN_DRAG_MIME,
  type ProfilePinToolId,
} from "@/lib/ui/profile-pin-tools";
import {
  setProfilePinDraggingTool,
} from "@/lib/ui/profile-pin-tools-store";
import {
  getDashboardTheme,
  subscribeDashboardTheme,
} from "@/lib/ui/dashboard-theme";
import { accountMenuLayout } from "@/lib/ui/account-menu-layout";
import { dashboardUi } from "@/lib/ui/dashboard-page-ui";
import { motionClass } from "@/lib/ui/motion-classes";
import { cn } from "@/lib/utils";

type Props = {
  toolId: ProfilePinToolId;
  pinned?: boolean;
  active?: boolean;
  badge?: number;
  alert?: boolean;
  draggable?: boolean;
  size?: "sm" | "md";
  variant?: "chip" | "tile";
  onClick?: () => void;
  className?: string;
  "data-tour-id"?: string;
};

export function ProfilePinToolChip({
  toolId,
  pinned = false,
  active = false,
  badge,
  alert = false,
  draggable = false,
  size = "md",
  variant = "chip",
  onClick,
  className,
  "data-tour-id": tourId,
}: Props) {
  const themeDark = useSyncExternalStore(
    subscribeDashboardTheme,
    () => getDashboardTheme() === "dark",
    () => false,
  );
  const t = useSheetCopy();

  const label =
    toolId === "alarm"
      ? t("tools.alarm")
      : toolId === "pdf"
        ? t("tools.report")
        : t("tools.theme");
  const Icon =
    toolId === "alarm"
      ? Bell
      : toolId === "pdf"
        ? FileText
        : themeDark
          ? Sun
          : Moon;

  const ariaLabel =
    toolId === "theme"
      ? themeDark
        ? t("account.lightMode")
        : t("account.darkMode")
      : label;

  if (variant === "tile") {
    return (
      <button
        type="button"
        draggable={draggable}
        data-profile-pin-tool={toolId}
        data-tour-id={tourId ?? `profile-pin-${toolId}`}
        aria-label={ariaLabel}
        title={label}
        aria-pressed={active || undefined}
        className={cn(
          accountMenuLayout.toolTile,
          alert && dashboardUi.topHeaderActionBtnAlert,
          active && accountMenuLayout.toolTileActive,
          pinned && "ring-1 ring-primary/30",
          draggable && "cursor-grab active:cursor-grabbing",
          className,
        )}
        onClick={(e) => {
          if (draggable) {
            e.preventDefault();
            return;
          }
          onClick?.();
        }}
        onDragStart={(e) => {
          if (!draggable) return;
          e.dataTransfer.setData(PROFILE_PIN_DRAG_MIME, toolId);
          e.dataTransfer.effectAllowed = "move";
          setProfilePinDraggingTool(toolId);
        }}
        onDragEnd={() => {
          setProfilePinDraggingTool(null);
        }}
      >
        <Icon className="size-4 md:size-5" aria-hidden />
        {badge != null && badge > 0 ? (
          <span
            className={cn(
              dashboardUi.topHeaderCountBadge,
              dashboardUi.topHeaderCountBadgeAlert,
            )}
          >
            {badge > 99 ? "99+" : badge}
          </span>
        ) : null}
      </button>
    );
  }

  return (
    <button
      type="button"
      draggable={draggable}
      data-profile-pin-tool={toolId}
      data-tour-id={tourId ?? `profile-pin-${toolId}`}
      aria-label={ariaLabel}
      title={label}
      aria-pressed={active || undefined}
      className={cn(
        dashboardUi.topHeaderActionBtn,
        size === "sm"
          ? "relative size-8 shrink-0 md:size-8"
          : "relative size-9 shrink-0 md:size-9",
        alert && dashboardUi.topHeaderActionBtnAlert,
        active &&
          "border-primary/60 bg-primary/5 text-primary hover:bg-primary/10 hover:text-primary",
        pinned && "ring-1 ring-primary/30",
        draggable && "cursor-grab active:cursor-grabbing",
        className,
      )}
      onClick={(e) => {
        if (draggable) {
          e.preventDefault();
          return;
        }
        onClick?.();
      }}
      onDragStart={(e) => {
        if (!draggable) return;
        e.dataTransfer.setData(PROFILE_PIN_DRAG_MIME, toolId);
        e.dataTransfer.effectAllowed = "move";
        setProfilePinDraggingTool(toolId);
      }}
      onDragEnd={() => {
        setProfilePinDraggingTool(null);
      }}
    >
      <Icon
        className={cn(size === "sm" ? "size-3.5" : "size-4 md:size-5")}
        aria-hidden
      />
      {badge != null && badge > 0 ? (
        <span
          className={cn(
            dashboardUi.topHeaderCountBadge,
            dashboardUi.topHeaderCountBadgeAlert,
          )}
        >
          {badge > 99 ? "99+" : badge}
        </span>
      ) : null}
    </button>
  );
}

export function ProfilePinDropSlot({
  active,
  onDropTool,
  label = "+",
  size = "md",
  variant = "chip",
}: {
  active?: boolean;
  onDropTool: (id: ProfilePinToolId) => void;
  label?: string;
  size?: "sm" | "md";
  variant?: "chip" | "tile";
}) {
  if (variant === "tile") {
    return (
      <div
        className={cn(
          accountMenuLayout.toolTile,
          "border-dashed",
          active
            ? "border-primary/50 bg-primary/5"
            : "border-border/80 bg-muted/20",
          motionClass.microInteractive,
        )}
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
        }}
        onDrop={(e) => {
          e.preventDefault();
          const raw = e.dataTransfer.getData(PROFILE_PIN_DRAG_MIME);
          if (raw === "alarm" || raw === "pdf" || raw === "theme") {
            onDropTool(raw);
          }
          setProfilePinDraggingTool(null);
        }}
      >
        <span className="text-sm text-muted-foreground">{label}</span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-lg border-2 border-dashed text-xs text-muted-foreground",
        size === "sm" ? "size-8" : "size-9",
        active
          ? "border-primary/50 bg-primary/5"
          : "border-border/80 bg-muted/20",
        motionClass.microInteractive,
      )}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
      }}
      onDrop={(e) => {
        e.preventDefault();
        const raw = e.dataTransfer.getData(PROFILE_PIN_DRAG_MIME);
        if (raw === "alarm" || raw === "pdf" || raw === "theme") {
          onDropTool(raw);
        }
        setProfilePinDraggingTool(null);
      }}
    >
      {label}
    </div>
  );
}

export function ProfilePinHeaderDropZone({
  visible,
  onUnpinTool,
}: {
  visible: boolean;
  onUnpinTool: (id: ProfilePinToolId) => void;
}) {
  const t = useSheetCopy();
  if (!visible) return null;
  return (
    <div
      className={cn(
        "flex size-9 shrink-0 items-center justify-center rounded-lg border-2 border-dashed border-border/80 bg-muted/30 text-[10px] text-muted-foreground",
        motionClass.microInteractive,
      )}
      aria-label={t("account.returnTool")}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
      }}
      onDrop={(e) => {
        e.preventDefault();
        const raw = e.dataTransfer.getData(PROFILE_PIN_DRAG_MIME);
        if (raw === "alarm" || raw === "pdf" || raw === "theme") {
          onUnpinTool(raw);
        }
        setProfilePinDraggingTool(null);
      }}
    >
      ↩
    </div>
  );
}