"use client";

import { Badge } from "@/components/ui/badge";
import { formatKst } from "@/lib/datetime/kst";
import { commandStatusLabel } from "@/lib/controllers/controller-settings";
import type { ThermoCommand } from "@/lib/data/commands";
import { useProfileSheetPrefs } from "@/components/account/profile-sheet-prefs";
import { formatCommandSummary, formatCommandTarget } from "@/lib/ui/controller-labels";
import { opsStatus, opsTypography } from "@/lib/ui/dashboard-page-ui";
import { cn } from "@/lib/utils";

const statusVariant = (
  status: string,
): "default" | "secondary" | "destructive" | "outline" => {
  if (status === "applied") return "default";
  if (status === "sent") return "secondary";
  if (status === "failed") return "destructive";
  return "outline";
};

function fmtTime(iso: string) {
  return formatKst(iso, "short");
}

function fmtCommand(c: ThermoCommand, locale: "ko" | "en") {
  return formatCommandSummary(c, locale, { trailingDeviation: false });
}

type Props = {
  commands: ThermoCommand[];
  /** brief: 1줄 요약 (운영 모바일 미리보기). */
  density?: "default" | "brief";
  /** true면 md에서도 표시 (시트 등). */
  forceVisible?: boolean;
  onSelect?: (command: ThermoCommand) => void;
};

export function CommandHistoryMobileList({
  commands,
  density = "default",
  forceVisible = false,
  onSelect,
}: Props) {
  const locale = useProfileSheetPrefs().locale;
  const brief = density === "brief";

  return (
    <ul
      className={cn(
        "space-y-1.5",
        !forceVisible && "md:hidden",
        brief ? "space-y-1" : "space-y-2",
      )}
    >
      {commands.map((c) => {
        const interactive = Boolean(onSelect);
        const body = brief ? (
          <>
            <span className={cn("shrink-0 tabular-nums", opsTypography.meta)}>
              {fmtTime(c.createdAt)}
            </span>
            <span className={cn("min-w-0 flex-1 truncate", opsTypography.body)}>
              {fmtCommand(c, locale)}
            </span>
            <Badge variant={statusVariant(c.status)} className="shrink-0 text-[0.65rem]">
              {commandStatusLabel(c.status, locale)}
            </Badge>
          </>
        ) : (
          <>
            <div className="flex items-start justify-between gap-2">
              <p className={opsTypography.meta}>{fmtTime(c.createdAt)}</p>
              <Badge variant={statusVariant(c.status)} className="text-xs">
                {commandStatusLabel(c.status, locale)}
              </Badge>
            </div>
            <p className={cn(opsTypography.body, "mt-1.5 font-medium")}>
              {fmtCommand(c, locale)} · +{c.tempDeviation}
            </p>
            <p className={cn(opsTypography.meta, "mt-1")}>
              {formatCommandTarget(c)}
            </p>
          </>
        );

        if (interactive) {
          return (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => onSelect?.(c)}
                className={cn(
                  "w-full text-left transition-colors hover:bg-muted/50",
                  opsStatus.chipFocus,
                  brief
                    ? "flex items-center gap-2 rounded-lg border px-2.5 py-1.5"
                    : "rounded-xl border bg-card px-3 py-3",
                )}
              >
                {body}
              </button>
            </li>
          );
        }

        return (
          <li
            key={c.id}
            className={
              brief
                ? "flex items-center gap-2 rounded-lg border px-2.5 py-1.5"
                : "rounded-xl border bg-card px-3 py-3"
            }
          >
            {body}
          </li>
        );
      })}
    </ul>
  );
}
