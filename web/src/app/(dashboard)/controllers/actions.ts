"use server";

import { parseDeviceAlarms, DEVICE_SETTINGS_ACTION, type DeviceAlarmValues } from "@/lib/controllers/device-alarm-command";
import { COMBINED_CHANNEL_ACTION, parseCommandChannels } from "@/lib/controllers/combined-channel-command";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { canCommand, getCurrentUser } from "@/lib/auth/get-current-user";
import { canEditFarmScope } from "@/lib/auth/farm-access";
import { upsertControllerDisplayName } from "@/lib/data/controller-meta";
import {
  getThermoCommandById,
  mapThermoCommandRow,
  THERMO_COMMAND_SELECT,
  type ThermoCommand,
  type ThermoCommandRow,
} from "@/lib/data/commands";
import { normalizeEqpmnNo } from "@/lib/data/controller-key";
import { revalidateLiveCache } from "@/lib/data/live-cache";
import { farmScopeCacheKey } from "@/lib/data/live-config";
import { MENU_STEPS } from "@/lib/controllers/controller-panel-map";
import { isValidEqpmnCode } from "@/lib/data/eqpmn-code";

export type SendThermoCommandResult =
  | { ok: true; id: string; command: ThermoCommand }
  | { ok: false; error: string };

export async function sendThermoCommandAction(
  formData: FormData
): Promise<SendThermoCommandResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "unauthorized" };
  if (!canCommand(user)) return { ok: false, error: "forbidden" };

  const lsindRegistNo = String(formData.get("lsind_regist_no") ?? "").trim();
  const itemCode = String(formData.get("item_code") ?? "").trim();
  const moduleUid = Number(formData.get("module_uid"));
  const stallTyCode = String(formData.get("stall_ty_code") ?? "").trim();
  const stallNo = String(formData.get("stall_no") ?? "").trim();
  const eqpmnNo = normalizeEqpmnNo(formData.get("eqpmn_no") ?? "01");
  const minVentPct = Number(formData.get("min_vent_pct"));
  const maxVentPct = Number(formData.get("max_vent_pct"));
  const setpointTemp = Number(formData.get("setpoint_temp"));
  const tempDeviation = Number(formData.get("temp_deviation"));
  const note = String(formData.get("note") ?? "").trim() || null;
  const channelRaw = String(formData.get("channel") ?? "").trim().toUpperCase();
  const channel =
    channelRaw === "A" || channelRaw === "B" || channelRaw === "C"
      ? channelRaw
      : null;
  const eqpmnCode = String(formData.get("eqpmn_code") ?? "").trim() || null;
  const action = channel ? "SET_CHANNEL_THERMO" : "SET_CTRL_THERMO";

  if (
    !lsindRegistNo ||
    !itemCode ||
    !Number.isInteger(moduleUid) ||
    !stallTyCode ||
    !/^SP(0[1-9]|10)$/.test(stallTyCode) ||
    !stallNo ||
    !/^(0[1-9]|[12][0-9]|3[0-2])$/.test(stallNo)
  ) {
    return { ok: false, error: "invalid_target" };
  }

  if (
    !canEditFarmScope(user, {
      lsindRegistNo,
      itemCode,
    })
  ) {
    return { ok: false, error: "forbidden" };
  }

  if (
    !Number.isFinite(minVentPct) ||
    !Number.isFinite(maxVentPct) ||
    !Number.isFinite(setpointTemp) ||
    !Number.isFinite(tempDeviation)
  ) {
    return { ok: false, error: "invalid_values" };
  }

  if (
    minVentPct < 0 ||
    minVentPct > 100 ||
    maxVentPct < 0 ||
    maxVentPct > 100 ||
    minVentPct > maxVentPct
  ) {
    return { ok: false, error: "invalid_vent_range" };
  }

  if (
    setpointTemp < MENU_STEPS.setpoint.min ||
    setpointTemp > MENU_STEPS.setpoint.max
  ) {
    return { ok: false, error: "invalid_setpoint" };
  }

  if (tempDeviation < 0 || tempDeviation > 20) {
    return { ok: false, error: "invalid_deviation" };
  }

  if (eqpmnCode && !isValidEqpmnCode(eqpmnCode)) {
    return { ok: false, error: "invalid_eqpmn_code" };
  }

  if (channel) {
    const result = await sendCombinedChannelCommandAction([{ key: `${lsindRegistNo}:${itemCode}:${moduleUid}:${stallTyCode}:${stallNo}:${eqpmnNo}`,
      lsindRegistNo, itemCode, moduleUid, stallTyCode, stallNo, eqpmnNo, channel, eqpmnCode,
      setpointTemp, tempDeviation, minVentPct, maxVentPct }]);
    const item = result.sentItems[0];
    return result.ok && item ? { ok: true, id: item.id, command: item.command } : { ok: false, error: result.error ?? "insert_failed" };
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("ctrl_thermo_command")
    .insert({
      created_by: user.id,
      lsind_regist_no: lsindRegistNo,
      item_code: itemCode,
      module_uid: moduleUid,
      ctrl_idx: Math.max(0, parseInt(eqpmnNo, 10) - 1),
      stall_ty_code: stallTyCode,
      stall_no: stallNo,
      eqpmn_no: eqpmnNo,
      channel,
      eqpmn_code: eqpmnCode,
      min_vent_pct: Math.round(minVentPct),
      max_vent_pct: Math.round(maxVentPct),
      setpoint_temp: setpointTemp,
      temp_deviation: tempDeviation,
      note,
      action,
      status: "pending",
    })
    .select(THERMO_COMMAND_SELECT)
    .single();

  if (error || !data) {
    return { ok: false, error: error?.message ?? "insert_failed" };
  }

  const command = mapThermoCommandRow(data as ThermoCommandRow);

  // LIVE/tag 캐시만 무효화. /farm RSC revalidatePath는 클라이언트
  // patchThermoFromCommand + pipeline 폴링과 겹쳐 패널이 흔들려 생략.
  revalidateLiveCache(farmScopeCacheKey(lsindRegistNo, itemCode));
  return { ok: true, id: command.id, command };
}

/** 적용 배너 폴링 — pending/sent 상태 단건 조회 */
export async function fetchThermoCommandAction(
  id: string
): Promise<ThermoCommand | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  return getThermoCommandById(id);
}

/** 일괄 적용 배너 폴링 — POST /farm N회 → 1회 (RSC 경합 완화) */
export async function fetchThermoCommandsBatchAction(
  ids: string[],
): Promise<(ThermoCommand | null)[]> {
  const user = await getCurrentUser();
  if (!user) return ids.map(() => null);
  const ordered = ids.filter(Boolean);
  if (ordered.length === 0) return [];
  const unique = [...new Set(ordered)];
  const rows = await Promise.all(unique.map((id) => getThermoCommandById(id)));
  const byId = new Map(unique.map((id, i) => [id, rows[i] ?? null]));
  return ordered.map((id) => byId.get(id) ?? null);
}

export type BulkThermoCommand = {
  /** reading key — LIVE thermo 매칭용 (채널 명령도 reading 단위) */
  key: string;
  lsindRegistNo: string;
  itemCode: string;
  moduleUid: number;
  stallTyCode: string;
  stallNo: string;
  eqpmnNo: string;
  minVentPct: number;
  maxVentPct: number;
  setpointTemp: number;
  tempDeviation: number;
  /** 있으면 SET_CHANNEL_THERMO, 없으면 SET_CTRL_THERMO */
  channel?: "A" | "B" | "C" | null;
  eqpmnCode?: string | null;
};

export type BulkSentCommandItem = {
  /** reading key — LIVE thermo 매칭용 */
  key: string;
  id: string;
  command: ThermoCommand;
};

export type SendBulkThermoCommandResult = {
  ok: boolean;
  sent: number;
  failed: { key: string; error: string }[];
  /** insert 성공 건 — ACK/LIVE 추적에 사용 */
  sentItems: BulkSentCommandItem[];
  error?: string;
};

/** 일괄 온도·환기 명령 — 컨트롤러·채널별 값을 담아 N건 insert. */
async function sendLegacyBulkThermoCommandAction(
  commands: BulkThermoCommand[]
): Promise<SendBulkThermoCommandResult> {
  const user = await getCurrentUser();
  if (!user) {
    return { ok: false, sent: 0, failed: [], sentItems: [], error: "unauthorized" };
  }
  if (!canCommand(user)) {
    return { ok: false, sent: 0, failed: [], sentItems: [], error: "forbidden" };
  }
  if (!Array.isArray(commands) || commands.length === 0) {
    return { ok: false, sent: 0, failed: [], sentItems: [], error: "no_targets" };
  }

  const supabase = await createClient();
  const failed: { key: string; error: string }[] = [];
  const sentItems: BulkSentCommandItem[] = [];
  const farmScopes = new Set<string>();

  for (const c of commands) {
    const lsindRegistNo = String(c.lsindRegistNo ?? "").trim();
    const itemCode = String(c.itemCode ?? "").trim();
    const moduleUid = Number(c.moduleUid);
    const stallTyCode = String(c.stallTyCode ?? "").trim();
    const stallNo = String(c.stallNo ?? "").trim();
    const eqpmnNo = normalizeEqpmnNo(c.eqpmnNo ?? "01");
    const minVentPct = Number(c.minVentPct);
    const maxVentPct = Number(c.maxVentPct);
    const setpointTemp = Number(c.setpointTemp);
    const tempDeviation = Number(c.tempDeviation);
    const channelRaw = String(c.channel ?? "").trim().toUpperCase();
    const channel =
      channelRaw === "A" || channelRaw === "B" || channelRaw === "C"
        ? channelRaw
        : null;
    const eqpmnCode = String(c.eqpmnCode ?? "").trim() || null;
    const action = channel ? "SET_CHANNEL_THERMO" : "SET_CTRL_THERMO";
    const failKey = channel ? `${c.key}:${channel}` : c.key;

    if (
      !lsindRegistNo ||
      !itemCode ||
      !Number.isInteger(moduleUid) ||
      !stallTyCode ||
      !/^SP(0[1-9]|10)$/.test(stallTyCode) ||
      !stallNo ||
      !/^(0[1-9]|[12][0-9]|3[0-2])$/.test(stallNo)
    ) {
      failed.push({ key: failKey, error: "invalid_target" });
      continue;
    }

    if (
      !canEditFarmScope(user, {
        lsindRegistNo,
        itemCode,
      })
    ) {
      failed.push({ key: failKey, error: "forbidden" });
      continue;
    }

    if (
      !Number.isFinite(minVentPct) ||
      !Number.isFinite(maxVentPct) ||
      !Number.isFinite(setpointTemp) ||
      !Number.isFinite(tempDeviation) ||
      minVentPct < 0 ||
      minVentPct > 100 ||
      maxVentPct < 0 ||
      maxVentPct > 100 ||
      minVentPct > maxVentPct ||
      setpointTemp < MENU_STEPS.setpoint.min ||
      setpointTemp > MENU_STEPS.setpoint.max ||
      tempDeviation < 0 ||
      tempDeviation > 20
    ) {
      failed.push({ key: failKey, error: "invalid_values" });
      continue;
    }

    if (eqpmnCode && !isValidEqpmnCode(eqpmnCode)) {
      failed.push({ key: failKey, error: "invalid_eqpmn_code" });
      continue;
    }

    const { data, error } = await supabase
      .from("ctrl_thermo_command")
      .insert({
        created_by: user.id,
        lsind_regist_no: lsindRegistNo,
        item_code: itemCode,
        module_uid: moduleUid,
        ctrl_idx: Math.max(0, parseInt(eqpmnNo, 10) - 1),
        stall_ty_code: stallTyCode,
        stall_no: stallNo,
        eqpmn_no: eqpmnNo,
        channel,
        eqpmn_code: eqpmnCode,
        min_vent_pct: Math.round(minVentPct),
        max_vent_pct: Math.round(maxVentPct),
        setpoint_temp: setpointTemp,
        temp_deviation: tempDeviation,
        note: null,
        action,
        status: "pending",
      })
      .select(THERMO_COMMAND_SELECT)
      .single();

    if (error || !data) {
      failed.push({ key: failKey, error: error?.message ?? "insert_failed" });
    } else {
      const command = mapThermoCommandRow(data as ThermoCommandRow);
      sentItems.push({ key: c.key, id: command.id, command });
      farmScopes.add(farmScopeCacheKey(lsindRegistNo, itemCode));
    }
  }

  for (const scope of farmScopes) revalidateLiveCache(scope);

  return {
    ok: failed.length === 0,
    sent: sentItems.length,
    failed,
    sentItems,
  };
}


/** One controller, one row, one MQTT packet. Individual values live in payload_json. */
export async function sendCombinedChannelCommandAction(commands: BulkThermoCommand[]): Promise<SendBulkThermoCommandResult> {
  const user = await getCurrentUser();
  const reject = (error: string): SendBulkThermoCommandResult => ({ ok: false, sent: 0, failed: (Array.isArray(commands) ? commands : []).map((c) => ({ key: c?.key ?? "", error })), sentItems: [], error });
  if (!user) return reject("unauthorized");
  if (!canCommand(user)) return reject("forbidden");
  if (!Array.isArray(commands) || !commands.length || commands.length > 3) return reject("invalid_values");
  const first = commands[0]!;
  const address = (c: BulkThermoCommand) => JSON.stringify([c.lsindRegistNo, c.itemCode, c.moduleUid, c.stallTyCode, c.stallNo, c.eqpmnNo, c.key]);
  if (commands.some((c) => address(c) !== address(first))) return reject("invalid_target");
  const channels = parseCommandChannels(commands.map((c) => ({ channel: c.channel, eqpmnCode: c.eqpmnCode,
    setpointTemp: c.setpointTemp, tempDeviation: c.tempDeviation, minVentPct: c.minVentPct, maxVentPct: c.maxVentPct })));
  if (!channels) return reject("invalid_values");
  const { lsindRegistNo, itemCode, moduleUid, stallTyCode, stallNo } = first;
  const eqpmnNo = normalizeEqpmnNo(first.eqpmnNo);
  if (!lsindRegistNo || !itemCode || !Number.isInteger(moduleUid) || moduleUid < 1 ||
      !/^SP(0[1-9]|10)$/.test(stallTyCode) || !/^(0[1-9]|[12][0-9]|3[0-2])$/.test(stallNo) ||
      !/^(0[1-9]|10)$/.test(eqpmnNo)) return reject("invalid_target");
  if (!canEditFarmScope(user, { lsindRegistNo, itemCode })) return reject("forbidden");
  const values = channels[0]!;
  const supabase = await createClient();
  const { data, error } = await supabase.from("ctrl_thermo_command").insert({
    created_by: user.id, lsind_regist_no: lsindRegistNo, item_code: itemCode, module_uid: moduleUid,
    ctrl_idx: Number(eqpmnNo) - 1, stall_ty_code: stallTyCode, stall_no: stallNo, eqpmn_no: eqpmnNo,
    channel: null, eqpmn_code: null, action: COMBINED_CHANNEL_ACTION, status: "pending",
    setpoint_temp: values.setpointTemp, temp_deviation: values.tempDeviation,
    min_vent_pct: values.minVentPct, max_vent_pct: values.maxVentPct,
    payload_json: { command_channels: channels }, note: null,
  }).select(THERMO_COMMAND_SELECT).single();
  if (error || !data) return reject(error?.message ?? "insert_failed");
  const command = mapThermoCommandRow(data as ThermoCommandRow);
  revalidateLiveCache(farmScopeCacheKey(lsindRegistNo, itemCode));
  return { ok: true, sent: 1, failed: [], sentItems: [{ key: first.key, id: command.id, command }] };
}

/** Group channel commands per controller. Never split a group into separate MQTT publications. */
export async function sendBulkThermoCommandAction(commands: BulkThermoCommand[]): Promise<SendBulkThermoCommandResult> {
  if (!Array.isArray(commands) || !commands.length || commands.length > 300) return { ok: false, sent: 0, failed: [], sentItems: [], error: "no_targets" };
  const groups = new Map<string, BulkThermoCommand[]>();
  const legacy: BulkThermoCommand[] = [];
  for (const c of commands) {
    if (!c || typeof c !== "object") return { ok: false, sent: 0, failed: [], sentItems: [], error: "invalid_values" };
    if (!c.channel) { legacy.push(c); continue; }
    const key = JSON.stringify([c.lsindRegistNo, c.itemCode, c.moduleUid, c.stallTyCode, c.stallNo, c.eqpmnNo, c.key]);
    groups.set(key, [...(groups.get(key) ?? []), c]);
  }
  const results: SendBulkThermoCommandResult[] = [];
  for (const group of groups.values()) results.push(await sendCombinedChannelCommandAction(group));
  if (legacy.length) results.push(await sendLegacyBulkThermoCommandAction(legacy));
  return { ok: results.every((r) => r.ok), sent: results.reduce((n, r) => n + r.sent, 0),
    failed: results.flatMap((r) => r.failed), sentItems: results.flatMap((r) => r.sentItems) };
}

export async function saveControllerDisplayNameAction(
  controllerKey: string,
  eqpmnNo: string,
  displayName: string
): Promise<{ ok: boolean; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "unauthorized" };
  if (!canCommand(user)) return { ok: false, error: "forbidden" };

  if (!controllerKey.trim()) {
    return { ok: false, error: "invalid_controller_key" };
  }

  const trimmed = displayName.trim();
  if (trimmed.length > 32) {
    return { ok: false, error: "name_too_long" };
  }

  const result = await upsertControllerDisplayName(
    controllerKey,
    eqpmnNo,
    trimmed
  );
  if (!result.ok) return result;

  revalidatePath("/farm");
  revalidatePath("/controllers");
  revalidatePath("/farm");
  revalidatePath("/alarms");
  return { ok: true };
}

export type DeviceSettingsTarget = {
  key: string; lsindRegistNo: string; itemCode: string; moduleUid: number;
  stallTyCode: string; stallNo: string; eqpmnNo: string;
  alarmSettings: DeviceAlarmValues;
  channels?: import("@/lib/controllers/combined-channel-command").CommandChannelValues[];
};
/** RLS-scoped command, never a profile write. One controller → one packet. */
export async function sendDeviceSettingsCommandsAction(targets: DeviceSettingsTarget[]): Promise<SendBulkThermoCommandResult> {
  const empty = (error: string): SendBulkThermoCommandResult => ({ ok: false, error, sent: 0, failed: [], sentItems: [] });
  const user = await getCurrentUser();
  if (!user) return empty("unauthorized");
  if (!canCommand(user)) return empty("forbidden");
  if (!Array.isArray(targets) || !targets.length || targets.length > 100) return empty("invalid_targets");
  const supabase = await createClient();
  const failed: SendBulkThermoCommandResult["failed"] = [], sentItems: BulkSentCommandItem[] = [];
  for (const t of targets) {
    const alarmSettings = parseDeviceAlarms(t?.alarmSettings);
    const channels = t?.channels?.length ? parseCommandChannels(t.channels) : [];
    if (!t || !alarmSettings || !channels || !t.key || !t.lsindRegistNo || !t.itemCode ||
        !Number.isInteger(t.moduleUid) || t.moduleUid < 1 ||
        !/^SP(0[1-9]|10)$/.test(t.stallTyCode) || !/^(0[1-9]|[12][0-9]|3[0-2])$/.test(t.stallNo) ||
        !/^(0[1-9]|10)$/.test(t.eqpmnNo)) { failed.push({ key: t?.key ?? "", error: "invalid_values" }); continue; }
    if (!canEditFarmScope(user, t)) { failed.push({ key: t.key, error: "forbidden" }); continue; }
    // Legacy NOT NULL columns are compatibility storage, excluded by the channel mask.
    const values = channels[0] ?? { setpointTemp: 25, tempDeviation: 2, minVentPct: 0, maxVentPct: 100 };
    const { data, error } = await supabase.from("ctrl_thermo_command").insert({
      created_by: user.id, lsind_regist_no: t.lsindRegistNo, item_code: t.itemCode, module_uid: t.moduleUid,
      ctrl_idx: Number(t.eqpmnNo) - 1, stall_ty_code: t.stallTyCode, stall_no: t.stallNo, eqpmn_no: t.eqpmnNo,
      channel: null, eqpmn_code: null, action: DEVICE_SETTINGS_ACTION, status: "pending",
      setpoint_temp: values.setpointTemp, temp_deviation: values.tempDeviation, min_vent_pct: values.minVentPct, max_vent_pct: values.maxVentPct,
      payload_json: { command_channels: channels, alarm_settings: alarmSettings }, note: null,
    }).select(THERMO_COMMAND_SELECT).single();
    if (error || !data) { failed.push({ key: t.key, error: error?.message ?? "insert_failed" }); continue; }
    const command = mapThermoCommandRow(data as ThermoCommandRow);
    sentItems.push({ key: t.key, id: command.id, command });
    revalidateLiveCache(farmScopeCacheKey(t.lsindRegistNo, t.itemCode));
  }
  return { ok: failed.length === 0, sent: sentItems.length, failed, sentItems };
}
