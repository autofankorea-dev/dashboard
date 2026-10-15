"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ThermoCommand } from "@/lib/data/commands";
import { commandStatusLabel } from "@/lib/controllers/controller-settings";
import type { CommandPipelineFlash } from "@/components/controllers/use-command-pipeline-tracker";
import type { CommandPipelineOverlayState } from "@/components/farm/command-pipeline-overlay";
import {
  pipelineDetailMessage,
} from "@/lib/ui/controller-labels";
import { useProfileSheetPrefs } from "@/components/account/profile-sheet-prefs";
import { sheetCopy } from "@/lib/ui/sheet-copy";

type Args = {
  isSaving: boolean;
  commandBusy?: boolean;
  alarmBusy?: boolean;
  suppressCommandStatus?: boolean;
  command: ThermoCommand | null;
  liveConfirmed: boolean;
  flash: CommandPipelineFlash | null;
  panelError: string | null;
  isCommandOverlayDismissed: (commandId: string | undefined) => boolean;
  onAcknowledgeCommandOverlay?: (commandId: string) => void;
  isUserInitiatedCommand: (commandId: string | undefined) => boolean;
};

export function useSettingsApplyOverlay({
  isSaving,
  commandBusy = false,
  alarmBusy = false,
  suppressCommandStatus = false,
  command,
  liveConfirmed,
  flash,
  panelError,
  isCommandOverlayDismissed,
  onAcknowledgeCommandOverlay,
  isUserInitiatedCommand,
}: Args) {
  const locale = useProfileSheetPrefs().locale;
  const [dismissed, setDismissed] = useState(false);
  const [alarmSavedFlash, setAlarmSavedFlash] = useState(false);
  const [prevSaving, setPrevSaving] = useState(isSaving);
  const [prevCommandId, setPrevCommandId] = useState<string | null>(
    () => command?.id ?? null,
  );

  // Prop/key sync during render — avoid setState-in-effect
  const commandId = command?.id ?? null;
  if (commandId !== prevCommandId) {
    setPrevCommandId(commandId);
    if (commandId && isUserInitiatedCommand(commandId)) {
      setDismissed(false);
    }
  }

  // isSaving falling edge → flash (render adjust + timeout effect)
  if (isSaving !== prevSaving) {
    setPrevSaving(isSaving);
    if (prevSaving && !isSaving && !command) {
      setAlarmSavedFlash(true);
    }
  }

  useEffect(() => {
    if (!alarmSavedFlash) return;
    const t = window.setTimeout(() => setAlarmSavedFlash(false), 2800);
    return () => window.clearTimeout(t);
  }, [alarmSavedFlash]);

  const dismiss = useCallback(() => {
    setDismissed(true);
    setAlarmSavedFlash(false);
    if (command?.id) {
      onAcknowledgeCommandOverlay?.(command.id);
    }
  }, [command, onAcknowledgeCommandOverlay]);

  const overlay = useMemo((): CommandPipelineOverlayState => {
    if (isSaving) {
      if (suppressCommandStatus && commandBusy && !alarmBusy) {
        /* 명령 진행은 한눈 행 채움 */
      } else {
        return {
          visible: true,
          phase: "loading",
          title: sheetCopy(locale, "cmd.applying"),
          detail: sheetCopy(locale, "cmd.saving"),
          autoDismiss: false,
        };
      }
    }

    if (dismissed || isCommandOverlayDismissed(command?.id)) {
      return { visible: false, phase: "info", title: "", autoDismiss: true };
    }

    const commandAccepted =
      Boolean(command) &&
      isUserInitiatedCommand(command?.id) &&
      (command?.status === "pending" ||
        command?.status === "sent" ||
        command?.status === "applied");

    /** 채널 명령이 이미 접수되면 카드 에러보다 큐 진행이 우선 */
    if (panelError && !commandAccepted && !liveConfirmed) {
      return {
        visible: true,
        phase: "error",
        title: sheetCopy(locale, "cmd.applyFailed"),
        detail: panelError,
        autoDismiss: true,
      };
    }

    if (liveConfirmed && isUserInitiatedCommand(command?.id) && !suppressCommandStatus) {
      const setpoint =
        command?.setpointTemp != null ? `${command.setpointTemp}℃` : null;
      return {
        visible: true,
        phase: "success",
        title: sheetCopy(locale, "cmd.applied"),
        detail:
          flash?.text ??
          (setpoint
            ? sheetCopy(locale, "cmd.setpointApplied", { value: setpoint })
            : sheetCopy(locale, "cmd.panelShows")),
        autoDismiss: true,
        autoDismissMs: 4000,
      };
    }

    if (alarmSavedFlash) {
      return {
        visible: true,
        phase: "success",
        title: sheetCopy(locale, "cmd.saved"),
        detail: sheetCopy(locale, "cmd.alarmSaved"),
        autoDismiss: true,
        autoDismissMs: 4000,
      };
    }

    if (command?.status === "failed" && isUserInitiatedCommand(command.id)) {
      return {
        visible: true,
        phase: "error",
        title: commandStatusLabel(command.status, locale),
        detail: pipelineDetailMessage(command.status, command.errorMsg, locale),
        autoDismiss: true,
      };
    }

    // 전송·등록 성공 = 적용 완료 (LIVE/ACK 대기 없이 값 표시는 명령 낙관 패치)
    if (
      !suppressCommandStatus &&
      command &&
      isUserInitiatedCommand(command.id) &&
      (command.status === "pending" ||
        command.status === "sent" ||
        command.status === "applied")
    ) {
      const setpoint =
        command.setpointTemp != null ? `${command.setpointTemp}℃` : null;
      return {
        visible: true,
        phase: "success",
        title: sheetCopy(locale, "cmd.applied"),
        detail: setpoint
          ? sheetCopy(locale, "cmd.setpointSent", { value: setpoint })
          : sheetCopy(locale, "cmd.registerSuccess"),
        autoDismiss: true,
        autoDismissMs: 4000,
      };
    }

    if (flash) {
      const isLiveConfirmFlash =
        flash.tone === "ok" &&
        (flash.liveMatch === true ||
          flash.text.includes("현장 반영") ||
          flash.text.includes("LIVE 설정온도") ||
          flash.text.includes("live setpoint"));
      if (
        isLiveConfirmFlash &&
        (suppressCommandStatus ||
          !isUserInitiatedCommand(command?.id) ||
          dismissed ||
          isCommandOverlayDismissed(command?.id))
      ) {
        return { visible: false, phase: "info", title: "", autoDismiss: true };
      }
      return {
        visible: true,
        phase:
          flash.tone === "error"
            ? "error"
            : flash.tone === "ok"
              ? "success"
              : "info",
        title: command ? commandStatusLabel(command.status, locale) : sheetCopy(locale, "cmd.status"),
        detail: flash.text,
        autoDismiss: flash.tone !== "info",
      };
    }

    return { visible: false, phase: "info", title: "", autoDismiss: true };
  }, [
    alarmSavedFlash,
    alarmBusy,
    command,
    commandBusy,
    dismissed,
    flash,
    isCommandOverlayDismissed,
    isSaving,
    isUserInitiatedCommand,
    liveConfirmed,
    panelError,
    locale,
    suppressCommandStatus,
  ]);

  return { overlay, dismiss };
}
