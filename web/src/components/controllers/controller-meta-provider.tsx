"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { saveControllerDisplayNameAction } from "@/app/(dashboard)/controllers/actions";
import {
  controllerDisplayName,
  type ControllerMetaEntry,
} from "@/lib/domain/controller-meta-shared";

type ControllerMetaContextValue = {
  resolveName: (controllerKey: string, eqpmnNo: string) => string | null;
  canEdit: boolean;
  saveDisplayName: (
    controllerKey: string,
    eqpmnNo: string,
    displayName: string
  ) => Promise<{ ok: boolean; error?: string }>;
};

const ControllerMetaContext = createContext<ControllerMetaContextValue | null>(
  null
);

export function ControllerMetaProvider({
  metas: initialMetas,
  canEdit,
  children,
}: {
  metas: ControllerMetaEntry[];
  canEdit: boolean;
  children: ReactNode;
}) {
  const [metas, setMetas] = useState(initialMetas);

  const resolveName = useCallback(
    (controllerKey: string, eqpmnNo: string) =>
      controllerDisplayName(controllerKey, eqpmnNo, metas),
    [metas]
  );

  const saveDisplayName = useCallback(
    async (controllerKey: string, eqpmnNo: string, displayName: string) => {
      const result = await saveControllerDisplayNameAction(
        controllerKey,
        eqpmnNo,
        displayName
      );
      if (result.ok) {
        const trimmed = displayName.trim();
        setMetas((prev) => {
          const next = prev.filter((m) => m.controllerKey !== controllerKey);
          if (trimmed) next.push({ controllerKey, eqpmnNo, displayName: trimmed });
          return next.sort((a, b) =>
            a.controllerKey.localeCompare(b.controllerKey)
          );
        });
      }
      return result;
    },
    []
  );

  const value = useMemo(
    () => ({ resolveName, canEdit, saveDisplayName }),
    [resolveName, canEdit, saveDisplayName]
  );

  return (
    <ControllerMetaContext.Provider value={value}>
      {children}
    </ControllerMetaContext.Provider>
  );
}

export function useControllerMeta() {
  const ctx = useContext(ControllerMetaContext);
  if (!ctx) {
    return {
      resolveName: () => null as string | null,
      canEdit: false,
      saveDisplayName: async () => ({ ok: false, error: "no_provider" }),
    };
  }
  return ctx;
}
