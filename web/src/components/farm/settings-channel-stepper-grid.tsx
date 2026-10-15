"use client";

import type { ReactNode } from "react";
import type { PanelDraft } from "@/lib/controllers/controller-panel-draft";
import { MENU_STEPS } from "@/lib/controllers/controller-panel-map";
import type { PresetCreateField } from "@/lib/farm/command-presets";
import { SettingsStepperField } from "@/components/farm/settings-stepper-field";
import { dashboardElevation } from "@/lib/ui/dashboard-page-ui";
import { cn } from "@/lib/utils";
import { useSheetCopy } from "@/components/account/profile-sheet-prefs";
import type { SheetCopyKey } from "@/lib/ui/sheet-copy";

type Props = {
  draft: PanelDraft;
  disabled?: boolean;
  ventStep: number;
  onChange: (field: PresetCreateField, value: number) => void;
};

export function SettingsChannelStepperGrid({
  draft,
  disabled = false,
  ventStep,
  onChange,
}: Props) {
  const t = useSheetCopy();
  const fields: {
    field: PresetCreateField;
    labelKey: SheetCopyKey;
    step: number;
    min: number;
    max: number;
    decimals: number;
  }[] = [
    {
      field: "setpointTemp",
      labelKey: "settings.setC",
      step: MENU_STEPS.setpoint.step,
      min: MENU_STEPS.setpoint.min,
      max: MENU_STEPS.setpoint.max,
      decimals: MENU_STEPS.setpoint.decimals,
    },
    {
      field: "tempDeviation",
      labelKey: "settings.devC",
      step: MENU_STEPS.deviation.step,
      min: MENU_STEPS.deviation.min,
      max: MENU_STEPS.deviation.max,
      decimals: MENU_STEPS.deviation.decimals,
    },
    {
      field: "minVentPct",
      labelKey: "settings.ventMinPct",
      step: ventStep,
      min: 0,
      max: 100,
      decimals: 0,
    },
    {
      field: "maxVentPct",
      labelKey: "settings.ventMaxPct",
      step: ventStep,
      min: 0,
      max: 100,
      decimals: 0,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-2">
      {fields.map((spec) => (
        <SettingsStepperField
          key={spec.field}
          label={t(spec.labelKey)}
          value={draft[spec.field]}
          step={spec.step}
          min={spec.min}
          max={spec.max}
          decimals={spec.decimals}
          disabled={disabled}
          onChange={(next) => onChange(spec.field, next)}
        />
      ))}
    </div>
  );
}

/** 생성·행 편집 덮개에서 채널 한 덩어리를 우물 면으로 묶는다. */
export function SettingsChannelWell({
  title,
  children,
}: {
  title?: string;
  children: ReactNode;
}) {
  return (
    <section
      className={cn(dashboardElevation.well, "flex flex-col gap-2 p-2.5")}
      aria-label={title}
    >
      {title ? (
        <p className="text-xs font-semibold leading-none text-foreground">
          {title}
        </p>
      ) : null}
      {children}
    </section>
  );
}
