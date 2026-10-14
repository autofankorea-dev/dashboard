"use client";

import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import type { ModuleReceipt } from "@/lib/data/iot";
import { isValidFarmKey } from "@/lib/domain/barn-catalog";
import { farmKeyId, type FarmKey } from "@/lib/domain/farm-key";
import { farmShortLabel } from "@/lib/domain/farm-summaries";
import { formatKst } from "@/lib/datetime/kst";
import { useSheetCopy } from "@/components/account/profile-sheet-prefs";
import { accountMenuLayout } from "@/lib/ui/account-menu-layout";
import { cn } from "@/lib/utils";

type Props = {
  receipts: ModuleReceipt[];
  max?: number;
  farmKeyFilter?: FarmKey | null;
  scrollable?: boolean;
  onItemNavigate?: (farmKey: FarmKey) => void;
  peekCount?: number;
  embedded?: boolean;
  trailing?: ReactNode;
  /** chips — Two-Zone footer horizontal scroll (cross-farm only) */
  variant?: "list" | "chips";
  /** chips 모드에서 active farm 제외 */
  excludeActiveFarm?: boolean;
};

export function RecentActivityMenuSection({
  receipts,
  max = 6,
  farmKeyFilter = null,
  scrollable = false,
  onItemNavigate,
  peekCount,
  embedded = false,
  trailing,
  variant = "list",
  excludeActiveFarm = false,
}: Props) {
  const t = useSheetCopy();
  const [expanded, setExpanded] = useState(false);

  const allItems = useMemo(() => {
    const valid = receipts.filter((r) => isValidFarmKey(r.farmKey));
    let scoped = valid;
    if (farmKeyFilter != null && !excludeActiveFarm) {
      scoped = valid.filter(
        (r) => farmKeyId(r.farmKey) === farmKeyId(farmKeyFilter),
      );
    } else if (farmKeyFilter != null && excludeActiveFarm) {
      scoped = valid.filter(
        (r) => farmKeyId(r.farmKey) !== farmKeyId(farmKeyFilter),
      );
    }
    return scoped.slice(0, max);
  }, [excludeActiveFarm, farmKeyFilter, max, receipts]);

  const showPeek = peekCount != null && peekCount > 0 && !expanded;
  const items = showPeek ? allItems.slice(0, peekCount) : allItems;
  const hiddenCount = showPeek ? allItems.length - items.length : 0;

  const microHeader = (
    <div className={accountMenuLayout.sectionMicroHeader}>
      <span className={accountMenuLayout.sectionMicroLabel}>{t("account.recent")}</span>
      <div className="flex items-center gap-2">
        {hiddenCount > 0 ? (
          <button
            type="button"
            className={accountMenuLayout.sectionAction}
            onClick={() => setExpanded(true)}
          >
            +{hiddenCount}
          </button>
        ) : null}
        {trailing}
      </div>
    </div>
  );

  const list =
    items.length === 0 ? (
      <p className={accountMenuLayout.inlineMeta}>{t("account.recentEmpty")}</p>
    ) : (
      <ul className={accountMenuLayout.list}>
        {items.map((r) => {
          const label = farmShortLabel(r.farmKey);
          const meta = formatKst(r.receivedAt, "short");
          const line = `${label} · ${meta}`;

          if (onItemNavigate) {
            return (
              <li key={`${farmKeyId(r.farmKey)}-${r.moduleUid}`}>
                <button
                  type="button"
                  className={accountMenuLayout.listInlineRow}
                  aria-label={t("account.openFarm", { line })}
                  onClick={() => onItemNavigate(r.farmKey)}
                >
                  {line}
                </button>
              </li>
            );
          }

          return (
            <li
              key={`${farmKeyId(r.farmKey)}-${r.moduleUid}`}
              className={cn(
                accountMenuLayout.listInlineRow,
                "cursor-default hover:bg-transparent",
              )}
            >
              {line}
            </li>
          );
        })}
      </ul>
    );

  if (variant === "chips") {
    if (allItems.length === 0) return null;

    return (
      <div
        className={accountMenuLayout.activityFooter}
        data-tour-id="account-menu-activity"
      >
        {allItems.map((r) => {
          const label = farmShortLabel(r.farmKey);
          const meta = formatKst(r.receivedAt, "short");
          const timePart = meta.split(" ").slice(-1)[0] ?? meta;
          const chipLabel = `${label} · ${timePart}`;

          if (onItemNavigate) {
            return (
              <button
                key={`${farmKeyId(r.farmKey)}-${r.moduleUid}`}
                type="button"
                className={accountMenuLayout.activityChip}
                aria-label={t("account.openFarm", { line: chipLabel })}
                onClick={() => onItemNavigate(r.farmKey)}
              >
                {chipLabel}
              </button>
            );
          }

          return (
            <span
              key={`${farmKeyId(r.farmKey)}-${r.moduleUid}`}
              className={accountMenuLayout.activityChip}
            >
              {chipLabel}
            </span>
          );
        })}
      </div>
    );
  }

  if (embedded) {
    return (
      <>
        {microHeader}
        {list}
      </>
    );
  }

  return (
    <div
      className={cn(accountMenuLayout.section, scrollable && "min-h-0 overflow-y-auto")}
      data-tour-id="account-menu-activity"
    >
      {microHeader}
      {list}
    </div>
  );
}
