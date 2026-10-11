"use client";

import { Building2, GripVertical, Check, ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import type { BarnMapSnapshot } from "@/lib/data/iot";
import { parseBarnCatalogKey } from "@/lib/domain/barn-catalog";
import { EnvChip } from "@/components/common/env-chip";
import type { StatusTone } from "@/components/common/status-badge";
import { getStallTypeName, formatStallTypeLabelCompact } from "@/lib/domain/stall-type";
import { formatSensorNumberForDisplay } from "@/lib/domain/reading-display";
import { StallUnitNoMark } from "@/components/farm/controller-summary-parts";
import {
  controllerEnvCoverLabel,
  controllerEnvCoverRingClass,
  controllerEnvMetricTextClass,
  type ControllerEnvCoverLevel,
} from "@/lib/farm/controller-env-cover";
import {
  dashboardAffordance,
  dashboardElevation,
  dashboardUi,
} from "@/lib/ui/dashboard-page-ui";
import { cn } from "@/lib/utils";

/** 상태별 링/글로우 — 뱃지 대신 카드 자체에 색상 임팩트. 경고는 글로우 강화, 오프라인은 디밍. */
const STATUS_ACCENT: Record<StatusTone, string> = {
  normal: "ring-1 ring-[color-mix(in_oklch,var(--status-ok)_70%,transparent)]",
  caution:
    "ring-2 ring-[color-mix(in_oklch,var(--status-warn)_80%,transparent)]",
  warning:
    "ring-2 ring-[color-mix(in_oklch,var(--status-danger)_85%,transparent)]",
  offline: "ring-1 ring-muted-foreground/45",
};

/** 스플릿 현황 카드 — 히트맵 없이 상태 면색으로 한눈 파악 */
const STATUS_SURFACE: Record<StatusTone, string> = {
  normal: "bg-[color-mix(in_oklch,var(--status-ok)_14%,transparent)]",
  caution: "bg-[color-mix(in_oklch,var(--status-warn)_18%,transparent)]",
  warning: "bg-[color-mix(in_oklch,var(--status-danger)_18%,transparent)]",
  offline: "bg-[var(--status-offline)]",
};

const STATUS_LABEL: Record<StatusTone, string> = {
  normal: "정상",
  caution: "주의",
  warning: "경고",
  offline: "오프라인",
};

const ENV_SURFACE: Record<ControllerEnvCoverLevel, string> = {
  ok: "bg-[color-mix(in_oklch,var(--status-ok)_14%,transparent)]",
  warn: "bg-[color-mix(in_oklch,var(--status-warn)_18%,transparent)]",
  danger: "bg-[color-mix(in_oklch,var(--status-danger)_18%,transparent)]",
  offline: "bg-[var(--status-offline)]",
};

function compactEnvLevel(
  snapshotStatus: StatusTone,
  envCoverLevel?: ControllerEnvCoverLevel,
): ControllerEnvCoverLevel {
  if (snapshotStatus === "offline") return "offline";
  if (envCoverLevel) return envCoverLevel;
  if (snapshotStatus === "warning") return "danger";
  if (snapshotStatus === "caution") return "warn";
  return "ok";
}

function displayCardTypeName(snapshot: BarnMapSnapshot, compact = false): string {
  const entry = parseBarnCatalogKey(snapshot.meta.id);
  if (entry && entry.stallTyCode !== "UNK") {
    const tyName = compact
      ? formatStallTypeLabelCompact(entry.stallTyCode)
      : getStallTypeName(entry.stallTyCode);
    if (tyName && tyName !== entry.stallTyCode) {
      return tyName;
    }
  }
  const legacy = snapshot.meta.name.trim();
  const stripped = legacy.replace(/^SP\d+\s*/i, "").trim();
  return stripped || legacy || "축사";
}

function displayCardTitle(snapshot: BarnMapSnapshot, compact = false): string {
  const typeName = displayCardTypeName(snapshot, compact);
  const stallNo = snapshot.meta.stallNo?.trim() ?? "";
  return stallNo ? `${typeName} ${stallNo}` : typeName;
}

type Props = {
  snapshot: BarnMapSnapshot;
  className?: string;
  layout?: "grid" | "stack";
  compact?: boolean;
  draggable?: boolean;
  isDragging?: boolean;
  onGripPointerDown?: (id: string, e: React.PointerEvent) => void;
  /** ops 모바일 그리드 — 페이지 이동 대신 콜백 */
  onSelect?: () => void;
  /** 일괄적용 모드 — 카드 선택 토글 UI */
  selectable?: boolean;
  selected?: boolean;
  /** 병합 카드 — 온·습도 요약 아래에 함께 표시할 히트맵 슬롯 */
  graphContent?: ReactNode;
  /** 현장 스플릿 현황 — 면색+명칭+온습도만 (히트맵·그립 없음) */
  statusCompact?: boolean;
  /** 현황 면색 — 알람 판정. 없으면 수신 상태. */
  envCoverLevel?: ControllerEnvCoverLevel;
};

export function FarmMapCard({
  snapshot,
  className,
  layout = "grid",
  compact = false,
  draggable,
  isDragging,
  onGripPointerDown,
  onSelect,
  selectable = false,
  selected = false,
  graphContent,
  statusCompact = false,
  envCoverLevel,
}: Props) {
  const { meta } = snapshot;
  const title = displayCardTitle(snapshot, compact || statusCompact);
  const typeName = displayCardTypeName(snapshot, compact || statusCompact);
  const stallNo = meta.stallNo?.trim() || null;
  const showStallMark = meta.type !== "office" && Boolean(stallNo);
  const showGrip = Boolean(draggable) && !statusCompact;
  const showGraph = Boolean(graphContent) && !statusCompact;

  const tempLabel = formatSensorNumberForDisplay(snapshot.status, snapshot.tempC);
  const humLabel = formatSensorNumberForDisplay(
    snapshot.status,
    snapshot.humidityPct,
  );

  // 클릭: 일괄모드 선택, 또는 현장 통합 시 상세/목록 연동.
  const handleSelect = () => {
    if (isDragging) return;
    onSelect?.();
  };

  if (statusCompact) {
    const envLevel = compactEnvLevel(snapshot.status, envCoverLevel);
    return (
      <button
        type="button"
        onClick={handleSelect}
        disabled={!onSelect}
        aria-label={`${title} ${controllerEnvCoverLabel(envLevel)} 온도 ${tempLabel ?? "—"} 습도 ${humLabel ?? "—"}`}
        data-tour-id="barn-card"
        className={cn(
          "flex w-full min-w-0 flex-col items-center gap-0.5 rounded-lg border px-2 py-1.5 text-center transition-shadow",
          ENV_SURFACE[envLevel],
          controllerEnvCoverRingClass(envLevel),
          onSelect && dashboardAffordance.hitSurface,
          selectable && "cursor-pointer",
          selected &&
            "!ring-2 !ring-foreground/35 !ring-offset-1 dark:!ring-foreground/30",
          className,
        )}
      >
        <span
          className="flex w-full items-center justify-center gap-1 text-sm font-semibold leading-tight text-foreground"
          title={title}
        >
          <span className="min-w-0 truncate">{typeName}</span>
          {showStallMark ? (
            <StallUnitNoMark stallNo={stallNo} className="text-inherit" />
          ) : null}
          {onSelect ? (
            <ChevronRight
              className={cn(dashboardAffordance.hitHint, "text-inherit")}
              aria-hidden
            />
          ) : null}
        </span>
        <span className="flex w-full flex-nowrap items-baseline justify-center gap-2 whitespace-nowrap leading-none">
          <span className="inline-flex shrink-0 items-baseline gap-px">
            <span
              className={cn(
                dashboardUi.gridCellValueCompact,
                controllerEnvMetricTextClass(
                  envLevel,
                  dashboardUi.channelTextTemp,
                ),
              )}
            >
              {tempLabel != null && tempLabel !== "" ? tempLabel : "—"}
            </span>
            <span
              className={cn(
                "text-[0.65rem] font-medium opacity-70 dark:opacity-90",
                controllerEnvMetricTextClass(
                  envLevel,
                  dashboardUi.channelTextTemp,
                ),
              )}
            >
              ℃
            </span>
          </span>
          <span
            className="h-3 w-px shrink-0 self-center bg-border/60"
            aria-hidden
          />
          <span className="inline-flex shrink-0 items-baseline gap-px">
            <span
              className={cn(
                dashboardUi.gridCellValueCompact,
                controllerEnvMetricTextClass(envLevel, "text-channel-info"),
              )}
            >
              {humLabel != null && humLabel !== "" ? humLabel : "—"}
            </span>
            <span
              className={cn(
                "text-[0.65rem] font-medium opacity-70 dark:opacity-90",
                controllerEnvMetricTextClass(envLevel, "text-channel-info"),
              )}
            >
              %
            </span>
          </span>
        </span>
      </button>
    );
  }

  return (
    <div
      aria-label={`${title} ${STATUS_LABEL[snapshot.status]}`}
      data-tour-id="barn-card"
      className={cn(
        "flex min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border transition-shadow",
        statusCompact ? STATUS_SURFACE[snapshot.status] : "bg-background",
        layout === "stack" || !compact ? "h-auto" : "h-full",
        STATUS_ACCENT[snapshot.status],
        isDragging && "!opacity-50 !ring-2 !ring-primary",
        layout === "grid" &&
          !statusCompact &&
          dashboardElevation.interactiveHover,
        selectable && "cursor-pointer",
        selected &&
          "!ring-2 !ring-foreground/35 !ring-offset-1 dark:!ring-foreground/30",
        className
      )}
      style={
        layout === "grid" && !statusCompact
          ? { gridColumn: meta.grid.col, gridRow: meta.grid.row }
          : undefined
      }
    >
      <div
        className={cn(
          "flex min-h-0 shrink-0 items-center gap-1 border-b",
          statusCompact ? "border-black/5 bg-transparent dark:border-white/10" : "bg-muted/30",
          compact || statusCompact ? "gap-1 px-1.5 py-1" : "gap-1.5 px-2 py-1.5 lg:gap-2"
        )}
      >
        {selectable ? (
          <span
            className={cn(
              "flex size-5 shrink-0 items-center justify-center rounded border",
              selected
                ? "border-primary bg-primary text-primary-foreground"
                : "border-muted-foreground/40 bg-background"
            )}
            aria-hidden
          >
            {selected ? <Check className="size-3.5" /> : null}
          </span>
        ) : null}
        {showGrip ? (
          <div
            role="button"
            tabIndex={0}
            onPointerDown={(e) => {
              if (e.button !== 0) return;
              onGripPointerDown?.(meta.id, e);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") e.preventDefault();
            }}
            className={cn(
              "pointer-events-auto hidden shrink-0 cursor-grab touch-none select-none rounded border border-muted-foreground/25 bg-muted/50 text-muted-foreground hover:border-border hover:bg-muted hover:text-foreground active:cursor-grabbing lg:block",
              compact ? "p-1" : "p-1.5",
            )}
            aria-label="축사 위치 이동"
            data-tour-id="barn-drag"
          >
            <GripVertical
              className={cn(
                "pointer-events-none",
                compact ? dashboardUi.gridCellIconCompact : dashboardUi.gridCellIconDefault,
              )}
              strokeWidth={dashboardUi.iconStroke}
              aria-hidden
            />
          </div>
        ) : null}
        <button
          type="button"
          onClick={handleSelect}
          disabled={!onSelect}
          className={cn(
            "flex min-w-0 flex-1 items-center gap-1.5 text-left",
            onSelect && "cursor-pointer"
          )}
        >
          {meta.type === "office" ? (
            <Building2
              className={cn(
                "text-emerald-600",
                compact ? dashboardUi.gridCellIconCompact : dashboardUi.gridCellIconDefault,
              )}
              strokeWidth={dashboardUi.iconStroke}
            />
          ) : null}
          <span
            className={cn(
              "flex min-w-0 flex-1 items-center gap-1",
              compact || statusCompact
                ? dashboardUi.gridCellValueCompact
                : dashboardUi.gridCellValueDefault,
            )}
            title={title}
          >
            <span
              className={cn(
                "min-w-0",
                compact || statusCompact
                  ? "line-clamp-2"
                  : "truncate whitespace-nowrap",
              )}
            >
              {typeName}
            </span>
            {showStallMark ? (
              <StallUnitNoMark stallNo={stallNo} className="shrink-0 text-inherit" />
            ) : null}
            {onSelect ? (
              <ChevronRight
                className={cn(dashboardAffordance.hitHint, "shrink-0 text-muted-foreground")}
                aria-hidden
              />
            ) : null}
          </span>
        </button>
      </div>

      <div
        className={cn(
          "flex min-h-0 flex-1 flex-col",
          compact || statusCompact ? "gap-1 px-1.5 py-1" : "gap-1 px-2 py-1.5"
        )}
      >
        <button
          type="button"
          onClick={handleSelect}
          disabled={!onSelect}
          className={cn(
            "grid min-h-0 grid-cols-2 rounded text-left",
            compact || statusCompact ? "gap-1" : "gap-1 [&>div]:px-2 [&>div]:py-1.5 lg:[&>div]:px-4 lg:[&>div]:py-3",
            onSelect && "cursor-pointer hover:bg-muted/20"
          )}
        >
          <EnvChip
            kind="temp"
            value={formatSensorNumberForDisplay(snapshot.status, snapshot.tempC)}
            valueOnly={compact || statusCompact}
            compact={compact || statusCompact}
          />
          <EnvChip
            kind="humidity"
            value={formatSensorNumberForDisplay(
              snapshot.status,
              snapshot.humidityPct
            )}
            valueOnly={compact || statusCompact}
            compact={compact || statusCompact}
          />
        </button>
        {showGraph ? <div className="min-h-0">{graphContent}</div> : null}
      </div>
    </div>
  );
}
