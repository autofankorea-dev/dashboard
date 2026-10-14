import type { SheetLocale } from "@/lib/ui/profile-sheet-prefs";

const KEY = "dashboard-locale";

function isLocale(value: string | null): value is SheetLocale {
  return value === "ko" || value === "en";
}

export function readDashboardLocale(): SheetLocale {
  if (typeof window === "undefined") return "ko";
  try {
    const stored = window.localStorage.getItem(KEY);
    return isLocale(stored) ? stored : "ko";
  } catch {
    return "ko";
  }
}

export function writeDashboardLocale(locale: SheetLocale) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, locale);
  } catch {
    /* private mode */
  }
  window.dispatchEvent(new Event("dashboard-locale"));
}

export function subscribeDashboardLocale(onChange: () => void) {
  if (typeof window === "undefined") return () => {};
  const onStorage = (event: StorageEvent) => {
    if (event.key === KEY) onChange();
  };
  window.addEventListener("dashboard-locale", onChange);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener("dashboard-locale", onChange);
    window.removeEventListener("storage", onStorage);
  };
}
