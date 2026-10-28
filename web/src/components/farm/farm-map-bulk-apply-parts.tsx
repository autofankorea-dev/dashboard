import { deviceAlarmThresholds } from "@/lib/domain/device-alarm-thresholds";
import type { BulkThermoCommand } from "@/app/(dashboard)/controllers/actions";
import type { ControllerGridData } from "@/lib/farm/controller-grid-data";
import {
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
import type { CommandPresetChannels } from "@/lib/farm/command-presets";

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
  channelDrafts: Record<ChannelSlot, BulkChannelThermo>;
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

/** 프리셋에 있는 채널만 초안에 덮어쓴다. */
export function bulkDraftsFromPreset(
  drafts: Record<ChannelSlot, BulkChannelThermo>,
  channels: CommandPresetChannels,
): { drafts: Record<ChannelSlot, BulkChannelThermo>; slots: ChannelSlot[] } {
  const next: Record<ChannelSlot, BulkChannelThermo> = {
    A: { ...drafts.A },
    B: { ...drafts.B },
    C: { ...drafts.C },
  };
  const slots: ChannelSlot[] = [];
  for (const slot of BULK_CHANNEL_OPTIONS) {
    const raw = channels[slot];
    if (!raw) continue;
    next[slot] = {
      setpoint: raw.setpointTemp,
      deviation: raw.tempDeviation,
      minVent: raw.minVentPct,
      maxVent: raw.maxVentPct,
    };
    slots.push(slot);
  }
  return { drafts: next, slots };
}

/** 핀으로 고정한 채널과 값이 바뀐 채널. 둘 다 없으면 기존 전송 채널 규칙. */
export function bulkSendSlots(
  drafts: Record<ChannelSlot, BulkChannelThermo>,
  seeds: Record<ChannelSlot, BulkChannelThermo>,
  applyTemp: boolean,
  applyVent: boolean,
  pinned: readonly ChannelSlot[],
): ChannelSlot[] {
  const dirty = bulkDirtyChannelSlots(drafts, seeds, applyTemp, applyVent);
  const chosen = new Set<ChannelSlot>([...pinned, ...dirty]);
  if (chosen.size > 0) {
    return BULK_CHANNEL_OPTIONS.filter((slot) => chosen.has(slot));
  }
  return resolveBulkSendChannels(drafts, seeds, applyTemp, applyVent);
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
  draft: BulkThermoDraft,
  channel?: ChannelSlot,
) {
  const slot = channel ?? "A";
  const chDraft = draft.channelDrafts[slot];
  return {
    setpointTemp: chDraft.setpoint,
    tempDeviation: chDraft.deviation,
    minVentPct: chDraft.minVent,
    maxVentPct: chDraft.maxVent,
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
 * - channels[] 있음 → 모든 활성 채널에 일괄창 확정값 전송
 * - 없음 → SET_CTRL_THERMO 1건
 * 대상별 기존값을 섞거나 변경되지 않은 채널을 제외하지 않는다.
 */
export function buildBulkThermoCommands(
  onlineTargets: ControllerGridData["readings"],
  draft: BulkThermoDraft
): BulkThermoCommand[] {
  const out: BulkThermoCommand[] = [];

  for (const r of onlineTargets) {
    const channels = r.channels ?? [];
    if (channels.length > 0) {
      for (const ch of channels) {
        const values = thermoValuesForReading(
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

    const values = thermoValuesForReading(draft);
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
