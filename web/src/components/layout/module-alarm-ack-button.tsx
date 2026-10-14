"use client";

import { useState, useTransition } from "react";
import {
  ackModuleAlarmAction,
  fetchActiveModuleAlarmsAction,
} from "@/app/(dashboard)/farm/actions";
import type { AlarmRow } from "@/lib/domain/alarms";
import {
  publishShellAlarms,
  removeShellAlarm,
} from "@/lib/navigation/shell-live-alarms-store";
import { useSheetCopy } from "@/components/account/profile-sheet-prefs";
import { cn } from "@/lib/utils";
import { motionClass } from "@/lib/ui/motion-classes";

type Props = {
  alarm: AlarmRow;
  /** SSR fallback만 있을 때 낙관적 제거용 현재 목록 */
  list?: AlarmRow[];
  className?: string;
};

/**
 * 모듈 경보 「확인」 — status=acked, 셸에서 낙관적 제거.
 * 컨트롤러 명령·업링크 clear와 무관하다.
 */
export function ModuleAlarmAckButton({ alarm, list, className }: Props) {
  const t = useSheetCopy();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const onAck = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (pending) return;
    setError(null);
    removeShellAlarm(alarm.id, list);
    startTransition(async () => {
      const result = await ackModuleAlarmAction(alarm.id, alarm.farmKey);
      if (result.ok) return;
      setError(result.error);
      try {
        const rows = await fetchActiveModuleAlarmsAction(alarm.farmKey);
        publishShellAlarms(rows);
      } catch {
        /* 롤백 실패 시 다음 LIVE 폴링으로 복구 */
      }
    });
  };

  return (
    <span className="inline-flex flex-col items-end gap-0.5">
      <button
        type="button"
        disabled={pending}
        onClick={onAck}
        className={cn(
          "shrink-0 rounded-md border border-border/70 bg-background px-2 py-0.5 text-[0.65rem] font-medium text-foreground hover:bg-muted/80 disabled:opacity-60",
          motionClass.microInteractive,
          className,
        )}
        aria-label={t("account.ackNamed", { type: alarm.alarmType })}
      >
        {pending ? t("account.working") : t("account.ack")}
      </button>
      {error ? (
        <span className="max-w-[10rem] text-right text-[0.6rem] text-destructive">
          {error}
        </span>
      ) : null}
    </span>
  );
}
