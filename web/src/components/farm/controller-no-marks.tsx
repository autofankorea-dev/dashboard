"use client";

import {
  formatControllerHeaderStallType,
  formatControllerHeaderStallUnit,
  formatControllerNoLabel,
} from "@/lib/farm/controller-summary-display";
import { normalizeEqpmnNo } from "@/lib/data/controller-key";
import { formatStallTypeLabelCompact } from "@/lib/data/stall-type";
import { stallKeyFromReading } from "@/lib/data/reading-hierarchy";
import { useHydrationSafeDashboardCompact } from "@/components/layout/dashboard-viewport-context";
import { cn } from "@/lib/utils";
import { ControllerDeviceIcon } from "@/components/icons/controller-device-icon";
import { StallUnitIcon } from "@/components/icons/stall-unit-icon";

/** PC·모바일 모두 아이콘 오른쪽에 번호를 둔다. 우하단 오버레이는 두 자리의 앞자리를 아이콘 스트로크가 가린다. */
function NoMarkFrame({
  label,
  className,
  iconClassName,
  digit,
  Icon,
  dense = false,
  onFill = false,
}: {
  label: string;
  className?: string;
  iconClassName?: string;
  digit: string;
  Icon: typeof ControllerDeviceIcon | typeof StallUnitIcon;
  /** 맵 오버레이 — 작은 아이콘+우하단 숫자 */
  dense?: boolean;
  /** 상태색 면 위 — currentColor, 카드 스트로크 없음 */
  onFill?: boolean;
}) {
  const compact = useHydrationSafeDashboardCompact();
  const iconSize = dense ? "size-3.5" : compact ? "size-6" : "size-[1.35em]";
  // 글자 크기 = 아이콘 높이. 데스크톱 카드는 부모 1.75rem이라 아이콘이 1.35em(약 38px)인데 text-xs는 12px였다.
  const digitSize = dense
    ? "text-[0.875rem]"
    : compact
      ? "text-[1.5rem]"
      : "text-[1.35em]";
  const ink = onFill ? "text-current" : "text-muted-foreground";
  const digitInk = onFill ? "text-current" : "text-foreground";

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-0.5 align-middle",
        className,
      )}
      aria-label={label}
      title={label}
    >
      <Icon className={cn("shrink-0", iconSize, ink, iconClassName)} aria-hidden />
      <span
        className={cn(
          "inline-flex items-center whitespace-nowrap font-bold tabular-nums leading-none",
          digitSize,
          digitInk,
        )}
        aria-hidden
      >
        {digit}
      </span>
    </span>
  );
}

/** 컨트롤러 번호. 아이콘 오른쪽에 두 자리를 그대로 둔다. */
export function ControllerNoMark({
  eqpmnNo,
  className,
  iconClassName,
  dense,
  onFill,
}: {
  eqpmnNo: string | undefined;
  className?: string;
  iconClassName?: string;
  dense?: boolean;
  onFill?: boolean;
}) {
  const eq = normalizeEqpmnNo(eqpmnNo ?? "01");
  const noLabel = formatControllerNoLabel(eqpmnNo);
  return (
    <NoMarkFrame
      label={`컨트롤러 ${noLabel}`}
      className={className}
      iconClassName={iconClassName}
      digit={eq}
      Icon={ControllerDeviceIcon}
      dense={dense}
      onFill={onFill}
    />
  );
}

/** 축사 번호 — PC는 창고 아이콘 우하단 오버레이, 모바일은 아이콘+번호 나란히 */
export function StallUnitNoMark({
  stallNo,
  className,
  iconClassName,
  dense,
  onFill,
}: {
  stallNo: string | null | undefined;
  className?: string;
  iconClassName?: string;
  dense?: boolean;
  onFill?: boolean;
}) {
  const key = stallKeyFromReading({ stallNo: stallNo ?? null });
  const display = key.startsWith("__") ? "—" : key;
  const unitLabel = formatControllerHeaderStallUnit({
    stallNo: stallNo ?? null,
    controllerKey: undefined,
    idx: undefined,
  });
  return (
    <NoMarkFrame
      label={unitLabel}
      className={className}
      iconClassName={iconClassName}
      digit={display}
      Icon={StallUnitIcon}
      dense={dense}
      onFill={onFill}
    />
  );
}

/** 축사유형 + 축사/컨트롤러 아이콘·번호. PC 카드 헤더와 모바일 피커·시트 공용 */
export function ControllerAffiliationMarks({
  stallTyCode,
  stallNo,
  eqpmnNo,
  showType = true,
  compactType = false,
  className,
  typeClassName,
}: {
  stallTyCode?: string | null;
  stallNo?: string | null;
  eqpmnNo?: string;
  showType?: boolean;
  compactType?: boolean;
  className?: string;
  typeClassName?: string;
}) {
  const typeLabel = compactType
    ? formatStallTypeLabelCompact(stallTyCode)
    : formatControllerHeaderStallType({ stallTyCode: stallTyCode ?? "" });
  return (
    <span className={cn("inline-flex min-w-0 items-center gap-1.5", className)}>
      {showType ? (
        <span className={cn("break-keep", typeClassName)}>{typeLabel}</span>
      ) : null}
      <StallUnitNoMark stallNo={stallNo} />
      <ControllerNoMark eqpmnNo={eqpmnNo} />
    </span>
  );
}
