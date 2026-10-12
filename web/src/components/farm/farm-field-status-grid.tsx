"use client";

import { useMemo } from "react";
import type { AlarmSettings } from "@/lib/domain/alarms";
import type { BarnMapSnapshot, BarnReading } from "@/lib/data/iot";
import { parseBarnCatalogKey } from "@/lib/domain/barn-catalog";
import { normalizeStallTyCode } from "@/lib/domain/stall-type";
import { FarmMapCard } from "@/components/farm/farm-map-card";
import { worstControllerEnvCoverLevel } from "@/lib/farm/controller-env-cover";
import { cn } from "@/lib/utils";
import { motionClass } from "@/lib/ui/motion-classes";
import { PanelLeft, PanelLeftClose } from "lucide-react";

/** 축사 카드에 속한 판독값들 */
export function readingsMatchingBarn(
  barn: BarnMapSnapshot,
  readings: BarnReading[],
): BarnReading[] {
  const entry = parseBarnCatalogKey(barn.meta.id);
  const stallTy = normalizeStallTyCode(entry?.stallTyCode ?? "");
  const stallNo = barn.meta.stallNo ?? "";
  return readings.filter(
    (r) =>
      normalizeStallTyCode(r.stallTyCode ?? "") === stallTy &&
      (r.stallNo ?? "") === stallNo,
  );
}

/** 축사 카드에 속한 첫 판독값 (reading.key) */
export function firstReadingKeyForBarn(
  barn: BarnMapSnapshot,
  readings: BarnReading[],
): string | null {
  return readingsMatchingBarn(barn, readings)[0]?.key ?? null;
}

/** 축사 카드 → 목록 포커스용 첫 컨트롤러 키 */
export function firstControllerKeyForBarn(
  barn: BarnMapSnapshot,
  readings: BarnReading[],
): string | null {
  const readingKey = firstReadingKeyForBarn(barn, readings);
  if (!readingKey) return null;
  return readings.find((r) => r.key === readingKey)?.controllerKey ?? null;
}

type Props = {
  barns: BarnMapSnapshot[];
  readings: BarnReading[];
  selectedBarnId?: string | null;
  bulkMode?: boolean;
  selectedSpCodes?: Set<string>;
  onSelectBarn: (barn: BarnMapSnapshot) => void;
  /** 단일 축사 필터 해제 → 전체 컨트롤러 */
  onShowAll?: () => void;
  /** PC 스플릿 — 접힘(아이콘 레일) */
  collapsed?: boolean;
  onHide?: () => void;
  onShow?: () => void;
  alarmSettings?: AlarmSettings;
  className?: string;
};

/**
 * 현장 스플릿 좌측 — 세로 스택 현황 (상태색 + 명칭 + 온·습도).
 * 접힘 시 나타내기 아이콘만 남는 좁은 레일.
 */
export function FarmFieldStatusGrid({
  barns,
  readings,
  selectedBarnId = null,
  bulkMode = false,
  selectedSpCodes,
  onSelectBarn,
  onShowAll,
  collapsed = false,
  onHide,
  onShow,
  alarmSettings,
  className,
}: Props) {
  const sorted = useMemo(() => {
    return [...barns].sort((a, b) => {
      const ar = a.meta.grid.row - b.meta.grid.row;
      if (ar !== 0) return ar;
      return a.meta.grid.col - b.meta.grid.col;
    });
  }, [barns]);

  const showToggle = onHide != null || onShow != null;

  return (
    <div
      className={cn(
        "flex w-full flex-col rounded-md border",
        className,
      )}
      data-tour-id="field-status-grid"
      data-collapsed={collapsed ? "true" : "false"}
    >
      {showToggle ? (
        <div
          className={cn(
            "flex shrink-0 items-center border-b",
            collapsed ? "justify-center px-0.5 py-1.5" : "gap-1.5 px-2 py-1.5",
          )}
        >
          {!collapsed ? (
            onShowAll ? (
              <button
                type="button"
                onClick={onShowAll}
                aria-pressed={!selectedBarnId}
                aria-label="전체 컨트롤러 보기"
                className={cn(
                  "min-w-0 flex-1 truncate text-left text-xs font-semibold",
                  motionClass.microHover,
                  selectedBarnId
                    ? "text-muted-foreground hover:text-foreground"
                    : "text-foreground",
                )}
              >
                전체보기
              </button>
            ) : (
              <p className="min-w-0 flex-1 truncate text-xs font-semibold">
                전체보기
              </p>
            )
          ) : null}
          {collapsed ? (
            <button
              type="button"
              onClick={onShow}
              className={cn(
                "inline-flex size-8 items-center justify-center rounded-md text-muted-foreground",
                "hover:bg-muted/50 hover:text-foreground",
                motionClass.microHover,
              )}
              aria-label="현황 나타내기"
              data-tour-id="field-status-show"
            >
              <PanelLeft className="size-4" aria-hidden />
            </button>
          ) : (
            <button
              type="button"
              onClick={onHide}
              className={cn(
                "inline-flex size-8 items-center justify-center rounded-md text-muted-foreground",
                "hover:bg-muted/50 hover:text-foreground",
                motionClass.microHover,
              )}
              aria-label="현황 숨기기"
              data-tour-id="field-status-hide"
            >
              <PanelLeftClose className="size-4" aria-hidden />
            </button>
          )}
        </div>
      ) : null}
      <div
        className={cn(
          "overflow-hidden transition-[opacity,max-height] duration-motion-moderate ease-[var(--motion-ease-standard)]",
          collapsed
            ? "pointer-events-none max-h-0 opacity-0"
            : "max-h-[200rem] opacity-100",
        )}
        aria-hidden={collapsed}
      >
        <div className="p-1.5">
          <div className="flex flex-col gap-1.5">
            {sorted.map((b) => {
              const sp = parseBarnCatalogKey(b.meta.id)?.stallTyCode ?? "";
              const selected = bulkMode
                ? Boolean(sp && selectedSpCodes?.has(sp))
                : selectedBarnId === b.meta.id;
              return (
                <FarmMapCard
                  key={b.meta.id}
                  snapshot={b}
                  layout="stack"
                  compact
                  statusCompact
                  envCoverLevel={worstControllerEnvCoverLevel(
                    readingsMatchingBarn(b, readings),
                    alarmSettings,
                  )}
                  selectable
                  selected={selected}
                  onSelect={() => onSelectBarn(b)}
                />
              );
            })}
          </div>
          {readings.length === 0 ? (
            <p className="mt-2 text-xs text-muted-foreground">판독 대기 중…</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
