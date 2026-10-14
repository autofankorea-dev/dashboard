"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  saveEnvCoverAction,
  saveMotorDisplayAction,
  saveSheetLocaleAction,
} from "@/lib/actions/profile-sheet-prefs-actions";
import {
  DEFAULT_PROFILE_SHEET_PREFS,
  type MotorDisplay,
  type ProfileSheetPrefs,
  type SheetLocale,
} from "@/lib/ui/profile-sheet-prefs";
import {
  readDashboardLocale,
  subscribeDashboardLocale,
  writeDashboardLocale,
} from "@/lib/ui/dashboard-locale-store";
import { sheetCopy, type SheetCopyKey } from "@/lib/ui/sheet-copy";

type Update = {
  motorDisplay?: MotorDisplay;
  envCover?: boolean;
  locale?: SheetLocale;
};

const PrefsContext = createContext<{
  prefs: ProfileSheetPrefs;
  update: (patch: Update) => Promise<{ ok: boolean }>;
} | null>(null);

export function ProfileSheetPrefsProvider({
  initial,
  children,
}: {
  initial: ProfileSheetPrefs;
  children: ReactNode;
}) {
  const [prefs, setPrefs] = useState(initial);

  useEffect(() => {
    writeDashboardLocale(prefs.locale);
  }, [prefs.locale]);

  async function update(patch: Update) {
    const prev = prefs;
    const next = { ...prefs, ...patch };
    setPrefs(next);
    const result =
      patch.motorDisplay != null
        ? await saveMotorDisplayAction(patch.motorDisplay)
        : patch.envCover != null
          ? await saveEnvCoverAction(patch.envCover)
          : patch.locale != null
            ? await saveSheetLocaleAction(patch.locale)
            : { ok: true };
    if (!result.ok) setPrefs(prev);
    return result;
  }

  return (
    <PrefsContext.Provider value={{ prefs, update }}>
      {children}
    </PrefsContext.Provider>
  );
}

export function useProfileSheetPrefs(): ProfileSheetPrefs {
  return useContext(PrefsContext)?.prefs ?? DEFAULT_PROFILE_SHEET_PREFS;
}

export function useUpdateProfileSheetPrefs() {
  const ctx = useContext(PrefsContext);
  return ctx?.update ?? (async () => ({ ok: false }));
}

export function useSheetCopy() {
  const ctx = useContext(PrefsContext);
  const stored = useSyncExternalStore(
    subscribeDashboardLocale,
    readDashboardLocale,
    () => "ko" as const,
  );
  const locale = ctx?.prefs.locale ?? stored;
  return (key: SheetCopyKey, vars?: Record<string, string | number>) =>
    sheetCopy(locale, key, vars);
}
