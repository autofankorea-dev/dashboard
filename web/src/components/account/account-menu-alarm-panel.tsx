"use client";

import { useCallback, useMemo, useRef, useState, useTransition } from "react";
import { Bell, ChevronDown, ChevronUp } from "lucide-react";
import {
  ackModuleAlarmAction,
  ackModuleAlarmsBulkAction,
  fetchActiveModuleAlarmsAction,
} from "@/app/(dashboard)/farm/actions";
import { Badge } from "@/components/ui/badge";
import { useAppNavigate } from "@/components/layout/use-app-navigate";
import type { AlarmRow } from "@/lib/domain/alarms";
import { alarmChartHref, alarmControlHref, isModuleAlarmRow, isSituationLiveStateRow, situationAlarmMetaLine } from "@/lib/domain/alarms";
import { formatKst } from "@/lib/datetime/kst";
import type { FarmOverview } from "@/lib/data/iot";
import {
  patchShellModuleAlarms,
  publishShellAlarms,
  removeShellAlarm,
  removeShellAlarms,
  useShellAlarms,
} from "@/lib/navigation/shell-live-alarms-store";
import { dashboardUi } from "@/lib/ui/dashboard-page-ui";
import { motionClass } from "@/lib/ui/motion-classes";
import { cn } from "@/lib/utils";

const EXIT_MS = 150;

function connectivityMessage(overview?: FarmOverview): string {
  const registered = overview?.controllerCount;
  if (registered === undefined) {
    return "컨트롤러 연결 정보를 불러올 수 없습니다.";
  }
  const offline = overview?.offlineCount ?? 0;
  const connected =
    overview?.connectedCount ?? Math.max(registered - offline, 0);
  return `${registered}개 중 ${connected}개 연결`;
}

type AlarmPanelListItemProps = {
  alarm: AlarmRow;
  exiting: boolean;
  onNavigate?: () => void;
  onAckStart: (alarm: AlarmRow) => void;
  onAckFinish: (alarm: AlarmRow) => void;
};

function AlarmPanelListItem({
  alarm,
  exiting,
  onNavigate,
  onAckStart,
  onAckFinish,
}: AlarmPanelListItemProps) {
  const { navigate } = useAppNavigate();

  return (
    <li
      className={cn(
        exiting && motionClass.exitFade,
        exiting && "pointer-events-none overflow-hidden",
      )}
      onAnimationEnd={(e) => {
        if (!exiting || e.animationName !== "ui-motion-fade-out") return;
        onAckFinish(alarm);
      }}
    >
      <div className="w-full rounded-xl border border-border/60 bg-muted/20 px-1.5 py-1.5">
        <button
          type="button"
          className={cn(
            "w-full rounded-lg px-0.5 py-0.5 text-left hover:bg-muted/80",
            motionClass.microInteractive,
          )}
          disabled={exiting}
          onClick={() => {
            onNavigate?.();
            navigate(alarmChartHref(alarm), {
              message: isModuleAlarmRow(alarm)
                ? "농장 차트로 이동 중…"
                : "그래프로 이동 중…",
            });
          }}
        >
          <span className="flex items-center justify-between gap-2 text-xs font-medium">
            <span className="truncate">{alarm.alarmType}</span>
            <span className="shrink-0 text-[0.65rem] text-muted-foreground">
              {alarm.severity === "critical" ? "심각" : "주의"}
            </span>
          </span>
          <span className="block truncate text-[0.65rem] text-muted-foreground">
            {situationAlarmMetaLine(alarm)}
          </span>
          {isSituationLiveStateRow(alarm) ? null : (
            <span className="block text-[0.65rem] text-muted-foreground">
              {formatKst(alarm.occurredAt, "short")}
            </span>
          )}
        </button>
        <div className="mt-1 flex justify-end gap-1">
          <button
            type="button"
            disabled={exiting}
            className={cn(
              "shrink-0 rounded-md border border-border/70 bg-background px-2 py-0.5 text-[0.65rem] font-medium text-foreground hover:bg-muted/80 disabled:opacity-60",
              motionClass.microInteractive,
            )}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onNavigate?.();
              const place = [alarm.stallNo, alarm.eqpmnNo].filter(Boolean).join(" ");
              navigate(alarmControlHref(alarm), {
                message: place ? `${place} 패널로 이동 중…` : "패널로 이동 중…",
              });
            }}
          >
            패널로 이동
          </button>
          {isModuleAlarmRow(alarm) ? (
            <button
              type="button"
              disabled={exiting}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onAckStart(alarm);
              }}
              className={cn(
                "shrink-0 rounded-md border border-border/70 bg-background px-2 py-0.5 text-[0.65rem] font-medium text-foreground hover:bg-muted/80 disabled:opacity-60",
                motionClass.microInteractive,
              )}
              aria-label={`${alarm.alarmType} 확인`}
            >
              확인
            </button>
          ) : null}
        </div>
      </div>
    </li>
  );
}

type Props = {
  overview?: FarmOverview;
  alarms?: AlarmRow[];
  onNavigate?: () => void;
  defaultListOpen?: boolean;
  /** 허브 내부 — 좌우 margin 제거 */
  embedded?: boolean;
};

export function AccountMenuAlarmPanel({
  overview,
  alarms = [],
  onNavigate,
  defaultListOpen = true,
  embedded = false,
}: Props) {
  const liveAlarms = useShellAlarms(alarms);
  const activeAlarms = liveAlarms.filter((a) => a.status === "active");
  const moduleAlarms = activeAlarms.filter(isModuleAlarmRow);
  const alarmCount = activeAlarms.length;
  const alarmList = activeAlarms.slice(0, 12);
  const offline = overview?.offlineCount ?? 0;
  const alert = alarmCount > 0 || offline > 0;
  const connTitle = connectivityMessage(overview);
  const [alarmListOpen, setAlarmListOpen] = useState(defaultListOpen);
  const [exitingIds, setExitingIds] = useState<Set<string>>(() => new Set());
  const [bulkPending, startBulkTransition] = useTransition();
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [bulkAckBusy, setBulkAckBusy] = useState(false);
  const bulkAckRef = useRef(false);
  const ackedIdsRef = useRef<Set<string>>(new Set());

  const visibleList = useMemo(() => {
    const byId = new Map<string, AlarmRow>();
    for (const row of activeAlarms) byId.set(row.id, row);
    for (const id of exitingIds) {
      if (!byId.has(id)) {
        const row = liveAlarms.find((a) => a.id === id);
        if (row) byId.set(id, row);
      }
    }
    return [...byId.values()].slice(0, 12);
  }, [activeAlarms, exitingIds, liveAlarms]);

  const syncModuleAlarmsFromServer = useCallback(async (farmKey: AlarmRow["farmKey"]) => {
    try {
      const rows = await fetchActiveModuleAlarmsAction(farmKey);
      patchShellModuleAlarms(rows);
    } catch {
      /* 다음 LIVE 폴링으로 복구 */
    }
  }, []);

  const startExit = useCallback((id: string) => {
    setExitingIds((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, []);

  const finishAck = useCallback(
    async (alarm: AlarmRow) => {
      if (bulkAckRef.current || ackedIdsRef.current.has(alarm.id)) return;
      ackedIdsRef.current.add(alarm.id);
      removeShellAlarm(alarm.id, activeAlarms);
      setExitingIds((prev) => {
        const next = new Set(prev);
        next.delete(alarm.id);
        return next;
      });
      const result = await ackModuleAlarmAction(alarm.id, alarm.farmKey);
      if (result.ok) {
        await syncModuleAlarmsFromServer(alarm.farmKey);
        return;
      }
      ackedIdsRef.current.delete(alarm.id);
      await syncModuleAlarmsFromServer(alarm.farmKey);
    },
    [activeAlarms, syncModuleAlarmsFromServer],
  );

  const onAckStart = useCallback(
    (alarm: AlarmRow) => {
      if (!isModuleAlarmRow(alarm) || bulkAckRef.current) return;
      if (exitingIds.has(alarm.id) || ackedIdsRef.current.has(alarm.id)) return;
      startExit(alarm.id);
    },
    [exitingIds, startExit],
  );

  const onAckFinish = useCallback(
    (alarm: AlarmRow) => {
      if (bulkAckRef.current) return;
      void finishAck(alarm);
    },
    [finishAck],
  );

  const onBulkAck = () => {
    if (bulkPending || bulkAckBusy || moduleAlarms.length === 0 || bulkAckRef.current) return;
    setBulkError(null);
    bulkAckRef.current = true;
    setBulkAckBusy(true);
    const ids = moduleAlarms.map((a) => a.id);
    const farmKey = moduleAlarms[0]!.farmKey;
    setExitingIds(new Set(ids));
    window.setTimeout(() => {
      removeShellAlarms(ids, activeAlarms);
      setExitingIds(new Set());
      for (const id of ids) ackedIdsRef.current.add(id);
      startBulkTransition(async () => {
        try {
          const result = await ackModuleAlarmsBulkAction(ids, farmKey);
          if (!result.ok) {
            setBulkError(result.error);
            for (const id of ids) ackedIdsRef.current.delete(id);
            publishShellAlarms(await fetchActiveModuleAlarmsAction(farmKey));
            return;
          }
          await syncModuleAlarmsFromServer(farmKey);
        } finally {
          bulkAckRef.current = false;
          setBulkAckBusy(false);
        }
      });
    }, EXIT_MS);
  };

  return (
    <div
      className={cn(
        dashboardUi.headerToolsCard,
        embedded ? "mx-0 mb-0 mt-0 w-full" : "mx-4 mb-2 w-[calc(100%-2rem)]",
        alert && dashboardUi.headerToolsCardAlert,
      )}
      data-tour-id="account-menu-alarm-panel"
    >
      <span
        className={cn(
          dashboardUi.headerToolsCardIcon,
          alert && dashboardUi.headerToolsCardIconAlert,
        )}
        aria-hidden
      >
        <Bell className="size-4 md:size-5" />
      </span>
      <div className={dashboardUi.headerToolsCardBody}>
        <div className={dashboardUi.headerToolsCardTitle}>
          <span>이상상황</span>
          {alarmCount > 0 ? (
            <Badge
              variant="destructive"
              className="ml-auto h-5 min-h-0 px-1.5 text-[0.65rem]"
            >
              {alarmCount}건
            </Badge>
          ) : null}
        </div>
        <p
          className={cn(
            dashboardUi.headerToolsCardMeta,
            "truncate",
            offline > 0 && "font-medium text-[var(--status-danger-on-canvas)]",
          )}
        >
          {offline > 0 ? `${connTitle} · 오프라인 ${offline}` : connTitle}
          {alarmCount > 0 ? null : " · 활성 이상상황 없음"}
        </p>
        {alarmCount > 0 ? (
          <div className="mt-1.5 flex gap-1.5">
            <button
              type="button"
              className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-[color:var(--surface-well-border)] bg-[color:var(--surface-well)] px-2 py-1.5 text-xs font-medium text-foreground"
              aria-expanded={alarmListOpen}
              onClick={() => setAlarmListOpen((v) => !v)}
            >
              {alarmListOpen ? (
                <>
                  접기
                  <ChevronUp className="size-3.5 shrink-0" aria-hidden />
                </>
              ) : (
                <>
                  상세 보기
                  <ChevronDown className="size-3.5 shrink-0" aria-hidden />
                </>
              )}
            </button>
            {moduleAlarms.length > 0 ? (
              <button
                type="button"
                disabled={bulkPending || bulkAckBusy}
                onClick={onBulkAck}
                className={cn(
                  "shrink-0 rounded-lg border border-border/70 bg-background px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-muted/80 disabled:opacity-60",
                  motionClass.microInteractive,
                )}
              >
                {bulkPending ? "처리 중…" : "일괄 확인"}
              </button>
            ) : null}
          </div>
        ) : null}
        {bulkError ? (
          <p className="mt-1 text-[0.65rem] text-destructive">{bulkError}</p>
        ) : null}
        {alarmListOpen && visibleList.length > 0 ? (
          <ul
            className={dashboardUi.headerToolsCardList}
            aria-label="이상상황 목록"
          >
            {visibleList.map((a) => (
              <AlarmPanelListItem
                key={a.id}
                alarm={a}
                exiting={exitingIds.has(a.id)}
                onNavigate={onNavigate}
                onAckStart={onAckStart}
                onAckFinish={onAckFinish}
              />
            ))}
            {alarmCount > alarmList.length ? (
              <li className="px-1 py-1 text-[0.65rem] text-muted-foreground">
                외 {alarmCount - alarmList.length}건 — 행을 눌러 차트로 이동합니다
              </li>
            ) : null}
          </ul>
        ) : null}
      </div>
    </div>
  );
}

