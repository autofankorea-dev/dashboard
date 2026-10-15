"use client";

import { useState } from "react";
import type { ThermoCommand } from "@/lib/data/commands";
import { commandStatusLabel } from "@/lib/controllers/controller-settings";
import { formatKst } from "@/lib/datetime/kst";
import { useProfileSheetPrefs, useSheetCopy } from "@/components/account/profile-sheet-prefs";
import { formatCommandSummary, formatCommandTarget } from "@/lib/ui/controller-labels";
import { opsControl, opsTypography } from "@/lib/ui/dashboard-page-ui";
import { cn } from "@/lib/utils";

type Props = {
  command: ThermoCommand;
};

/** 명령 단건 상세 — 시트/패널 본문. */
export function CommandHistoryDetail({ command: c }: Props) {
  const t = useSheetCopy();
  const locale = useProfileSheetPrefs().locale;
  const [copied, setCopied] = useState(false);

  const copyId = async () => {
    try {
      await navigator.clipboard.writeText(c.id);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  const rows: { label: string; value: string }[] = [
    { label: t("cmd.status"), value: commandStatusLabel(c.status, locale) },
    { label: t("cmd.created"), value: formatKst(c.createdAt) },
    { label: t("cmd.sentAt"), value: formatKst(c.sentAt) },
    { label: t("cmd.appliedAt"), value: formatKst(c.appliedAt) },
    { label: t("cmd.target"), value: formatCommandTarget(c) },
    { label: t("cmd.settings"), value: formatCommandSummary(c, locale) },
  ];
  if (c.note?.trim()) rows.push({ label: t("cmd.note"), value: c.note.trim() });
  if (c.errorMsg?.trim()) rows.push({ label: t("cmd.error"), value: c.errorMsg.trim() });

  return (
    <div className="flex flex-col gap-3">
      <dl className="flex flex-col gap-2">
        {rows.map((r) => (
          <div key={r.label} className="grid grid-cols-[6.5rem_1fr] gap-2">
            <dt className={opsTypography.meta}>{r.label}</dt>
            <dd className={cn(opsTypography.body, "break-words")}>{r.value}</dd>
          </div>
        ))}
      </dl>
      <div className="flex flex-wrap items-center gap-2 border-t pt-3">
        <span className={cn("min-w-0 flex-1 truncate font-mono", opsTypography.meta)}>
          {c.id}
        </span>
        <button
          type="button"
          onClick={copyId}
          className={cn(opsControl.buttonOutline, "border shrink-0")}
        >
          {copied ? t("cmd.copied") : t("cmd.copyId")}
        </button>
      </div>
    </div>
  );
}
