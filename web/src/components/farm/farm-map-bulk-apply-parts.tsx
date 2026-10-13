import { deviceAlarmThresholds } from "@/lib/domain/device-alarm-thresholds";
import type { BulkThermoCommand } from "@/app/(dashboard)/controllers/actions";
import type { ControllerGridData } from "@/lib/farm/controller-grid-data";
import {
  resolveThermoSettings,
  type ControllerThermoSettings,
} from "@/lib/controllers/controller-settings";
import { EDIT_START_DRAFT } from "@/lib/controllers/controller-panel-map";
import {
  type AlarmSettings,
  type AlarmThresholds,
} from "@/lib/domain/alarms";
import type { BarnReading } from "@/lib/data/iot";
import { type ChannelSlot } from "@/lib/domain/iot-channel";
import { isReadingOnline } from "@/lib/domain/reading-display";
import { normalizeStallTyCode } from "@/lib/domain/stall-type";
import { resolveReadingChannelThermo } from "@/lib/farm/controller-summary-display";

/** 일괄적용 툴바 버튼 — 카드 본문은 채널·알람 설정 카드와 같은 크기 */
export const bulkModalBtn =
  "inline-flex items-center justify-center rounded-md px-3 py-1.5 text-sm font-medium leading-snug md:px-4 lg:min-h-12 lg:px-5 lg:text-[1.75rem]";

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
  void alarmSettings;
  const sample = targets.find(r => selectedSps.includes(normalizeStallTyCode(r.stallTyCode))) ?? targets[0];
  const t = deviceAlarmThresholds(sample ?? {});
  // Input draft only, not a measured/device default.
  return { tempLow: Number.isFinite(t.tempLow) ? t.tempLow : 0, tempHigh: Number.isFinite(t.tempHigh) ? t.tempHigh : 100, humidityLow: 0, humidityHigh: 100 };
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
