"use client";

import {
  createContext,
  useContext,
  useState,
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
  const { locale } = useProfileSheetPrefs();
  return (key: SheetCopyKey, vars?: Record<string, string | number>) =>
    sheetCopy(locale, key, vars);
}
