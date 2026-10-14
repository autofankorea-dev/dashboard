"use client";

import type { BarnReading } from "@/lib/data/iot";
import { formatStallTypeLabelLocalized } from "@/lib/domain/stall-type";
import { useProfileSheetPrefs } from "@/components/account/profile-sheet-prefs";
import type { FarmChartScope } from "@/lib/farm/farm-chart-scope";
import {
  ControllerAffiliationMarks,
  StallUnitNoMark,
} from "@/components/farm/controller-summary-parts";
import { cn } from "@/lib/utils";

export type UnifiedBarnTrendControllerRef = {
  key: string;
  reading: BarnReading | null;
};

/** 모바일 차트 대상 — 축사유형 + 축사/컨트롤러 아이콘·번호 */
export function ChartScopeTargetMarks({
  chartScope,
  controllers,
  fallbackLabel,
  typeClassName,
}: {
  chartScope: FarmChartScope;
  controllers: UnifiedBarnTrendControllerRef[];
  fallbackLabel: string;
  typeClassName?: string;
}) {
  const locale = useProfileSheetPrefs().locale;
  if (chartScope.level === "farm") {
    return fallbackLabel;
  }

  const typeLabel = formatStallTypeLabelLocalized(chartScope.stallTyCode, locale);

  if (chartScope.level === "sp") {
    return <span className={cn("break-keep", typeClassName)}>{typeLabel}</span>;
  }

  const stallNo = chartScope.stallNo.startsWith("__")
    ? null
    : chartScope.stallNo;

  const controllerReading =
    chartScope.level === "controller"
      ? (controllers.find((c) => c.key === chartScope.controllerKey)?.reading ??
        controllers[0]?.reading)
      : controllers.length === 1
        ? controllers[0]?.reading
        : null;

  if (controllerReading) {
    return (
      <ControllerAffiliationMarks
        stallTyCode={chartScope.stallTyCode}
        stallNo={stallNo ?? controllerReading.stallNo}
        eqpmnNo={controllerReading.eqpmnNo}
        typeClassName={typeClassName}
      />
    );
  }

  return (
    <span className="inline-flex min-w-0 items-center gap-1.5">
      <span className={cn("break-keep", typeClassName)}>{typeLabel}</span>
      <StallUnitNoMark stallNo={stallNo} />
    </span>
  );
}
