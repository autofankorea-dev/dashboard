"use client";

import { useProfileSheetPrefs, useSheetCopy } from "@/components/account/profile-sheet-prefs";
import { accountMenuLayout } from "@/lib/ui/account-menu-layout";
import { cn } from "@/lib/utils";

function sampleStall(locale: "ko" | "en") {
  return locale === "en" ? "Finisher" : "비육사";
}

/** 리포트 카드 — 다운로드 전에 일보 첫 장의 칸을 보여 준다. */
export function ReportTemplateExample() {
  const t = useSheetCopy();
  const locale = useProfileSheetPrefs().locale;
  const stall = sampleStall(locale);
  const stats = [
    [t("report.templateBarns"), "4"],
    [t("report.templateLinked"), "17"],
    [t("report.templateAlarms"), "1"],
  ] as const;

  return (
    <figure
      data-tool-example="report"
      className={cn(
        accountMenuLayout.previewReport,
        "overflow-hidden rounded-lg border border-border/60 bg-background",
      )}
    >
      <div className="bg-muted/40 px-2 py-1.5">
        <p className="text-[11px] font-semibold leading-tight">{t("report.templateTitle")}</p>
        <p className="text-[9px] leading-snug text-muted-foreground">
          {t("report.templateDate", { date: "08-19" })} · {t("report.sampleFarm")}
        </p>
      </div>
      <div className="grid grid-cols-3 gap-1 px-2 py-1.5">
        {stats.map(([label, value]) => (
          <div key={label} className="rounded-md border border-border/60 px-1 py-1 text-center">
            <div className="text-[11px] font-semibold tabular-nums leading-none">{value}</div>
            <div className="mt-0.5 text-[8px] leading-none text-muted-foreground">{label}</div>
          </div>
        ))}
      </div>
      <svg
        viewBox="0 0 120 28"
        className="mx-2 h-7 w-[calc(100%-1rem)] text-channel-temp"
        aria-hidden
      >
        <polyline
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          points="0,18 12,16 24,20 36,12 48,10 60,14 72,8 84,11 96,15 108,9 120,13"
        />
        <polyline
          fill="none"
          stroke="currentColor"
          strokeWidth="1.25"
          className="text-channel-info"
          points="0,22 20,20 40,18 60,21 80,16 100,19 120,17"
        />
      </svg>
      <p className="px-2 pb-1 text-[8px] text-muted-foreground">
        {t("report.templateChart")} · {stall}
      </p>
      <div className="space-y-0.5 border-t border-border/60 px-2 py-1 text-[9px] tabular-nums">
        <div className="flex justify-between gap-2">
          <span>01</span>
          <span>24.5°</span>
          <span>61%</span>
        </div>
        <div className="flex justify-between gap-2 text-muted-foreground">
          <span>02</span>
          <span>23.8°</span>
          <span>58%</span>
        </div>
      </div>
      <figcaption className="border-t border-border/60 px-2 py-1 text-[10px] text-muted-foreground">
        {t("tool.example")}
      </figcaption>
    </figure>
  );
}

/** 알람이 없을 때 — 실제 행과 같은 칸의 예시. */
export function AlarmTemplateExample() {
  const t = useSheetCopy();
  const locale = useProfileSheetPrefs().locale;
  return (
    <figure
      data-tool-example="alarm"
      className={cn(
        accountMenuLayout.previewAlarm,
        "rounded-lg border border-border/60 bg-background px-2 py-1.5",
      )}
    >
      <div className="flex items-center justify-between gap-2 text-xs font-semibold">
        <span className="truncate">{t("tool.exampleAlarm")}</span>
        <span className="shrink-0 text-[0.65rem] font-medium text-muted-foreground">
          {t("cover.caution")}
        </span>
      </div>
      <p className="mt-0.5 truncate text-[10px] text-muted-foreground">
        {t("tool.examplePlace", { stall: sampleStall(locale) })}
      </p>
      <figcaption className="mt-1 text-[10px] text-muted-foreground">{t("tool.example")}</figcaption>
    </figure>
  );
}
