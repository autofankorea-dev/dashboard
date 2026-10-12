"use client";

import {
  createContext,
  useContext,
  useMemo,
  type ReactNode,
} from "react";
import { useSearchParams } from "next/navigation";
import {
  parseFarmKeyFromQuery,
  type FarmKey,
} from "@/lib/domain/farm-key";

type FarmScopeContextValue = {
  isAdmin: boolean;
  fixedFarmKey: FarmKey | null;
};

const FarmScopeContext = createContext<FarmScopeContextValue | null>(null);

export function FarmScopeProvider({
  isAdmin,
  fixedFarmKey,
  children,
}: FarmScopeContextValue & { children: ReactNode }) {
  const value = useMemo(
    () => ({ isAdmin, fixedFarmKey }),
    [isAdmin, fixedFarmKey]
  );
  return (
    <FarmScopeContext.Provider value={value}>{children}</FarmScopeContext.Provider>
  );
}

export function useFarmScope() {
  const ctx = useContext(FarmScopeContext);
  if (!ctx) {
    throw new Error("useFarmScope must be used within FarmScopeProvider");
  }

  const searchParams = useSearchParams();
  const activeFarmKey = useMemo(() => {
    if (!ctx.isAdmin) return ctx.fixedFarmKey;
    return parseFarmKeyFromQuery(
      searchParams.get("lsind"),
      searchParams.get("item")
    );
  }, [ctx.isAdmin, ctx.fixedFarmKey, searchParams]);

  return {
    isAdmin: ctx.isAdmin,
    fixedFarmKey: ctx.fixedFarmKey,
    activeFarmKey,
  };
}
