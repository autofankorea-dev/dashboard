import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AlarmThresholds } from "@/lib/domain/alarms";
import { dashboardTypography, dashboardUi } from "@/lib/ui/dashboard-page-ui";
import { cn } from "@/lib/utils";

export type ThresholdField = {
  key: keyof AlarmThresholds;
  label: string;
  unit: string;
};

export const tempFields: ThresholdField[] = [
  { key: "tempHigh", label: "상한", unit: "℃" },
  { key: "tempLow", label: "하한", unit: "℃" },
];

export const humidityFields: ThresholdField[] = [
  { key: "humidityHigh", label: "상한", unit: "%" },
  { key: "humidityLow", label: "하한", unit: "%" },
];

/** 숫자 입력 기반 임계값 그룹 (온도/습도 공용) */
export function ThresholdFieldGroup({
  title,
  icon,
  fields,
  values,
  onChange,
  disabled,
  compact,
}: {
  title: string;
  icon: React.ReactNode;
  fields: ThresholdField[];
  values: AlarmThresholds;
  onChange: (next: AlarmThresholds) => void;
  disabled?: boolean;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        compact
          ? dashboardUi.opsSideInnerCard
          : cn(dashboardUi.innerCard, "bg-background"),
        disabled && "pointer-events-none opacity-50"
      )}
    >
      <div className={cn("mb-3 flex items-center gap-2", compact && "mb-2")}>
        {icon}
        <p
          className={cn(
            compact ? "text-sm font-medium" : dashboardTypography.sectionTitle,
            "text-foreground"
          )}
        >
          {title}
        </p>
      </div>
      <div className={cn("grid grid-cols-2", compact ? "gap-2" : "gap-3 md:gap-4")}>
        {fields.map((f) => (
          <div key={f.key} className={compact ? "space-y-1" : "space-y-2"}>
            <Label size={compact ? "default" : "dashboard"} className={compact ? dashboardUi.opsSideFieldLabel : undefined}>
              {f.label} ({f.unit})
            </Label>
            <Input
              type="number"
              uiSize={compact ? "default" : "dashboard"}
              className={compact ? "h-9 text-sm" : undefined}
              step={f.unit === "℃" ? 0.1 : 1}
              value={values[f.key]}
              disabled={disabled}
              onChange={(e) => {
                const next = Number(e.target.value);
                onChange({
                  ...values,
                  [f.key]: Number.isFinite(next) ? next : values[f.key],
                });
              }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
