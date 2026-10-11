"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { farmKeyId, type FarmKey } from "@/lib/domain/farm-key";
import type { AdminFarmGridPanel } from "@/lib/farm/admin-all-farms-grid-shared";

type AdminHubPanelsContextValue = {
  panels: AdminFarmGridPanel[];
  ready: boolean;
  setPanels: (panels: AdminFarmGridPanel[]) => void;
  /** progressive hub hydrate — 기존 패널에 병합(동일 farmKey는 교체) */
  appendPanels: (panels: AdminFarmGridPanel[]) => void;
  /** SSR 이후 남은 farm keys — TailLoader가 hub 뷰에서 이어서 로드 */
  tailFarmKeys: FarmKey[];
  setTailFarmKeys: (keys: FarmKey[]) => void;
  /** placeholder/IO용 전체 hub farm 목록 */
  hubFarmKeys: FarmKey[];
  setHubFarmKeys: (keys: FarmKey[]) => void;
  /** viewport 우선 hydrate — TailLoader가 매 배치 전에 확인 */
  requestPriorityFarmKeys: (keys: FarmKey[]) => void;
  takePriorityFarmKeys: () => FarmKey[];
  getPanelByFarmKey: (farmKey: FarmKey) => AdminFarmGridPanel | undefined;
  hubUrlEpoch: number;
  notifyHubUrlChange: () => void;
};

const AdminHubPanelsContext = createContext<AdminHubPanelsContextValue | null>(
  null,
);

export function AdminHubPanelsProvider({ children }: { children: ReactNode }) {
  const [panels, setPanelsState] = useState<AdminFarmGridPanel[]>([]);
  const [ready, setReady] = useState(false);
  const [hubUrlEpoch, setHubUrlEpoch] = useState(0);
  const [tailFarmKeys, setTailFarmKeys] = useState<FarmKey[]>([]);
  const [hubFarmKeys, setHubFarmKeys] = useState<FarmKey[]>([]);
  const priorityRef = useRef<FarmKey[]>([]);

  const setPanels = useCallback((next: AdminFarmGridPanel[]) => {
    setPanelsState(next);
    // 빈 배열로 ready를 내리면 hub 전환·그리드가 한꺼번에 리셋된다.
    if (next.length > 0) setReady(true);
  }, []);

  const appendPanels = useCallback((incoming: AdminFarmGridPanel[]) => {
    if (incoming.length === 0) return;
    setPanelsState((prev) => {
      const map = new Map(
        prev.map((p) => [farmKeyId(p.farmKey), p] as const),
      );
      for (const p of incoming) map.set(farmKeyId(p.farmKey), p);
      return [...map.values()];
    });
    setReady(true);
  }, []);

  const requestPriorityFarmKeys = useCallback((keys: FarmKey[]) => {
    if (keys.length === 0) return;
    const seen = new Set<string>();
    const next: FarmKey[] = [];
    for (const k of keys) {
      const id = farmKeyId(k);
      if (seen.has(id)) continue;
      seen.add(id);
      next.push(k);
    }
    for (const k of priorityRef.current) {
      const id = farmKeyId(k);
      if (seen.has(id)) continue;
      seen.add(id);
      next.push(k);
    }
    priorityRef.current = next;
  }, []);

  const takePriorityFarmKeys = useCallback(() => {
    const keys = priorityRef.current;
    priorityRef.current = [];
    return keys;
  }, []);

  const getPanelByFarmKey = useCallback(
    (farmKey: FarmKey) =>
      panels.find((p) => farmKeyId(p.farmKey) === farmKeyId(farmKey)),
    [panels],
  );

  const notifyHubUrlChange = useCallback(() => {
    setHubUrlEpoch((n) => n + 1);
  }, []);

  const value = useMemo(
    (): AdminHubPanelsContextValue => ({
      panels,
      ready,
      setPanels,
      appendPanels,
      tailFarmKeys,
      setTailFarmKeys,
      hubFarmKeys,
      setHubFarmKeys,
      requestPriorityFarmKeys,
      takePriorityFarmKeys,
      getPanelByFarmKey,
      hubUrlEpoch,
      notifyHubUrlChange,
    }),
    [
      panels,
      ready,
      setPanels,
      appendPanels,
      tailFarmKeys,
      hubFarmKeys,
      requestPriorityFarmKeys,
      takePriorityFarmKeys,
      getPanelByFarmKey,
      hubUrlEpoch,
      notifyHubUrlChange,
    ],
  );

  return (
    <AdminHubPanelsContext.Provider value={value}>
      {children}
    </AdminHubPanelsContext.Provider>
  );
}

export function useAdminHubPanels(): AdminHubPanelsContextValue {
  const ctx = useContext(AdminHubPanelsContext);
  if (!ctx) {
    throw new Error(
      "useAdminHubPanels must be used within AdminHubPanelsProvider",
    );
  }
  return ctx;
}

export function useAdminHubPanelsOptional(): AdminHubPanelsContextValue | null {
  return useContext(AdminHubPanelsContext);
}
