"use client";

import { useProfileSheetPrefs } from "@/components/account/profile-sheet-prefs";
import { kstDayStartIso } from "@/lib/datetime/kst";
import { opsStatus } from "@/lib/ui/dashboard-page-ui";
import { cn } from "@/lib/utils";

export type CommandHistoryRangeId = "today" | "7d" | "30d" | "all";

export const COMMAND_HISTORY_RANGE_DEFAULT: CommandHistoryRangeId = "7d";

const RANGES: { id: CommandHistoryRangeId; ko: string; en: string }[] = [
  { id: "today", ko: "오늘", en: "Today" },
  { id: "7d", ko: "7일", en: "7 days" },
  { id: "30d", ko: "30일", en: "30 days" },
  { id: "all", ko: "전체", en: "All" },
];

/** 프리셋 → created_at 하한 (KST 자정). all이면 null. */
export function commandHistoryRangeFromIso(
  range: CommandHistoryRangeId,
): string | null {
  switch (range) {
    case "today":
      return kstDayStartIso(0);
    case "7d":
      return kstDayStartIso(-6);
    case "30d":
      return kstDayStartIso(-29);
    default:
      return null;
  }
}

type Props = {
  value: CommandHistoryRangeId;
  onChange: (id: CommandHistoryRangeId) => void;
  disabled?: boolean;
  className?: string;
};

/** 운영 명령 전체 — 오늘/7일/30일/전체 칩. */
export function CommandHistoryRangeChips({
  value,
  onChange,
  disabled,
  className,
}: Props) {
  const en = useProfileSheetPrefs().locale === "en";
  return (
    <div
      className={cn("flex flex-wrap gap-1", className)}
      role="group"
      aria-label={en ? "Command range" : "명령 조회 기간"}
    >
      {RANGES.map((r) => {
        const active = value === r.id;
        return (
          <button
            key={r.id}
            type="button"
            disabled={disabled}
            aria-pressed={active}
            onClick={() => onChange(r.id)}
            className={cn(
              "rounded-md border px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-50",
              opsStatus.chipFocus,
              active ? opsStatus.selected : opsStatus.idle,
            )}
          >
            {en ? r.en : r.ko}
          </button>
        );
      })}
    </div>
  );
}
