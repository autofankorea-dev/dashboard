"use client";

import { HealthSectionCard } from "@/components/admin/health/health-section-card";
import { useProfileSheetPrefs, useSheetCopy } from "@/components/account/profile-sheet-prefs";
import { CommandHistoryMobileList } from "@/components/controllers/command-history-mobile-list";
import { Badge } from "@/components/ui/badge";
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatKst } from "@/lib/datetime/kst";
import { commandStatusLabel } from "@/lib/controllers/controller-settings";
import type { ThermoCommand } from "@/lib/data/commands";
import {
  formatCommandDetail,
  formatCommandSummary,
  formatCommandTarget,
} from "@/lib/ui/controller-labels";
import { opsLayout, opsTypography } from "@/lib/ui/dashboard-page-ui";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

const statusVariant = (
  status: string,
): "default" | "secondary" | "destructive" | "outline" => {
  if (status === "applied") return "default";
  if (status === "sent") return "secondary";
  if (status === "failed") return "destructive";
  if (status === "pending") return "outline";
  return "outline";
};

function fmtTime(iso: string) {
  return formatKst(iso, "short");
}

function fmtCommand(c: ThermoCommand, locale: "ko" | "en") {
  return formatCommandSummary(c, locale);
}

type Props = {
  commands?: ThermoCommand[];
  title?: string;
  action?: ReactNode;
  /** 본문 상단 (기간 칩 등). */
  toolbar?: ReactNode;
  /** 비어 있을 때 문구 (접힘 상태 등). */
  emptyMessage?: string;
  /** 빈 상태 아래 CTA 등. */
  emptyExtra?: ReactNode;
  /** 재조회 중 — 목록 dim */
  busy?: boolean;
  /** true면 본문 숨김 (PC 접힘). */
  bodyHidden?: boolean;
  /** 모바일 리스트 밀도. */
  mobileDensity?: "default" | "brief";
  onSelect?: (command: ThermoCommand) => void;
  className?: string;
};

export function CommandHistoryTable({
  commands = [],
  title,
  action,
  toolbar,
  emptyMessage,
  emptyExtra,
  busy = false,
  bodyHidden = false,
  mobileDensity = "default",
  onSelect,
  className,
}: Props) {
  const t = useSheetCopy();
  const locale = useProfileSheetPrefs().locale;
  const heading = title ?? t("cmd.history");
  const empty = emptyMessage ?? t("cmd.empty");
  return (
    <HealthSectionCard
      density="hub"
      title={heading}
      action={action}
      className={cn("w-full shrink-0", className)}
    >
      {bodyHidden ? null : (
        <>
          {toolbar ? <div className="mb-2">{toolbar}</div> : null}
          {commands.length === 0 ? (
            emptyExtra ? (
              emptyExtra
            ) : (
              <p className={cn("py-4 text-center", opsTypography.meta)}>
                {empty}
              </p>
            )
          ) : (
            <div
              className={cn(
                busy && "pointer-events-none opacity-50 transition-opacity",
              )}
              aria-busy={busy || undefined}
            >
              <CommandHistoryMobileList
                commands={commands}
                density={mobileDensity}
                onSelect={onSelect}
              />
              <div className="hidden md:block">
                <div className={opsLayout.commandTableScroll}>
                  <table
                    className={cn(
                      opsTypography.body,
                      "w-full min-w-[36rem] caption-bottom text-sm",
                    )}
                  >
                    <TableHeader>
                      <TableRow>
                        <TableHead
                          className={cn(
                            opsTypography.meta,
                            opsLayout.commandTableStickyTh,
                          )}
                        >
                          {t("cmd.time")}
                        </TableHead>
                        <TableHead
                          className={cn(
                            opsTypography.meta,
                            opsLayout.commandTableStickyTh,
                          )}
                        >
                          {t("cmd.command")}
                        </TableHead>
                        <TableHead
                          className={cn(
                            opsTypography.meta,
                            opsLayout.commandTableStickyTh,
                          )}
                        >
                          {t("cmd.target")}
                        </TableHead>
                        <TableHead
                          className={cn(
                            opsTypography.meta,
                            opsLayout.commandTableStickyTh,
                          )}
                        >
                          {t("cmd.status")}
                        </TableHead>
                        <TableHead
                          className={cn(
                            opsTypography.meta,
                            opsLayout.commandTableStickyTh,
                          )}
                        >
                          {t("cmd.detail")}
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {commands.map((c) => (
                        <TableRow
                          key={c.id}
                          tabIndex={onSelect ? 0 : undefined}
                          role={onSelect ? "button" : undefined}
                          className={
                            onSelect
                              ? "cursor-pointer hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                              : undefined
                          }
                          onClick={onSelect ? () => onSelect(c) : undefined}
                          onKeyDown={
                            onSelect
                              ? (e) => {
                                  if (e.key === "Enter" || e.key === " ") {
                                    e.preventDefault();
                                    onSelect(c);
                                  }
                                }
                              : undefined
                          }
                        >
                          <TableCell className="whitespace-nowrap text-muted-foreground">
                            {fmtTime(c.createdAt)}
                          </TableCell>
                          <TableCell>{fmtCommand(c, locale)}</TableCell>
                          <TableCell>{formatCommandTarget(c)}</TableCell>
                          <TableCell>
                            <Badge
                              variant={statusVariant(c.status)}
                              className="text-xs font-medium"
                            >
                              {commandStatusLabel(c.status, locale)}
                            </Badge>
                          </TableCell>
                          <TableCell className="max-w-[8rem] truncate text-muted-foreground">
                            {formatCommandDetail(c.errorMsg, c.note)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </HealthSectionCard>
  );
}
