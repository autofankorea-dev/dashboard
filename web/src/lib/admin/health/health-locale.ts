import type { HealthStatus } from "@/lib/admin/health/types";
import { HEALTH_STATUS_LABEL } from "@/lib/admin/health/types";
import { HEALTH_UI } from "@/lib/admin/health/health-ui-labels";
import type { SheetLocale } from "@/lib/ui/profile-sheet-prefs";

const STATUS_EN: Record<HealthStatus, string> = {
  ok: "Normal",
  warn: "Caution",
  critical: "Fault",
  unknown: "Unknown",
  not_implemented: "Not built",
};

export function healthStatusLabel(status: HealthStatus, locale: SheetLocale = "ko"): string {
  return locale === "en" ? STATUS_EN[status] : HEALTH_STATUS_LABEL[status];
}

export function healthUiText(
  key: keyof typeof HEALTH_UI,
  locale: SheetLocale,
): string {
  if (locale !== "en") return HEALTH_UI[key];
  const en: Record<keyof typeof HEALTH_UI, string> = {
    systemTitle: "System status",
    systemDesc: "No secrets · snapshot every 5 min",
    dataPath: "Data path",
    dataPathDesc: "Site → collector → database → dashboard. Select a node for detail.",
    nodeSummary: "Node summary",
    activeAlerts: "Infrastructure alerts",
    activeAlertsDesc: "Collect, store, and screen · modules are in the table below",
    moduleSummary: "Modules",
    collectorGroups: "Collector groups",
    collectorGroupsDesc: "Farms grouped by RS uplink. A/B split the list when env mapping is unset.",
    insertRate: "Raw intake",
    insertRateDesc: "5-minute buckets · a zero stretch may mean collection stopped",
    moduleAge: "Latest module reception",
    moduleAgeDesc: "Time since last seen",
    liveCap: "Live query cap",
    liveCapDesc: "Global live-view cap for the admin screen",
    farmModules: "Farms · modules",
    farmModulesDesc: "Worst rollup · by status, then age",
    actionHint: "ERROR TYPE · RECOMMEND",
    downlink: "Commands (downlink)",
    downlinkDesc: "C process · excluded from uplink rollup",
    externalLink: "External link",
    externalDesc: "Disabled · excluded from rollup",
  };
  return en[key];
}

const DAG_EN: Record<string, { label: string; short: string }> = {
  field: { label: "Farms", short: "Farm" },
  rs: { label: "Collector", short: "Collect" },
  decode: { label: "decode-batch Edge function", short: "Edge" },
  db: { label: "Data store", short: "DB" },
  ui: { label: "Dashboard", short: "Screen" },
  "c-cmd": { label: "Command server", short: "Command" },
  "ext-link": { label: "External link", short: "Link" },
  mqtt: { label: "MQTT broker", short: "MQTT" },
};

const PIPELINE_EN: Record<string, { label: string; short: string }> = {
  "field-controller": { label: "Env controller", short: "CTRL" },
  "field-module": { label: "Comm module", short: "MOD" },
  collector: { label: "Collector", short: "COL" },
  storage: { label: "Data store", short: "DB" },
  dashboard: { label: "Dashboard", short: "UI" },
  external: { label: "External link", short: "EXT" },
  "collector-mqtt": { label: "Mosquitto", short: "MQTT" },
  "collector-rs": { label: "RS intake", short: "RS" },
  "collector-c": { label: "Command server", short: "C" },
  "collector-ekape": { label: "Ekape job", short: "EK" },
  "collector-ftp": { label: "FTP worker", short: "FTP" },
};

export function healthNodeDisplay(
  id: string,
  label: string,
  short: string,
  locale: SheetLocale,
): { label: string; short: string } {
  if (locale !== "en") return { label, short };
  return DAG_EN[id] ?? PIPELINE_EN[id] ?? { label, short };
}

export const DAG_ZONE_LABELS_EN = ["Farm", "MQTT", "Collect", "Store", "Show"] as const;

export function healthAgeLabel(ageMin: number | null, locale: SheetLocale): string | undefined {
  if (ageMin == null) return undefined;
  const n = Math.round(ageMin);
  if (locale === "en") {
    if (n < 1) return "just now";
    if (n < 60) return `${n} min ago`;
    if (n < 60 * 24) return `${Math.floor(n / 60)} h ago`;
    return `${Math.floor(n / (60 * 24))} d ago`;
  }
  if (n < 1) return "방금";
  if (n < 60) return `${n}분 전`;
  if (n < 60 * 24) return `${Math.floor(n / 60)}시간 전`;
  return `${Math.floor(n / (60 * 24))}일 전`;
}
