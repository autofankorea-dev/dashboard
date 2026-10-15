"use client";

import { useMemo, useState, useSyncExternalStore, type ComponentType } from "react";
import { AdminHubGeoMap } from "@/components/farm/admin-hub-geo-map";
import {
  Activity,
  Clock,
  Cpu,
  Droplets,
  MapPin,
  MapPinned,
  MapPinOff,
  Thermometer,
  TriangleAlert,
  WifiOff,
} from "lucide-react";
import { useProfileSheetPrefs, useSheetCopy } from "@/components/account/profile-sheet-prefs";
import { NavContentReadyMarker } from "@/components/layout/nav-content-ready-marker";
import { appendFarmKeyParams, farmKeyId, type FarmKey } from "@/lib/domain/farm-key";
import type { FarmLocationRow } from "@/lib/domain/farm-location-shared";
import {
  farmDisplayLabel,
  formatHumidityPct,
  formatReceivedAgo,
  formatTempC,
  type FarmSummaryRow,
} from "@/lib/domain/farm-summaries";
import {
  collectAdminHubFarmRows,
  filterAdminHubFarmRowsByTone,
  hubFarmHasMapPin,
  hubFarmMonitorMetrics,
  summarizeAdminHubTones,
  type AdminHubFarmTone,
} from "@/lib/farm/admin-hub-farm-status";
import {
  dashboardHubSurface,
  dashboardReadout,
  dashboardTypography,
  dashboardUi,
} from "@/lib/ui/dashboard-page-ui";
import { cn } from "@/lib/utils";

type Props = {
  farmOptions: FarmKey[];
  farmSummaries: FarmSummaryRow[];
  locations: FarmLocationRow[];
};

const TONE_DOT: Record<AdminHubFarmTone, string> = {
  live: "bg-emerald-500",
  alert: "bg-status-danger",
  offline: "bg-muted-foreground",
  location: "bg-channel-info",
};

const TONE_ICON: Record<
  AdminHubFarmTone,
  { Icon: ComponentType<{ className?: string }>; className: string }
> = {
  live: { Icon: Activity, className: "text-emerald-600" },
  alert: { Icon: TriangleAlert, className: "text-status-danger" },
  offline: { Icon: WifiOff, className: "text-muted-foreground" },
  location: { Icon: MapPinned, className: "text-channel-info" },
};

function farmMonitorHref(farmKey: FarmKey): string {
  const params = new URLSearchParams();
  appendFarmKeyParams(params, farmKey);
  return `/farm?${params.toString()}`;
}

const emptySubscribe = () => () => {};

function formatAgoShort(iso: string | null, locale: "ko" | "en"): string | null {
  const label = formatReceivedAgo(iso, locale);
  if (label === "—") return null;
  return locale === "en" ? label.replace(/ ago$/, "") : label.replace(/ 전$/, "");
}

export function AdminHubControlView({
  farmOptions,
  farmSummaries,
  locations,
}: Props) {
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);
  const locale = useProfileSheetPrefs().locale;
  const t = useSheetCopy();
  const toneLabel: Record<AdminHubFarmTone, string> = {
    live: t("cover.ok"),
    alert: t("account.alert"),
    offline: t("account.offline"),
    location: t("farm.locationOnly"),
  };
  const [activeId, setActiveId] = useState<string | null>(null);
  const [toneFilter, setToneFilter] = useState<AdminHubFarmTone | null>(null);

  const rows = useMemo(
    () => collectAdminHubFarmRows(farmOptions, farmSummaries, locations),
    [farmOptions, farmSummaries, locations],
  );
  const tones = useMemo(() => summarizeAdminHubTones(rows), [rows]);
  const visibleRows = useMemo(
    () => filterAdminHubFarmRowsByTone(rows, toneFilter),
    [rows, toneFilter],
  );
  const mapped = useMemo(
    () => visibleRows.filter(hubFarmHasMapPin),
    [visibleRows],
  );
  const unmapped = visibleRows.length - mapped.length;

  const toggleToneFilter = (tone: AdminHubFarmTone) => {
    setToneFilter((current) => (current === tone ? null : tone));
  };

  const openFarm = (farmKey: FarmKey) => {
    window.location.assign(farmMonitorHref(farmKey));
  };

  return (
    <section className="flex min-h-0 flex-col gap-3">
      <NavContentReadyMarker />
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="inline-flex items-center gap-1.5">
          <MapPin className="size-4 text-muted-foreground" aria-hidden />
          <span className="text-sm font-semibold">{t("account.national")}</span>
          <span className={cn(dashboardReadout.value, "tabular-nums")}>
            {tones.total}
          </span>
        </h2>
        <ul className="flex flex-wrap items-center gap-1">
          {(["live", "alert", "offline", "location"] as const).map((tone) => {
            const { Icon, className } = TONE_ICON[tone];
            const pressed = toneFilter === tone;
            return (
              <li key={tone}>
                <button
                  type="button"
                  className={cn(
                    "inline-flex items-center gap-1 rounded-md px-1.5 py-1",
                    dashboardTypography.badge,
                    pressed
                      ? "bg-muted ring-1 ring-foreground/20"
                      : "hover:bg-muted/60",
                  )}
                  title={toneLabel[tone]}
                  aria-label={`${toneLabel[tone]} ${tones[tone]}`}
                  aria-pressed={pressed}
                  onClick={() => toggleToneFilter(tone)}
                >
                  <Icon className={cn("size-3.5", className)} aria-hidden />
                  <span className="tabular-nums">{tones[tone]}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </header>

      <div className="grid min-h-0 gap-3 lg:grid-cols-[minmax(0,1.25fr)_minmax(18rem,0.85fr)]">
        <div
          className={cn(
            dashboardHubSurface.well,
            "relative min-h-[22rem] overflow-hidden rounded-xl md:min-h-[28rem] lg:min-h-[min(70vh,40rem)]",
          )}
        >
          {mapped.length === 0 ? (
            <div className="flex min-h-[18rem] flex-col items-center justify-center gap-2 px-6 text-center md:min-h-[22rem] lg:min-h-[28rem]">
              <MapPin className="size-6 text-muted-foreground" aria-hidden />
              <p className={dashboardUi.body}>지도에 표시할 좌표가 없습니다.</p>
            </div>
          ) : (
            <AdminHubGeoMap
              rows={mapped}
              activeId={activeId}
              onHover={setActiveId}
              onSelect={openFarm}
            />
          )}
        </div>

        <div
          className={cn(
            dashboardHubSurface.tile,
            "flex max-h-[min(70vh,40rem)] min-h-[16rem] flex-col overflow-hidden rounded-xl lg:max-h-[min(72vh,44rem)]",
          )}
        >
          <ul className="min-h-0 flex-1 overflow-y-auto">
            {visibleRows.map((row) => {
              const id = farmKeyId(row.farmKey);
              const active = activeId === id;
              const name = farmDisplayLabel(row.farmKey, row.location?.farmName, locale);
              const region = row.location
                ? `${row.location.sido} ${row.location.sigungu}`
                : null;
              const { tempC, humidityPct, online, controllerCount } =
                hubFarmMonitorMetrics(row);
              const ago = mounted
                ? formatAgoShort(row.summary?.latestReceivedAt ?? null, locale)
                : null;
              return (
                <li key={id}>
                  <a
                    href={farmMonitorHref(row.farmKey)}
                    title={region ? `${name} · ${region}` : name}
                    aria-label={`${name} ${toneLabel[row.tone]}${region ? ` ${region}` : ""}`}
                    onMouseEnter={() => setActiveId(id)}
                    onFocus={() => setActiveId(id)}
                    className={cn(
                      "flex w-full items-start gap-2 px-3 py-2 text-left no-underline transition-colors",
                      active ? "bg-muted/80" : "hover:bg-muted/50",
                    )}
                  >
                    <span
                      className={cn(
                        "mt-1.5 size-2.5 shrink-0 rounded-full",
                        TONE_DOT[row.tone],
                      )}
                      aria-hidden
                    />
                    <span className="min-w-0 flex-1">
                      <span
                        className={cn(
                          dashboardUi.cardTitle,
                          "block truncate",
                        )}
                      >
                        {name}
                      </span>
                      <span className="mt-1 grid grid-cols-4 items-center gap-x-2 gap-y-0.5">
                        <span
                          className="inline-flex items-center gap-0.5"
                          title="온도"
                        >
                          <Thermometer
                            className="size-3.5 text-channel-temp"
                            aria-hidden
                          />
                          <span className={dashboardReadout.value}>
                            {formatTempC(tempC)}
                          </span>
                        </span>
                        <span
                          className="inline-flex items-center gap-0.5"
                          title="습도"
                        >
                          <Droplets
                            className="size-3.5 text-channel-hum"
                            aria-hidden
                          />
                          <span className={dashboardReadout.value}>
                            {formatHumidityPct(humidityPct)}
                          </span>
                        </span>
                        <span
                          className={cn(
                            "inline-flex items-center gap-0.5",
                            online == null && "text-muted-foreground",
                          )}
                          title="제어기"
                        >
                          <Cpu className="size-3.5" aria-hidden />
                          <span className={dashboardReadout.value}>
                            {online == null
                              ? "—"
                              : `${online}/${controllerCount}`}
                          </span>
                        </span>
                        <span
                          className="inline-flex min-w-0 items-center gap-0.5 text-muted-foreground"
                          title="최근 수신"
                        >
                          <Clock className="size-3.5 shrink-0" aria-hidden />
                          <span className={cn(dashboardTypography.badge, "truncate")}>
                            {ago ?? "—"}
                          </span>
                        </span>
                      </span>
                    </span>
                  </a>
                </li>
              );
            })}
          </ul>
          {unmapped > 0 ? (
            <div
              className={cn(
                "flex items-center gap-1 border-t px-3 py-1.5 text-muted-foreground",
                dashboardTypography.badge,
              )}
              title="좌표 없는 농장 · 목록만"
              aria-label={`좌표 없는 농장 ${unmapped}`}
            >
              <MapPinOff className="size-3.5" aria-hidden />
              <span className="tabular-nums">{unmapped}</span>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
