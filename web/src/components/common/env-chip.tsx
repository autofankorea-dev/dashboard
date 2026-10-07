import { Thermometer, Droplets } from "lucide-react";
import { dashboardAffordance, dashboardUi } from "@/lib/ui/dashboard-page-ui";
import { cn } from "@/lib/utils";

type EnvKind = "temp" | "humidity";

const kindMap: Record<
  EnvKind,
  { label: string; unit: string; icon: typeof Thermometer; className: string }
> = {
  temp: {
    label: "온도",
    unit: "℃",
    icon: Thermometer,
    className: "text-channel-temp",
  },
  humidity: {
    label: "습도",
    unit: "%",
    icon: Droplets,
    className: "text-channel-info",
  },
};

type EnvChipProps = {
  kind: EnvKind;
  value?: string | null;
  tone?: string;
  /** 그리드 카드 — 라벨 없이 아이콘+값만 */
  valueOnly?: boolean;
  compact?: boolean;
  /** 맵 태그 등 — 칩 테두리·최소높이 없이 아이콘+값만 */
  bare?: boolean;
};

export function EnvChip({
  kind,
  value,
  tone,
  valueOnly = false,
  compact = false,
  bare = false,
}: EnvChipProps) {
  const conf = kindMap[kind];
  const Icon = conf.icon;
  const hasValue = value != null && value.trim() !== "" && Number.isFinite(Number(value));
  const iconClass = compact
    ? dashboardUi.gridCellIconCompact
    : dashboardUi.gridCellIconDefault;
  const valueClass = compact
    ? dashboardUi.gridCellValueCompact
    : dashboardUi.gridCellValueDefault;
  const unitClass = compact
    ? dashboardUi.gridCellMetaCompact
    : dashboardUi.tableMeta;
  const aria = hasValue ? `${conf.label} ${value}${conf.unit}` : `${conf.label}값 미수신`;
  const readout = (
    <>
      <Icon className={cn(iconClass, conf.className)} aria-hidden />
      <span
        className={cn(
          "min-w-0 truncate whitespace-nowrap text-foreground",
          valueClass,
        )}
      >
        {hasValue ? (
          <>
            {value}
            <span className={cn("ml-0.5 font-normal text-muted-foreground", unitClass)}>
              {conf.unit}
            </span>
          </>
        ) : (
        <span className="text-muted-foreground" title={`${conf.label}값 미수신`}>—</span>
        )}
      </span>
      {tone ? <span className="sr-only">{tone}</span> : null}
    </>
  );

  if (bare) {
    return (
      <span className="inline-flex min-w-0 items-center gap-1" aria-label={aria}>
        {readout}
      </span>
    );
  }

  if (valueOnly) {
    return (
      <div
        className={cn(
          "flex min-w-0 items-center justify-center gap-1 overflow-hidden",
          dashboardAffordance.dataPocket,
          compact
            ? "min-h-[3rem] gap-1 px-1.5 py-1 sm:min-h-[3.25rem]"
            : "px-2 py-1.5",
        )}
        aria-label={aria}
      >
        {readout}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex items-center gap-2 px-3 py-2",
        dashboardAffordance.dataPocket,
      )}
      aria-label={aria}
    >
      <Icon className={cn(dashboardUi.iconSm, conf.className)} aria-hidden />
      {hasValue ? (
        <p className={cn(dashboardUi.value, "leading-none text-foreground")}>
          {value}
          <span className={cn("ml-1", dashboardUi.tableMeta)}>{conf.unit}</span>
        </p>
      ) : (
        <span title={`${conf.label}값 미수신`} className={cn(dashboardUi.value, "leading-none text-muted-foreground")}>
          —
        </span>
      )}
      {tone ? (
        <span className={cn("ml-auto shrink-0", dashboardUi.tableMeta)}>{tone}</span>
      ) : null}
    </div>
  );
}
