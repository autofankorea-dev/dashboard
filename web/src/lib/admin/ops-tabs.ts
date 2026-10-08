export type AdminOpsTabId =
  | "system"
  | "users"
  | "farms"
  | "commands"
  | "presets";

export const ADMIN_OPS_TABS: ReadonlyArray<{
  id: AdminOpsTabId;
  label: string;
}> = [
  { id: "system", label: "시스템" },
  { id: "users", label: "사용자" },
  { id: "farms", label: "농장 위치" },
  { id: "commands", label: "명령 이력" },
  { id: "presets", label: "명령 프리셋" },
];

export const ADMIN_OPS_BASE_PATH = "/admin/ops";

const TAB_SEGMENT: Record<Exclude<AdminOpsTabId, "system">, string> = {
  users: "users",
  farms: "farms",
  commands: "commands",
  presets: "presets",
};

/** pathname → 탭 (nested route) */
export function parseAdminOpsTabFromPathname(pathname: string): AdminOpsTabId {
  const normalized = pathname.replace(/\/$/, "");
  if (normalized.endsWith("/users")) return "users";
  if (normalized.endsWith("/farms")) return "farms";
  if (normalized.endsWith("/commands")) return "commands";
  if (normalized.endsWith("/presets")) return "presets";
  return "system";
}

export function adminOpsPath(tab: AdminOpsTabId = "system"): string {
  if (tab === "system") return ADMIN_OPS_BASE_PATH;
  return `${ADMIN_OPS_BASE_PATH}/${TAB_SEGMENT[tab]}`;
}

export function adminOpsHref(
  tab: AdminOpsTabId = "system",
  params?: URLSearchParams | Record<string, string | undefined | null>,
): string {
  const search = new URLSearchParams();
  if (params instanceof URLSearchParams) {
    params.forEach((value, key) => {
      if (value && key !== "tab") search.set(key, value);
    });
  } else if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value && key !== "tab") search.set(key, value);
    }
  }
  const base = adminOpsPath(tab);
  const q = search.toString();
  return q ? `${base}?${q}` : base;
}
