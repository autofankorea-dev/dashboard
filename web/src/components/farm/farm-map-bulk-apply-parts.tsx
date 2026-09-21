import type { BulkThermoCommand } from "@/app/(dashboard)/controllers/actions";
import type { ControllerGridData } from "@/lib/farm/controller-grid-data";
import {
  resolveThermoSettings,
  type ControllerThermoSettings,
} from "@/lib/controllers/controller-settings";
import { EDIT_START_DRAFT } from "@/lib/controllers/controller-panel-map";
import {
  buildAlarmScopeKey,
  resolveThresholdsForScope,
} from "@/lib/data/alarm-scope";
import {
  DEFAULT_ALARM_SETTINGS,
  DEFAULT_ALARM_THRESHOLDS,
  type AlarmSettings,
  type AlarmThresholds,
} from "@/lib/data/alarms";
import { farmKeyId } from "@/lib/data/farm-key";
import type { BarnReading } from "@/lib/data/iot";
import { type ChannelSlot } from "@/lib/data/iot-channel";
import { isReadingOnline } from "@/lib/data/reading-display";
import { normalizeStallTyCode } from "@/lib/data/stall-type";
import { resolveReadingChannelThermo } from "@/lib/farm/controller-summary-display";
import { cn } from "@/lib/utils";

/** 일괄설정 모달 — Card 상속 타이포 차단 + 뷰포트별 스케일 */
export const bulkModalShell = cn(
  "flex max-h-[min(88dvh,960px)] w-full min-w-0 max-w-[min(100%,44rem)] flex-col overflow-hidden rounded-xl border bg-background shadow-lg",
  "text-sm leading-snug md:text-base md:leading-snug lg:text-[1.75rem] lg:leading-snug"
);
export const bulkModalSectionTitle = "font-semibold text-foreground";
export const bulkModalMeta = "text-muted-foreground";
export const bulkModalBtn =
  "inline-flex items-center justify-center rounded-md px-3 py-1.5 text-sm font-medium leading-snug md:px-4 lg:min-h-12 lg:px-5 lg:text-[1.75rem]";
export const bulkModalSection = "min-w-0 rounded-lg border bg-background p-3 md:p-5";

export function SectionToggle({
  checked,
  onChange,
  icon,
  label,
  /** 접이식 헤더에 제목이 있을 때 — 체크·적용 여부만 표시 */
  applyOnly = false,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  icon: React.ReactNode;
  label: string;
  applyOnly?: boolean;
}) {
  return (
    <label
      className={cn(
        "flex min-w-0 cursor-pointer flex-wrap items-center gap-x-2.5 gap-y-1",
        !applyOnly && "border-b pb-2.5 md:gap-x-3 md:pb-3",
        applyOnly && "pb-2",
      )}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="size-4 shrink-0 accent-emerald-600 md:size-5"
        aria-label={applyOnly ? `${label} 적용` : undefined}
      />
      {applyOnly ? (
        <span className={cn("min-w-0 flex-1 leading-snug", bulkModalMeta)}>
          {checked ? "이 값으로 적용" : "적용하지 않음"}
        </span>
      ) : (
        <>
          <span className="flex shrink-0 items-center">{icon}</span>
          <span className={cn("min-w-0 flex-1 leading-snug", bulkModalSectionTitle)}>
            {label}
          </span>
          <span className={cn("shrink-0 leading-snug", bulkModalMeta)}>
            {checked ? "적용" : "변경 안 함"}
          </span>
        </>
      )}
    </label>
  );
}

export type BulkChannelThermo = {
  setpoint: number;
  deviation: number;
  minVent: number;
  maxVent: number;
};

export type BulkThermoDraft = {
  applyTemp: boolean;
  applyVent: boolean;
  channelDrafts: Record<ChannelSlot, BulkChannelThermo>;
  /** 채널 컨트롤러에 보낼 슬롯. 레거시(CTRL)는 무시. */
  selectedChannels: ChannelSlot[];
};

export const BULK_CHANNEL_OPTIONS: ChannelSlot[] = ["A", "B", "C"];

export function emptyBulkChannelDrafts(): Record<ChannelSlot, BulkChannelThermo> {
  const one = (): BulkChannelThermo => ({
    setpoint: EDIT_START_DRAFT.setpointTemp,
    deviation: EDIT_START_DRAFT.tempDeviation,
    minVent: EDIT_START_DRAFT.minVentPct,
    maxVent: EDIT_START_DRAFT.maxVentPct,
  });
  return { A: one(), B: one(), C: one() };
}

/** 일괄설정 모달 시드 — 채널별 현재 설정(명령 우선 merge) */
export function bulkThermoDraftSeedByChannel(
  targets: BarnReading[],
  thermoSettings: Record<string, ControllerThermoSettings>,
): Record<ChannelSlot, BulkChannelThermo> {
  const out = emptyBulkChannelDrafts();
  const ordered = [
    ...targets.filter((r) => isReadingOnline(r.status)),
    ...targets.filter((r) => !isReadingOnline(r.status)),
  ];
  for (const slot of BULK_CHANNEL_OPTIONS) {
    for (const r of ordered) {
      const t = resolveReadingChannelThermo(r, thermoSettings, slot);
      if (!t) continue;
      out[slot] = {
        setpoint: t.setpointTemp,
        deviation: t.tempDeviation,
        minVent: t.minVentPct,
        maxVent: t.maxVentPct,
      };
      break;
    }
  }
  return out;
}

export function bulkChannelThermoDirty(
  draft: BulkChannelThermo,
  seed: BulkChannelThermo,
  applyTemp: boolean,
  applyVent: boolean,
): boolean {
  if (applyTemp) {
    if (Math.abs(draft.setpoint - seed.setpoint) > 0.05) return true;
    if (Math.abs(draft.deviation - seed.deviation) > 0.05) return true;
  }
  if (applyVent) {
    if (draft.minVent !== seed.minVent) return true;
    if (draft.maxVent !== seed.maxVent) return true;
  }
  return false;
}

export function bulkDirtyChannelSlots(
  drafts: Record<ChannelSlot, BulkChannelThermo>,
  seeds: Record<ChannelSlot, BulkChannelThermo>,
  applyTemp: boolean,
  applyVent: boolean,
): ChannelSlot[] {
  return BULK_CHANNEL_OPTIONS.filter((slot) =>
    bulkChannelThermoDirty(drafts[slot], seeds[slot], applyTemp, applyVent),
  );
}

/** 값을 바꾼 채널만. 아무 채널도 안 바꿨으면 A·B·C 모두(현재 값 복사). */
export function resolveBulkSendChannels(
  drafts: Record<ChannelSlot, BulkChannelThermo>,
  seeds: Record<ChannelSlot, BulkChannelThermo>,
  applyTemp: boolean,
  applyVent: boolean,
): ChannelSlot[] {
  const dirty = bulkDirtyChannelSlots(drafts, seeds, applyTemp, applyVent);
  return dirty.length > 0 ? dirty : [...BULK_CHANNEL_OPTIONS];
}

/** 선택 SP의 현재 알람 임계값 (첫 SP 기준) */
export function bulkAlarmDraftSeed(
  targets: BarnReading[],
  selectedSps: readonly string[],
  alarmSettings: AlarmSettings | null | undefined,
): AlarmThresholds {
  const settings = alarmSettings ?? DEFAULT_ALARM_SETTINGS;
  const sp = selectedSps[0];
  const sample =
    targets.find(
      (r) => sp != null && normalizeStallTyCode(r.stallTyCode) === sp,
    ) ?? targets[0];
  if (!sample || !sp) return DEFAULT_ALARM_THRESHOLDS;
  return resolveThresholdsForScope(
    settings,
    buildAlarmScopeKey({
      farmId: farmKeyId(sample.farmKey),
      sp: normalizeStallTyCode(sp),
    }),
  );
}

function thermoValuesForReading(
  r: ControllerGridData["readings"][number],
  thermoSettings: ControllerGridData["thermoSettings"],
  draft: BulkThermoDraft,
  channel?: ChannelSlot,
) {
  const slot = channel ?? "A";
  const chDraft = draft.channelDrafts[slot];
  const cur = resolveThermoSettings(
    thermoSettings,
    r.farmKey,
    r.moduleUid,
    r.controllerKey,
    channel,
  );
  return {
    setpointTemp: draft.applyTemp
      ? chDraft.setpoint
      : (cur?.setpointTemp ?? EDIT_START_DRAFT.setpointTemp),
    tempDeviation: draft.applyTemp
      ? chDraft.deviation
      : (cur?.tempDeviation ?? EDIT_START_DRAFT.tempDeviation),
    minVentPct: draft.applyVent
      ? chDraft.minVent
      : (cur?.minVentPct ?? EDIT_START_DRAFT.minVentPct),
    maxVentPct: draft.applyVent
      ? chDraft.maxVent
      : (cur?.maxVentPct ?? EDIT_START_DRAFT.maxVentPct),
  };
}

/**
 * slim LIVE(list)만 있고 channels[]가 비어 있는 현대 컨트롤러.
 * 이 상태에서 벌크 제어하면 SET_CTRL로 잘못 갈 수 있어 full enrich 필요.
 */
export function readingNeedsChannelsHydration(r: BarnReading): boolean {
  if ((r.channels?.length ?? 0) > 0) return false;
  const ck = r.controllerKey ?? "";
  if (ck.startsWith("legacy:")) return false;
  if (r.wireVer != null && r.wireVer >= 0x0a) return true;
  return ck.includes(":");
}

/**
 * 선택된 온라인 컨트롤러별 일괄 제어 명령 구성.
 * - channels[] 있음 → 선택된 활성 채널마다 SET_CHANNEL_THERMO
 * - 없음 → SET_CTRL_THERMO 1건
 * 미적용 항목은 각 대상의 현재 설정값(없으면 편집 시작 기본값)을 유지.
 */
export function buildBulkThermoCommands(
  onlineTargets: ControllerGridData["readings"],
  thermoSettings: ControllerGridData["thermoSettings"],
  draft: BulkThermoDraft
): BulkThermoCommand[] {
  const selected = new Set(draft.selectedChannels);
  const out: BulkThermoCommand[] = [];

  for (const r of onlineTargets) {
    const channels = r.channels ?? [];
    if (channels.length > 0) {
      for (const ch of channels) {
        if (!selected.has(ch.channel)) continue;
        const values = thermoValuesForReading(
          r,
          thermoSettings,
          draft,
          ch.channel,
        );
        out.push({
          key: r.key,
          lsindRegistNo: r.farmKey.lsindRegistNo,
          itemCode: r.farmKey.itemCode,
          moduleUid: r.moduleUid,
          stallTyCode: r.stallTyCode ?? "SP01",
          stallNo: r.stallNo ?? "01",
          eqpmnNo: r.eqpmnNo,
          channel: ch.channel,
          eqpmnCode: ch.eqpmnCode.trim() || null,
          ...values,
        });
      }
      continue;
    }

    const values = thermoValuesForReading(r, thermoSettings, draft);
    out.push({
      key: r.key,
      lsindRegistNo: r.farmKey.lsindRegistNo,
      itemCode: r.farmKey.itemCode,
      moduleUid: r.moduleUid,
      stallTyCode: r.stallTyCode ?? "SP01",
      stallNo: r.stallNo ?? "01",
      eqpmnNo: r.eqpmnNo,
      channel: null,
      eqpmnCode: null,
      ...values,
    });
  }

  return out;
}
