"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { BarnReading } from "@/lib/data/iot";
import type { AlarmSettings } from "@/lib/data/alarms";
import type { ThermoCommand } from "@/lib/data/commands";
import { parseDeviceAlarms } from "@/lib/controllers/device-alarm-command";
import { sendDeviceSettingsCommandsAction } from "@/app/(dashboard)/controllers/actions";
export type AlarmThresholdHeaderState = {
  scopeDescription: string; scopeHasOverride: boolean; scopeReady: boolean; hasChanges: boolean;
  pending: boolean; validationError: string | null; collapsedSummary: string;
  glanceCells: { temp: string; tempDev: string; humidity: string };
  onSave: () => void; onApplyDefaults: () => void; onClear: () => void;
};
type Props = {
  initialSettings: AlarmSettings; readings: BarnReading[];
  fixedScope?: { farmId: string; spCode: string; stallKey: string; readingKey: string } | null;
  embedded?: boolean; density?: string; disabled?: boolean; sliderTitleClassName?: string; sliderAxisClassName?: string;
  onHeaderState?: (state: AlarmThresholdHeaderState | null) => void;
  submitCommands?: typeof sendDeviceSettingsCommandsAction;
  commands?: ThermoCommand[]; onCommandQueued?: (command: ThermoCommand) => void;
};
export function AlarmThresholdForm({ readings, fixedScope, disabled, onHeaderState, commands = [], onCommandQueued, submitCommands = sendDeviceSettingsCommandsAction }: Props) {
  const reading = readings.find(r => r.key === fixedScope?.readingKey);
  const latest = [...commands].sort((a,b) => b.createdAt.localeCompare(a.createdAt) || ({pending:1,sent:2,applied:3,failed:3,cancelled:3}[b.status] - {pending:1,sent:2,applied:3,failed:3,cancelled:3}[a.status])).find(c => c.alarmSettings && c.controllerKey === reading?.controllerKey && c.moduleUid === reading?.moduleUid && c.farmKey.lsindRegistNo === reading?.farmKey.lsindRegistNo && c.farmKey.itemCode === reading?.farmKey.itemCode);
  const awaitingFreshApplied = latest?.status === "applied" && latest.appliedAt && (reading?.receivedAt ?? "") <= latest.appliedAt &&
    (reading?.alarmLowTempC !== latest.alarmSettings?.lowTempC || reading?.alarmHighTempC !== latest.alarmSettings?.highTempC);
  const submitted = latest && (["pending", "sent"].includes(latest.status) || awaitingFreshApplied) ? latest.alarmSettings : undefined;
  const sourceLow = submitted?.lowTempC ?? reading?.alarmLowTempC;
  const sourceHigh = submitted?.highTempC ?? reading?.alarmHighTempC;
  const [source, setSource] = useState(`${sourceLow}:${sourceHigh}`);
  const [low, setLow] = useState(sourceLow == null ? "" : String(sourceLow));
  const [high, setHigh] = useState(sourceHigh == null ? "" : String(sourceHigh));
  const [dirty, setDirty] = useState(false), [pending, setPending] = useState(false), [error, setError] = useState<string | null>(null);
  const failureKey = latest && ["failed", "cancelled"].includes(latest.status) ? latest.id : null;
  const [resetFailure, setResetFailure] = useState<string | null>(null);
  if (failureKey && failureKey !== resetFailure) {
    setResetFailure(failureKey); setDirty(false); setError(null);
    setLow(reading?.alarmLowTempC == null ? "" : String(reading.alarmLowTempC));
    setHigh(reading?.alarmHighTempC == null ? "" : String(reading.alarmHighTempC));
  }
  const signature = `${sourceLow}:${sourceHigh}`;
  if (signature !== source) { setSource(signature); if (!dirty && !pending) { setLow(sourceLow == null ? "" : String(sourceLow)); setHigh(sourceHigh == null ? "" : String(sourceHigh)); } }
  const values = useMemo(() => low.trim() && high.trim() ? parseDeviceAlarms({ lowTempC: Number(low), highTempC: Number(high) }) : null, [low, high]);
  const busy = pending || latest?.status === "pending" || latest?.status === "sent";
  const validationError = values ? null : "0~100℃, 0.1℃ 단위로 저온 < 고온을 입력하세요.";
  const onSave = useCallback(() => {
    if (!reading || reading.status === "offline" || disabled || busy || !values) return;
    setPending(true); setError(null);
    void submitCommands([{ key: reading.key, ...reading.farmKey, moduleUid: reading.moduleUid,
      stallTyCode: reading.stallTyCode ?? "", stallNo: reading.stallNo ?? "", eqpmnNo: reading.eqpmnNo, alarmSettings: values }])
      .then(result => { const cmd = result.sentItems[0]?.command; if (cmd) { setDirty(false); onCommandQueued?.(cmd); } else setError(result.error ?? result.failed[0]?.error ?? "전송 실패"); })
      .catch(() => setError("전송 요청에 실패했습니다. 입력값을 유지합니다."))
      .finally(() => setPending(false));
  }, [reading, disabled, busy, values, onCommandQueued, submitCommands]);
  useEffect(() => {
    const reset = () => { setLow(reading?.alarmLowTempC == null ? "" : String(reading.alarmLowTempC)); setHigh(reading?.alarmHighTempC == null ? "" : String(reading.alarmHighTempC)); setDirty(false); };
    onHeaderState?.({ scopeDescription: "컨트롤러 장비 경보", scopeHasOverride: false, scopeReady: Boolean(reading),
      hasChanges: dirty, pending: busy, validationError,
      collapsedSummary: values ? `저온 ${low}℃ · 고온 ${high}℃` : "경보값 미수신",
      glanceCells: { temp: low || "—", tempDev: high || "—", humidity: "—" }, onSave, onClear: reset, onApplyDefaults: reset });
  }, [onHeaderState, reading, dirty, latest?.status, busy, validationError, low, high, onSave, values]);
  return <div className="space-y-3" data-device-alarm-settings>
    <p className="text-sm text-muted-foreground">컨트롤러 공통 경보 · 장비 수신값</p>
    <p className="text-sm">현재 저온 {reading?.alarmLowTempC ?? "—"}℃ / 고온 {reading?.alarmHighTempC ?? "—"}℃</p>
    <div className="grid grid-cols-2 gap-3">{([["저온 경보", low, setLow], ["고온 경보", high, setHigh]] as const).map(([label, value, setter]) =>
      <label key={label} className="min-w-0 space-y-1 text-sm">{label} (℃)<input aria-label={label} type="number" min={0} max={100} step={0.1} value={value} disabled={disabled || busy}
        onChange={e => { setter(e.target.value); setDirty(true); }} className="h-11 w-full rounded-md border bg-background px-3" /></label>)}</div>
    <p className="text-xs text-muted-foreground">적용 시 장비로 명령을 전송합니다. 새 raw의 일치값 수신 후 반영을 확인합니다.</p>
    {(error || (dirty && validationError)) && <p role="alert" className="text-sm text-destructive">{error ?? validationError}</p>}
    {busy && <p role="status" className="text-sm">{latest?.status === "sent" ? "전송 · 2/3 · 장비 응답 대기" : "접수 · 1/3"}</p>}
    {latest?.status === "applied" && <p role="status" className="text-sm">확인 · 3/3</p>}
    {latest?.status === "failed" && <p role="alert" className="text-sm">명령 적용 실패 · 최신 장비 수신값을 표시합니다.</p>}
  </div>;
}
