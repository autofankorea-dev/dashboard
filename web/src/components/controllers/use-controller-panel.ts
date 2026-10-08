"use client";

import { commandChannelViews } from "@/lib/controllers/combined-channel-command";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  sendBulkThermoCommandAction,
  sendThermoCommandAction,
  type BulkSentCommandItem,
  type BulkThermoCommand,
} from "@/app/(dashboard)/controllers/actions";
import type { ControllerReading } from "@/lib/data/iot";
import {
  clampMenuValue,
  EDIT_START_DRAFT,
  MENU_STEPS,
  type PanelMenuId,
} from "@/lib/controllers/controller-panel-map";
import {
  buildChannelGlanceRows,
  collectDirtyChannelSaves,
  mergeDirtyChannelSaves,
  panelChannelKey,
  displayThermoForChannel,
  syncPanelChannelDrafts,
  panelCommandFailed,
  type ChannelGlanceRow,
  type DirtyChannelSave,
  type PanelChannelContext,
  type PanelDraft,
  type PanelThermoValues,
} from "@/lib/controllers/controller-panel-draft";
import {
  thermoValuesMatch,
  type ControllerThermoSettings,
} from "@/lib/controllers/controller-settings";
import {
  CHANNEL_SLOT_LABELS,
  type ChannelSlot,
} from "@/lib/data/iot-channel";
import { formatUserError } from "@/lib/ui/controller-labels";
import {
  clampCommandPresetDraft,
  type CommandPresetChannels,
} from "@/lib/farm/command-presets";

export type { ChannelGlanceRow, PanelDraft, PanelChannelContext };

type ThermoValues = PanelThermoValues;

function draftFromSettings(s: ControllerThermoSettings): PanelDraft {
  return {
    setpointTemp: s.setpointTemp,
    tempDeviation: s.tempDeviation,
    minVentPct: s.minVentPct,
    maxVentPct: s.maxVentPct,
  };
}

function patchKeyMap<T>(
  map: Record<string, T>,
  key: string,
  value: T,
): Record<string, T> {
  if (map[key] === value) return map;
  return { ...map, [key]: value };
}

function getDraftField(draft: PanelDraft, menu: PanelMenuId): number {
  switch (menu) {
    case "setpoint":
      return draft.setpointTemp;
    case "deviation":
      return draft.tempDeviation;
    case "minVent":
      return draft.minVentPct;
    case "maxVent":
      return draft.maxVentPct;
  }
}

function setDraftField(
  draft: PanelDraft,
  menu: PanelMenuId,
  value: number,
): PanelDraft {
  switch (menu) {
    case "setpoint":
      return { ...draft, setpointTemp: value };
    case "deviation":
      return { ...draft, tempDeviation: value };
    case "minVent":
      return { ...draft, minVentPct: value };
    case "maxVent":
      return { ...draft, maxVentPct: value };
  }
}

function draftsEqual(a: PanelDraft | null, b: PanelDraft | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    a.setpointTemp === b.setpointTemp &&
    a.tempDeviation === b.tempDeviation &&
    a.minVentPct === b.minVentPct &&
    a.maxVentPct === b.maxVentPct
  );
}

function settingsSyncKey(s: ControllerThermoSettings | null): string {
  if (!s) return "";
  return [
    s.setpointTemp,
    s.tempDeviation,
    s.minVentPct,
    s.maxVentPct,
    s.source ?? "",
  ].join(":");
}

function panelDraftOrNull(
  draft: PanelDraft | null,
  knownSettings: ControllerThermoSettings | null,
): PanelDraft | null {
  if (draft) return draft;
  return knownSettings ? draftFromSettings(knownSettings) : null;
}

function panelDraftOrDefault(
  draft: PanelDraft | null,
  knownSettings: ControllerThermoSettings | null,
  editStart: PanelDraft = EDIT_START_DRAFT,
): PanelDraft {
  return panelDraftOrNull(draft, knownSettings) ?? editStart;
}

function panelDraftToFields(d: PanelDraft): Record<PanelMenuId, number> {
  return {
    setpoint: d.setpointTemp,
    deviation: d.tempDeviation,
    minVent: d.minVentPct,
    maxVent: d.maxVentPct,
  };
}

function fieldsToThermo(
  f: Record<PanelMenuId, number>,
): ThermoValues {
  return {
    setpointTemp: f.setpoint,
    tempDeviation: f.deviation,
    minVentPct: f.minVent,
    maxVentPct: f.maxVent,
  };
}

function thermoToFields(t: ThermoValues): Record<PanelMenuId, number> {
  return {
    setpoint: t.setpointTemp,
    deviation: t.tempDeviation,
    minVent: t.minVentPct,
    maxVent: t.maxVentPct,
  };
}

export function useControllerPanel(
  target: ControllerReading | undefined,
  providedSettings: ControllerThermoSettings | null,
  canCommand: boolean,
  activeChannel?: ChannelSlot,
  channelEqpmnCode?: string,
  onCommandRegistered?: (command: import("@/lib/data/commands").ThermoCommand) => void,
  /** LIVE 디코드 설정 — dirty/「현재」표시 기준 (낙관 knownSettings와 분리) */
  liveBaseline?: ThermoValues | null,
  channelContexts?: PanelChannelContext[],
  onBulkCommandsRegistered?: (items: BulkSentCommandItem[]) => void,
  latestCommand?: import("@/lib/data/commands").ThermoCommand | null,
  /** 운영 공용 기본값 — 없으면 EDIT_START_DRAFT */
  editStartDraft?: PanelDraft | null,
) {
  const editStart = editStartDraft ?? EDIT_START_DRAFT;
  const editStartRef = useRef(editStart);
  editStartRef.current = editStart;
  const knownSettings = useMemo(() => panelCommandFailed(latestCommand)
    ? liveBaseline ? { ...liveBaseline, source: "live" as const, updatedAt: target?.receivedAt ?? "" } : null
    : providedSettings, [latestCommand, liveBaseline, target?.receivedAt, providedSettings]);
  const [resetFailures, setResetFailures] = useState<string[]>([]);
  const [pending, setPending] = useState(false);
  const [activeMenu, setActiveMenu] = useState<PanelMenuId>("setpoint");
  const [draftByKey, setDraftByKey] = useState<Record<string, PanelDraft | null>>(
    {},
  );
  const [editedByKey, setEditedByKey] = useState<Record<string, boolean>>({});
  /** Apply 성공 직후 dirty 기준 — LIVE 반영 전 동일값 재전송 방지 */
  const [saveBaselineByKey, setSaveBaselineByKey] = useState<
    Record<string, PanelDraft | null>
  >({});
  const [message, setMessage] = useState<{
    tone: "ok" | "error";
    text: string;
  } | null>(null);

  const settingsKnown = knownSettings != null;
  const targetKey = target?.key;
  const channelKey = panelChannelKey(activeChannel);
  const settingsKey = settingsSyncKey(knownSettings);
  const channelSyncKey = (channelContexts ?? [])
    .map((ctx) => {
      const t = ctx.liveBaseline ?? ctx.knownSettings;
      return [
        ctx.slot,
        t?.setpointTemp ?? "",
        t?.tempDeviation ?? "",
        t?.minVentPct ?? "",
        t?.maxVentPct ?? "",
      ].join(":");
    })
    .join("|");
  const controllerIdentity = targetKey ?? "";
  const [prevControllerIdentity, setPrevControllerIdentity] =
    useState(controllerIdentity);

  const draft = draftByKey[channelKey] ?? null;
  const hasEdited = Boolean(editedByKey[channelKey]);
  const saveBaseline = saveBaselineByKey[channelKey] ?? null;
  const anyEdited = Object.values(editedByKey).some(Boolean);

  const hasEditedRef = useRef(hasEdited);
  const knownSettingsRef = useRef(knownSettings);
  const channelKeyRef = useRef(channelKey);
  const editedByKeyRef = useRef(editedByKey);
  const draftByKeyRef = useRef(draftByKey);
  const saveBaselineByKeyRef = useRef(saveBaselineByKey);
  const channelContextsRef = useRef(channelContexts);
  useEffect(() => {
    hasEditedRef.current = hasEdited;
  });
  useEffect(() => {
    knownSettingsRef.current = knownSettings;
  });
  useEffect(() => {
    channelKeyRef.current = channelKey;
  });
  useEffect(() => {
    editedByKeyRef.current = editedByKey;
  });
  useEffect(() => {
    draftByKeyRef.current = draftByKey;
  });
  useEffect(() => {
    saveBaselineByKeyRef.current = saveBaselineByKey;
  });
  useEffect(() => {
    channelContextsRef.current = channelContexts;
  });

  /** 컨트롤러가 바뀔 때만 초안 초기화 — 채널 탭 전환은 A/B/C 입력을 유지 */
  if (controllerIdentity !== prevControllerIdentity) {
    setPrevControllerIdentity(controllerIdentity);
    setDraftByKey({});
    setEditedByKey({});
    setSaveBaselineByKey({});
    setResetFailures([]);
    setMessage(null);
  }

  // Reset each failed command once. Later user edits remain editable for a new command.
  const failures = channelContexts?.length
    ? channelContexts.filter(ctx => panelCommandFailed(ctx.command)).map(ctx => ({
      key: ctx.slot, id: `${controllerIdentity}:${ctx.slot}:${ctx.command!.id}`, live: ctx.liveBaseline,
    }))
    : panelCommandFailed(latestCommand) ? [{ key: channelKey, id: `${controllerIdentity}:${channelKey}:${latestCommand!.id}`, live: liveBaseline ?? null }] : [];
  const newFailures = failures.filter(row => !resetFailures.includes(row.id));
  if (newFailures.length) {
    setResetFailures(prev => [...prev, ...newFailures.map(row => row.id)]);
    setDraftByKey(prev => ({ ...prev, ...Object.fromEntries(newFailures.map(row => [row.key, row.live])) }));
    setEditedByKey(prev => ({ ...prev, ...Object.fromEntries(newFailures.map(row => [row.key, false])) }));
    setSaveBaselineByKey(prev => ({ ...prev, ...Object.fromEntries(newFailures.map(row => [row.key, null])) }));
  }

  // Release every channel's snapshot, including inactive tabs and failed commands.
  const releasedKeys = channelContexts?.length
    ? channelContexts.filter((ctx) => saveBaselineByKey[ctx.slot] &&
        (panelCommandFailed(ctx.command) || (ctx.liveBaseline &&
          thermoValuesMatch(saveBaselineByKey[ctx.slot]!, ctx.liveBaseline))))
        .map((ctx) => ctx.slot)
    : saveBaseline && (panelCommandFailed(latestCommand) ||
        (liveBaseline && thermoValuesMatch(saveBaseline, liveBaseline))) ? [channelKey] : [];
  if (releasedKeys.length) {
    setSaveBaselineByKey((prev) => {
      const next = { ...prev };
      for (const key of releasedKeys) next[key] = null;
      return next;
    });
  }

  /**
   * 폴링·LIVE 갱신 시: 해당 채널 초안이 LIVE와 다르면 유지.
   * B·C는 컨트롤러 공통 설정이 아니라 그 채널 LIVE로만 맞춘다.
   */
  useEffect(() => {
    if (!targetKey) return;
    setDraftByKey((prev) => {
      if (channelContexts && channelContexts.length > 0) {
        return syncPanelChannelDrafts(channelContexts, prev, editedByKeyRef.current, saveBaselineByKeyRef.current);
      }
      const key = channelKeyRef.current;
      const s = displayThermoForChannel(knownSettingsRef.current, liveBaseline ?? null,
        saveBaselineByKeyRef.current[key], latestCommand);
      if (!s) {
        if (hasEditedRef.current) return prev;
        return patchKeyMap(prev, key, null);
      }
      const synced = { ...s };
      if (hasEditedRef.current && prev[key]) return prev;
      const cur = prev[key] ?? null;
      return draftsEqual(cur, synced) ? prev : patchKeyMap(prev, key, synced);
    });
  }, [settingsKey, targetKey, channelKey, channelSyncKey, channelContexts, liveBaseline, latestCommand]);

  const markActiveEdited = useCallback(() => {
    setEditedByKey((prev) => patchKeyMap(prev, channelKey, true));
  }, [channelKey]);

  const ensureDraft = useCallback((): PanelDraft => {
    if (draft) return draft;
    const start = panelDraftOrDefault(draft, knownSettings, editStartRef.current);
    setDraftByKey((prev) => patchKeyMap(prev, channelKey, start));
    markActiveEdited();
    return start;
  }, [channelKey, draft, knownSettings, markActiveEdited]);

  const resolveDraftBase = useCallback(
    (): PanelDraft =>
      panelDraftOrDefault(draft, knownSettings, editStartRef.current),
    [draft, knownSettings],
  );

  const setField = useCallback(
    (menu: PanelMenuId, raw: number) => {
      const clamped = clampMenuValue(menu, raw);
      setDraftByKey((prev) => {
        const base = prev[channelKey] ?? resolveDraftBase();
        return patchKeyMap(prev, channelKey, setDraftField(base, menu, clamped));
      });
      markActiveEdited();
    },
    [channelKey, markActiveEdited, resolveDraftBase],
  );

  const setTempControl = useCallback(
    (setpointTemp: number, tempDeviation: number) => {
      setDraftByKey((prev) => {
        const base = prev[channelKey] ?? resolveDraftBase();
        return patchKeyMap(prev, channelKey, {
          ...base,
          setpointTemp: clampMenuValue("setpoint", setpointTemp),
          tempDeviation: clampMenuValue("deviation", tempDeviation),
        });
      });
      markActiveEdited();
    },
    [channelKey, markActiveEdited, resolveDraftBase],
  );

  const setVentRange = useCallback(
    (minVentPct: number, maxVentPct: number) => {
      setDraftByKey((prev) => {
        const base = prev[channelKey] ?? resolveDraftBase();
        let min = clampMenuValue("minVent", minVentPct);
        let max = clampMenuValue("maxVent", maxVentPct);
        if (min > max) [min, max] = [max, min];
        return patchKeyMap(prev, channelKey, {
          ...base,
          minVentPct: min,
          maxVentPct: max,
        });
      });
      markActiveEdited();
    },
    [channelKey, markActiveEdited, resolveDraftBase],
  );

  const adjust = useCallback(
    (direction: 1 | -1, menu?: PanelMenuId) => {
      const targetMenu = menu ?? activeMenu;
      const cfg = MENU_STEPS[targetMenu];
      const base = ensureDraft();
      const current = getDraftField(base, targetMenu);
      const next = clampMenuValue(
        targetMenu,
        current + direction * cfg.step,
      );
      setDraftByKey((prev) =>
        patchKeyMap(
          prev,
          channelKey,
          setDraftField(prev[channelKey] ?? base, targetMenu, next),
        ),
      );
      markActiveEdited();
    },
    [activeMenu, channelKey, ensureDraft, markActiveEdited],
  );

  const applyDefaults = useCallback(() => {
    setDraftByKey((prev) =>
      patchKeyMap(prev, channelKey, { ...editStartRef.current }),
    );
    markActiveEdited();
    setMessage(null);
  }, [channelKey, markActiveEdited]);

  const applyChannelDrafts = useCallback((channels: CommandPresetChannels) => {
    const contexts = channelContextsRef.current;
    if (contexts && contexts.length > 0) {
      setDraftByKey((prev) => {
        let next = prev;
        for (const ctx of contexts) {
          const raw = channels[ctx.slot];
          if (!raw) continue;
          next = patchKeyMap(next, ctx.slot, clampCommandPresetDraft(raw));
        }
        return next;
      });
      setEditedByKey((prev) => {
        let next = prev;
        for (const ctx of contexts) {
          if (!channels[ctx.slot]) continue;
          next = patchKeyMap(next, ctx.slot, true);
        }
        return next;
      });
    } else {
      const raw = channels.A ?? channels.B ?? channels.C;
      if (!raw) return;
      const key = channelKeyRef.current;
      setDraftByKey((prev) =>
        patchKeyMap(prev, key, clampCommandPresetDraft(raw)),
      );
      setEditedByKey((prev) => patchKeyMap(prev, key, true));
    }
    setMessage(null);
  }, []);

  const NETWORK_ERROR_TEXT =
    "네트워크 오류입니다. 연결을 확인한 뒤 다시 시도하세요.";
  const SAVE_TIMEOUT_MS = 20_000;

  const runSaveRequest = useCallback(
    async (work: () => Promise<void>) => {
      setPending(true);
      let timer: number | undefined;
      try {
        if (typeof navigator !== "undefined" && navigator.onLine === false) {
          setMessage({ tone: "error", text: NETWORK_ERROR_TEXT });
          return;
        }
        await Promise.race([
          work(),
          new Promise<never>((_, reject) => {
            timer = window.setTimeout(
              () => reject(new Error("network_timeout")),
              SAVE_TIMEOUT_MS,
            );
          }),
        ]);
      } catch (err) {
        const raw = err instanceof Error ? err.message : String(err ?? "");
        const networkLike =
          /network_timeout|Failed to fetch|NetworkError|Load failed|fetch/i.test(
            raw,
          ) ||
          (typeof navigator !== "undefined" && navigator.onLine === false);
        setMessage({
          tone: "error",
          text: networkLike ? NETWORK_ERROR_TEXT : formatUserError(raw || "unknown"),
        });
      } finally {
        if (timer != null) window.clearTimeout(timer);
        setPending(false);
      }
    },
    [],
  );

  const markSavesCommitted = useCallback(
    (keys: string[], valuesByKey: Record<string, PanelDraft>) => {
      setSaveBaselineByKey((prev) => {
        const next = { ...prev };
        for (const key of keys) {
          const values = valuesByKey[key];
          if (values) next[key] = { ...values };
        }
        return next;
      });
      setEditedByKey((prev) => {
        const next = { ...prev };
        for (const key of keys) next[key] = false;
        return next;
      });
    },
    [],
  );

  const save = useCallback((queued?: DirtyChannelSave[]) => {
    if (pending) return;
    if (!target) {
      setMessage({ tone: "error", text: "대상 컨트롤러를 선택하세요." });
      return;
    }
    if (!canCommand) {
      setMessage({ tone: "error", text: "명령 권한이 없습니다." });
      return;
    }

    const contexts = channelContextsRef.current;
    const multi =
      contexts &&
      contexts.length > 0 &&
      Boolean(activeChannel);
    const latest = multi
      ? collectDirtyChannelSaves(
          contexts,
          draftByKeyRef.current,
          saveBaselineByKeyRef.current,
        )
      : [];
    const dirtySaves = multi
      ? mergeDirtyChannelSaves(queued ?? [], latest)
      : [];

    if (multi) {
      if (dirtySaves.length === 0) {
        setMessage({
          tone: "error",
          text: "설정값을 올림·내림으로 입력한 뒤 저장하세요.",
        });
        return;
      }
      if (dirtySaves.some((row) => row.values.minVentPct > row.values.maxVentPct)) {
        setMessage({
          tone: "error",
          text: "최저 환기는 최고 환기 이하여야 합니다.",
        });
        return;
      }
      const commands: BulkThermoCommand[] = dirtySaves.map((row) => ({
        key: target.key,
        lsindRegistNo: target.farmKey.lsindRegistNo,
        itemCode: target.farmKey.itemCode,
        moduleUid: target.moduleUid,
        stallTyCode: target.stallTyCode ?? "SP01",
        stallNo: target.stallNo ?? "01",
        eqpmnNo: target.eqpmnNo,
        minVentPct: row.values.minVentPct,
        maxVentPct: row.values.maxVentPct,
        setpointTemp: row.values.setpointTemp,
        tempDeviation: row.values.tempDeviation,
        channel: row.slot,
        eqpmnCode: row.eqpmnCode,
      }));
      setMessage(null);
      void runSaveRequest(async () => {
        const result = await sendBulkThermoCommandAction(commands);
        if (result.sentItems.length > 0) {
          setMessage(null);
          if (onBulkCommandsRegistered) {
            onBulkCommandsRegistered(result.sentItems);
          } else {
            for (const item of result.sentItems) {
              onCommandRegistered?.(item.command);
            }
          }
          const valuesByKey: Record<string, PanelDraft> = {};
          const keys: string[] = [];
          for (const item of result.sentItems.flatMap((item) => commandChannelViews(item.command).map((command) => ({ ...item, command })))) {
            const slot = item.command.channel;
            if (!slot) continue;
            const row = dirtySaves.find((d) => d.slot === slot);
            if (!row) continue;
            keys.push(slot);
            valuesByKey[slot] = row.values;
          }
          markSavesCommitted(keys, valuesByKey);
        }
        if (!result.ok && result.sentItems.length === 0) {
          setMessage({
            tone: "error",
            text: formatUserError(result.error ?? result.failed[0]?.error ?? "unknown"),
          });
        } else if (!result.ok) {
          const failedSlots = dirtySaves.filter((row) =>
            !result.sentItems.some((item) => commandChannelViews(item.command).some((c) => c.channel === row.slot)))
            .map((row) => CHANNEL_SLOT_LABELS[row.slot]).join("·");
          setMessage({ tone: "error", text: `${failedSlots} 전송 실패. 입력값을 유지했습니다. 다시 적용하세요.` });
        }
      });
      return;
    }

    const values = panelDraftOrNull(draft, knownSettings);
    if (!values) {
      setMessage({
        tone: "error",
        text: "설정값을 올림·내림으로 입력한 뒤 저장하세요.",
      });
      return;
    }
    if (values.minVentPct > values.maxVentPct) {
      setMessage({ tone: "error", text: "최저 환기는 최고 환기 이하여야 합니다." });
      return;
    }

    setMessage(null);
    const formData = new FormData();
    formData.set("lsind_regist_no", target.farmKey.lsindRegistNo);
    formData.set("item_code", target.farmKey.itemCode);
    formData.set("module_uid", String(target.moduleUid));
    formData.set("stall_ty_code", target.stallTyCode ?? "SP01");
    formData.set("stall_no", target.stallNo ?? "01");
    formData.set("eqpmn_no", target.eqpmnNo);
    formData.set("min_vent_pct", String(values.minVentPct));
    formData.set("max_vent_pct", String(values.maxVentPct));
    formData.set("setpoint_temp", String(values.setpointTemp));
    formData.set("temp_deviation", String(values.tempDeviation));
    if (activeChannel) {
      formData.set("channel", activeChannel);
      if (channelEqpmnCode) {
        formData.set("eqpmn_code", channelEqpmnCode);
      }
    }

    void runSaveRequest(async () => {
      const result = await sendThermoCommandAction(formData);
      if (result.ok) {
        onCommandRegistered?.(result.command);
        markSavesCommitted([channelKey], { [channelKey]: values });
      } else {
        setMessage({ tone: "error", text: formatUserError(result.error) });
      }
    });
  }, [
    activeChannel,
    canCommand,
    channelEqpmnCode,
    channelKey,
    draft,
    knownSettings,
    markSavesCommitted,
    onBulkCommandsRegistered,
    onCommandRegistered,
    pending,
    runSaveRequest,
    target,
  ]);

  const displayValue = useMemo(() => {
    const d = panelDraftOrNull(draft, knownSettings);
    return d ? getDraftField(d, activeMenu) : null;
  }, [activeMenu, draft, knownSettings]);

  const displayCfg = MENU_STEPS[activeMenu];

  const fieldValues = useMemo((): Record<PanelMenuId, number> | null => {
    const d = panelDraftOrNull(draft, knownSettings);
    return d ? panelDraftToFields(d) : null;
  }, [draft, knownSettings]);

  /** 슬라이더·스와이프 UI용 수치 (미확인 시 편집 시작값) */
  const sliderValues = useMemo(
    (): Record<PanelMenuId, number> =>
      panelDraftToFields(panelDraftOrDefault(draft, knownSettings, editStart)),
    [draft, knownSettings, editStart],
  );

  /**
   * 「현재」표시는 실제 수신값. 제출값은 초안/진행 표시와 구분한다.
   */
  const currentValues = useMemo((): Record<PanelMenuId, number> | null => {
    if (liveBaseline) return thermoToFields(liveBaseline);
    if (knownSettings?.source === "live") return panelDraftToFields(draftFromSettings(knownSettings));
    return null;
  }, [knownSettings, liveBaseline]);

  /**
   * dirty 기준 — 방금 제출한 값 > 명령/낙관 knownSettings > LIVE.
   */
  const dirtyBaseline = useMemo((): Record<PanelMenuId, number> | null => {
    if (panelCommandFailed(latestCommand)) return liveBaseline ? thermoToFields(liveBaseline) : null;
    if (saveBaseline) return panelDraftToFields(saveBaseline);
    if (knownSettings) return panelDraftToFields(draftFromSettings(knownSettings));
    if (liveBaseline) return thermoToFields(liveBaseline);
    return null;
  }, [saveBaseline, knownSettings, liveBaseline, latestCommand]);

  const isFieldChanged = useCallback(
    (menu: PanelMenuId): boolean => {
      if (!dirtyBaseline) return hasEdited;
      const a = sliderValues[menu];
      const b = dirtyBaseline[menu];
      if (menu === "setpoint" || menu === "deviation") {
        return Math.abs(a - b) > 0.05;
      }
      return a !== b;
    },
    [dirtyBaseline, hasEdited, sliderValues],
  );

  const dirtySaves = useMemo(
    () =>
      channelContexts && channelContexts.length > 0
        ? collectDirtyChannelSaves(
            channelContexts,
            draftByKey,
            saveBaselineByKey,
          )
        : [],
    [channelContexts, draftByKey, saveBaselineByKey],
  );

  const dirtyChannelSlots = useMemo(
    () => dirtySaves.map((row) => row.slot),
    [dirtySaves],
  );

  const channelGlanceRows = useMemo(
    (): ChannelGlanceRow[] =>
      buildChannelGlanceRows(
        channelContexts ?? [],
        draftByKey,
        saveBaselineByKey,
      ),
    [channelContexts, draftByKey, saveBaselineByKey],
  );

  const peekDirtySaves = useCallback((): DirtyChannelSave[] => {
    const contexts = channelContextsRef.current;
    if (!contexts?.length) return [];
    return collectDirtyChannelSaves(
      contexts,
      draftByKeyRef.current,
      saveBaselineByKeyRef.current,
    );
  }, []);

  const hasChanges = useMemo(() => {
    if (channelContexts && channelContexts.length > 0) {
      return dirtySaves.length > 0;
    }
    if (!hasEdited && !dirtyBaseline) return false;
    if (!dirtyBaseline) return hasEdited;
    return !thermoValuesMatch(
      fieldsToThermo(sliderValues),
      fieldsToThermo(dirtyBaseline),
    );
  }, [
    channelContexts,
    dirtyBaseline,
    dirtySaves.length,
    hasEdited,
    sliderValues,
  ]);

  const setChannelField = useCallback((slot: ChannelSlot, menu: PanelMenuId, value: number) => {
    const ctx = channelContextsRef.current?.find((c) => c.slot === slot);
    if (!ctx) return;
    const clamped = clampMenuValue(menu, value);
    setEditedByKey((prev) => patchKeyMap(prev, slot, true));
    setDraftByKey((prev) => {
      const base = prev[slot] ?? displayThermoForChannel(ctx.knownSettings, ctx.liveBaseline, saveBaselineByKeyRef.current[slot], ctx.command) ?? editStartRef.current;
      return patchKeyMap(prev, slot, setDraftField(base, menu, clamped));
    });
  }, []);

  return {
    activeMenu,
    setActiveMenu,
    displayValue,
    displayCfg,
    fieldValues,
    sliderValues,
    currentValues,
    isFieldChanged,
    hasChanges,
    dirtySaves,
    dirtyChannelSlots,
    channelGlanceRows,
    peekDirtySaves,
    setField,
    setChannelField,
    setTempControl,
    setVentRange,
    adjust,
    applyDefaults,
    applyChannelDrafts,
    save,
    acceptSaves: (saves: DirtyChannelSave[]) => markSavesCommitted(saves.map(row => row.slot), Object.fromEntries(saves.map(row => [row.slot, row.values]))),
    pending,
    message,
    canCommand,
    settingsKnown,
    settingsSource: knownSettings?.source ?? null,
    hasEdited: anyEdited,
  };
}
