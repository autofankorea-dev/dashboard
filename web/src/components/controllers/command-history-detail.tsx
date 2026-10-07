"use client";

import { useState } from "react";
import type { ThermoCommand } from "@/lib/data/commands";
import { commandStatusLabel } from "@/lib/controllers/controller-settings";
import { formatKst } from "@/lib/datetime/kst";
import { formatCommandTarget } from "@/lib/ui/controller-labels";
import { opsControl, opsTypography } from "@/lib/ui/dashboard-page-ui";
import { cn } from "@/lib/utils";

type Props = {
  command: ThermoCommand;
};

/** 명령 단건 상세 — 시트/패널 본문. */
export function CommandHistoryDetail({ command: c }: Props) {
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
    { label: "상태", value: commandStatusLabel(c.status) },
    { label: "생성", value: formatKst(c.createdAt) },
    { label: "전송", value: formatKst(c.sentAt) },
    { label: "적용", value: formatKst(c.appliedAt) },
    { label: "대상", value: formatCommandTarget(c) },
    {
      label: "설정",
      value: c.alarmSettings ? `저온 ${c.alarmSettings.lowTempC}℃ · 고온 ${c.alarmSettings.highTempC}℃${c.channels?.length ? " · " + c.channels.map(ch => `${ch.channel}: ${ch.setpointTemp}℃ +${ch.tempDeviation} · 환기 ${ch.minVentPct}~${ch.maxVentPct}%`).join(" / ") : ""}` : c.channels?.length ? c.channels.map((ch) => `${ch.channel}: ${ch.setpointTemp}℃ +${ch.tempDeviation} · 환기 ${ch.minVentPct}~${ch.maxVentPct}%`).join(" / ") : `환기 ${c.minVentPct}~${c.maxVentPct}% · ${c.setpointTemp}℃ +${c.tempDeviation}`,
    },
  ];
  if (c.note?.trim()) rows.push({ label: "메모", value: c.note.trim() });
  if (c.errorMsg?.trim()) rows.push({ label: "오류", value: c.errorMsg.trim() });

  return (
    <div className="flex flex-col gap-3">
      <dl className="flex flex-col gap-2">
        {rows.map((r) => (
          <div key={r.label} className="grid grid-cols-[4.5rem_1fr] gap-2">
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
          {copied ? "복사됨" : "ID 복사"}
        </button>
      </div>
    </div>
  );
}
