import { HealthSectionCard } from "@/components/admin/health/health-section-card";
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
  formatCommandTarget,
} from "@/lib/ui/controller-labels";
import { opsLayout, opsTypography } from "@/lib/ui/dashboard-page-ui";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

const statusLabel: Record<string, string> = {
  pending: commandStatusLabel("pending"),
  sent: commandStatusLabel("sent"),
  applied: commandStatusLabel("applied"),
  failed: commandStatusLabel("failed"),
  cancelled: commandStatusLabel("cancelled"),
};

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

function fmtCommand(c: ThermoCommand) {
  return c.alarmSettings ? `저온 ${c.alarmSettings.lowTempC}℃ · 고온 ${c.alarmSettings.highTempC}℃${c.channels?.length ? " · " + c.channels.map(ch => `${ch.channel}: ${ch.setpointTemp}℃ +${ch.tempDeviation} · 환기 ${ch.minVentPct}~${ch.maxVentPct}%`).join(" / ") : ""}` : c.channels?.length ? c.channels.map((ch) => `${ch.channel}: ${ch.setpointTemp}℃ +${ch.tempDeviation} · 환기 ${ch.minVentPct}~${ch.maxVentPct}%`).join(" / ") : `환기 ${c.minVentPct}~${c.maxVentPct}% · ${c.setpointTemp}℃ +${c.tempDeviation}`;
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
  title = "명령 히스토리",
  action,
  toolbar,
  emptyMessage = "등록된 명령이 없습니다.",
  emptyExtra,
  busy = false,
  bodyHidden = false,
  mobileDensity = "default",
  onSelect,
  className,
}: Props) {
  return (
    <HealthSectionCard
      density="hub"
      title={title}
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
                {emptyMessage}
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
                          시간
                        </TableHead>
                        <TableHead
                          className={cn(
                            opsTypography.meta,
                            opsLayout.commandTableStickyTh,
                          )}
                        >
                          명령
                        </TableHead>
                        <TableHead
                          className={cn(
                            opsTypography.meta,
                            opsLayout.commandTableStickyTh,
                          )}
                        >
                          대상
                        </TableHead>
                        <TableHead
                          className={cn(
                            opsTypography.meta,
                            opsLayout.commandTableStickyTh,
                          )}
                        >
                          상태
                        </TableHead>
                        <TableHead
                          className={cn(
                            opsTypography.meta,
                            opsLayout.commandTableStickyTh,
                          )}
                        >
                          상세
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
                          <TableCell>{fmtCommand(c)}</TableCell>
                          <TableCell>{formatCommandTarget(c)}</TableCell>
                          <TableCell>
                            <Badge
                              variant={statusVariant(c.status)}
                              className="text-xs font-medium"
                            >
                              {statusLabel[c.status] ?? c.status}
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
