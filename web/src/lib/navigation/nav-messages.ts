import { sublabelFromHref } from "@/lib/navigation/nav-utils";
import type { SheetLocale } from "@/lib/ui/profile-sheet-prefs";
import { sheetCopy, type SheetCopyKey } from "@/lib/ui/sheet-copy";

export type NavMessageOptions = {
  message?: string;
  sublabel?: string;
  waitForContentReady?: boolean;
  /** "brand" — 로그인 직후 로고 스플래시(F4). 기본은 스피너. */
  variant?: "spinner" | "brand";
  /** 없으면 한국어. 호출부가 이미 번역한 message는 그대로 쓴다. */
  locale?: SheetLocale;
};

function nav(locale: SheetLocale, key: SheetCopyKey): string {
  return sheetCopy(locale, key);
}

export function resolveNavMessage(
  href: string,
  overrides?: NavMessageOptions
): { message: string; sublabel?: string } {
  const sublabel = overrides?.sublabel ?? sublabelFromHref(href);

  if (overrides?.message) {
    return { message: overrides.message, sublabel };
  }

  const locale = overrides?.locale ?? "ko";

  let path = href;
  let tab: string | null = null;
  let opsTab: string | null = null;
  try {
    const url = new URL(href, "http://nav.local");
    path = url.pathname;
    tab = url.searchParams.get("tab");
    if (path.startsWith("/admin")) {
      opsTab = url.searchParams.get("tab");
    }
  } catch {
    path = href.split("?")[0] ?? href;
  }

  let message = nav(locale, "nav.page");
  if (path === "/alarms" || tab === "alarms" || tab === "ops") {
    message = nav(locale, "nav.controllers");
  } else if (path === "/controllers" || tab === "devices") {
    message = nav(locale, "nav.controllers");
  } else if (path === "/farm") message = nav(locale, "nav.monitoring");
  else if (path === "/pending") message = nav(locale, "nav.pending");
  else if (path === "/admin/ops" || path.startsWith("/admin/ops/") || path.startsWith("/admin/health") || path.startsWith("/admin/users")) {
    if (path.endsWith("/users") || opsTab === "users") message = nav(locale, "nav.opsUsers");
    else if (path.endsWith("/farms") || opsTab === "farms") message = nav(locale, "nav.opsFarms");
    else if (path.endsWith("/commands") || opsTab === "commands") message = nav(locale, "nav.opsCommands");
    else if (path.endsWith("/presets") || opsTab === "presets") message = nav(locale, "nav.opsPresets");
    else message = nav(locale, "nav.opsSystem");
  } else if (path === "/settings") message = nav(locale, "nav.page");
  else if (path.startsWith("/admin/health")) message = nav(locale, "nav.health");
  else if (path.startsWith("/admin/users")) message = nav(locale, "nav.users");
  else if (path.startsWith("/admin")) message = nav(locale, "nav.admin");
  else if (path === "/play") message = nav(locale, "nav.monitoring");

  return { message, sublabel };
}
