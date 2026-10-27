"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  type ReactNode,
} from "react";
import {
  useBulkCommandPipelineTracker,
  type BulkLiveProgress,
  type BulkLiveTrackRow,
} from "@/components/farm/use-bulk-command-pipeline-tracker";
import type { BulkSentCommandItem } from "@/app/(dashboard)/controllers/actions";
import type { ControllerCommandFailure } from "@/lib/controllers/bulk-command-result";
import type { ThermoCommand } from "@/lib/data/commands";
import { useFarmLiveRefreshOptional } from "@/components/farm/farm-live-refresh";

type ApplyQueueContextValue = {
  startSession: (items: BulkSentCommandItem[], failures?: ControllerCommandFailure[]) => void;
  startFromCommand: (readingKey: string, command: ThermoCommand) => void;
  rows: BulkLiveTrackRow[];
  progress: BulkLiveProgress;
  setDockOpen: (open: boolean) => void;
};

export const EMPTY_APPLY_PROGRESS: BulkLiveProgress = {
  total: 0,
  ackDone: 0,
  liveDone: 0,
  failed: 0,
  pending: 0,
  timedOut: false,
  complete: false,
  allLive: false,
  allOk: false,
  ackSettled: false,
  counts: { 접수: 0, 전송: 0, 확인: 0, 실패: 0 },
};

const ApplyQueueContext = createContext<ApplyQueueContextValue | null>(null);

export function FarmApplyQueueProvider({ children }: { children: ReactNode }) {
  const live = useFarmLiveRefreshOptional();
  const readings = live?.slice.readings ?? [];
  const thermoSettings = live?.slice.controller?.thermoSettings ?? {};
  const tracker = useBulkCommandPipelineTracker({
    thermoSettings,
    readings,
    watchCommands: live?.slice.controller?.commands ?? [],
    farmKey: live?.farmKey ?? null,
    onRefreshLive: () => {
      void live?.revalidateFarmLive();
    },
    onCommandAck: (cmd) => live?.patchThermoFromCommand(cmd),
  });

  const { startSession, setDockOpen, rows, progress } =
    tracker;

  const startFromCommand = useCallback(
    (readingKey: string, command: ThermoCommand) => {
      startSession([{ key: readingKey, id: command.id, command }]);
    },
    [startSession],
  );

  const value = useMemo(
    (): ApplyQueueContextValue => ({
      startSession,
      startFromCommand,
      rows,
      progress,
      setDockOpen,
    }),
    [startSession, startFromCommand, rows, progress, setDockOpen],
  );

  return (
    <ApplyQueueContext.Provider value={value}>
      {children}
    </ApplyQueueContext.Provider>
  );
}

export function useApplyQueueOptional(): ApplyQueueContextValue | null {
  return useContext(ApplyQueueContext);
}
