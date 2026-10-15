"use client";

import { Fragment, type ReactNode } from "react";
import { CHANNEL_SLOT_LABELS } from "@/lib/domain/iot-channel";
import type {
  TrendEnvelope,
  TrendEventLane,
  TrendHistogram,
  TrendSeries,
} from "@/lib/domain/trend-chart-types";
import {
  COMMAND_SETTING_COLOR,
  COMMAND_SETTING_DASH,
  COMMAND_SETTING_FILL_OPACITY,
} from "@/lib/farm/command-hold-bands";
import {
  type HoverMetricGroup,
  inferHoverMetricGroup,
} from "@/lib/farm/trend-chart-format";
import type { UplinkCoverageBand } from "@/lib/farm/trend-uplink-coverage";
import { cn } from "@/lib/utils";
import { useProfileSheetPrefs } from "@/components/account/profile-sheet-prefs";
import { sheetCopy, translateFixedLabel } from "@/lib/ui/sheet-copy";
import type { PositionedCommandSettingHit } from "@/lib/farm/trend-chart-layout";

/**
 * TrendChart 범례. trend-chart.tsx JSX를 동작 변경 없이 1:1 이동.
 */
export function TrendChartLegend({
  showLegend,
  legendTrailing,
  fillParent,
  legendDensity,
  series,
  usesRight,
  positionedCommandHits,
  envelopes,
  histograms,
  coverageBands,
  eventLane,
}: {
  showLegend: boolean;
  legendTrailing: ReactNode;
  fillParent: boolean;
  legendDensity: "full" | "core";
  series: TrendSeries[];
  usesRight: boolean;
  positionedCommandHits: PositionedCommandSettingHit[];
  envelopes: TrendEnvelope[];
  histograms: TrendHistogram[];
  coverageBands: UplinkCoverageBand[];
  eventLane: TrendEventLane | null;
}) {
  const locale = useProfileSheetPrefs().locale;
  if (!showLegend && !legendTrailing) return null;
  return (
  <div
    className={cn(
      "flex flex-wrap items-center gap-x-4 gap-y-1.5",
      fillParent && "shrink-0",
    )}
    data-trend-chart-legend=""
  >
    {showLegend ? (() => {
      type LegendItem = {
        key: string;
        group: HoverMetricGroup;
        label: string;
        node: ReactNode;
      };
      const items: Array<LegendItem & { sourceLabel: string }> = [];

      for (const s of series) {
        if (
          legendDensity !== "full" &&
          s.name !== "온도" &&
          s.name !== "습도"
        ) {
          continue;
        }
        items.push({
          key: `s-${s.name}`,
          group: inferHoverMetricGroup(s.name),
          label: translateFixedLabel(locale, s.name),
          sourceLabel: s.name,
          node: (
            <span className="inline-flex items-center gap-1 farm-chart-fs-legend text-muted-foreground">
              <span
                className="inline-block w-3 border-t-2"
                style={{
                  borderColor: s.color,
                  borderStyle: s.strokeDasharray
                    ? s.strokeDasharray.startsWith("2")
                      ? "dotted"
                      : "dashed"
                    : "solid",
                }}
                aria-hidden
              />
              {translateFixedLabel(locale, s.name)}
              {(s.axis ?? "left") === "right" && usesRight ? (
                <span className="opacity-60">({sheetCopy(locale, "chart.right")})</span>
              ) : null}
            </span>
          ),
        });
      }

      if (positionedCommandHits.length > 0) {
        const seen = new Set<string>();
        for (const hit of positionedCommandHits) {
          const ch = hit.seg.mark.hold?.channel;
          if (!ch || seen.has(ch)) continue;
          seen.add(ch);
          const sourceLabel = CHANNEL_SLOT_LABELS[ch];
          const label = translateFixedLabel(locale, sourceLabel);
          const dash = COMMAND_SETTING_DASH[ch];
          const fillOp = COMMAND_SETTING_FILL_OPACITY[ch];
          items.push({
            key: `cmd-set-${ch}`,
            group: "temp",
            label,
            sourceLabel,
            node: (
              <span className="inline-flex items-center gap-1 farm-chart-fs-legend text-muted-foreground">
                <span
                  className="relative inline-flex h-2 w-3 items-center"
                  aria-hidden
                >
                  {fillOp > 0 ? (
                    <span
                      className="absolute inset-0 rounded-sm"
                      style={{
                        backgroundColor: COMMAND_SETTING_COLOR,
                        opacity: fillOp * 2,
                      }}
                    />
                  ) : null}
                  <svg
                    width="12"
                    height="8"
                    viewBox="0 0 12 8"
                    className="relative"
                  >
                    <line
                      x1="0.5"
                      y1="4"
                      x2="11.5"
                      y2="4"
                      stroke={COMMAND_SETTING_COLOR}
                      strokeWidth="1.5"
                      strokeDasharray={dash}
                      opacity="0.85"
                    />
                  </svg>
                </span>
                {label}
              </span>
            ),
          });
        }
      }

      if (legendDensity === "full") {
        envelopes.forEach((env, idx) => {
          if (!env.legendLabel) return;
          items.push({
            key: `env-${idx}`,
            group: inferHoverMetricGroup(env.legendLabel),
            label: translateFixedLabel(locale, env.legendLabel),
            sourceLabel: env.legendLabel,
            node: (
              <span className="inline-flex items-center gap-1 farm-chart-fs-legend text-muted-foreground">
                <span
                  className="inline-block h-2 w-3 rounded-sm"
                  style={{
                    backgroundColor: env.fill,
                    opacity: Math.min(1, (env.fillOpacity ?? 0.22) * 2),
                  }}
                  aria-hidden
                />
                {translateFixedLabel(locale, env.legendLabel)}
              </span>
            ),
          });
        });
      }

      histograms.forEach((h, idx) => {
        if (!h.legendLabel) return;
        if (
          legendDensity !== "full" &&
          h.legendLabel !== "모터"
        ) {
          return;
        }
        items.push({
          key: `hist-${idx}`,
          group: inferHoverMetricGroup(h.legendLabel),
          label: translateFixedLabel(locale, h.legendLabel),
          sourceLabel: h.legendLabel,
          node: (
            <span className="inline-flex items-center gap-1 farm-chart-fs-legend text-muted-foreground">
              {h.style === "volume" ? (
                <span
                  className="inline-block h-2 w-3 rounded-sm"
                  style={{ backgroundColor: h.colorUp, opacity: 0.85 }}
                  aria-hidden
                />
              ) : (
                <span
                  className="inline-flex h-2 w-3 overflow-hidden rounded-sm"
                  aria-hidden
                >
                  <span
                    className="h-full w-1/2"
                    style={{ backgroundColor: h.colorUp }}
                  />
                  <span
                    className="h-full w-1/2"
                    style={{ backgroundColor: h.colorDown }}
                  />
                </span>
              )}
              {translateFixedLabel(locale, h.legendLabel)}
            </span>
          ),
        });
      });

      const GROUP_ORDER: HoverMetricGroup[] = ["temp", "hum", "motor"];
      const GROUP_ARIA: Record<HoverMetricGroup, string> = {
        temp: sheetCopy(locale, "chart.temp"),
        hum: sheetCopy(locale, "chart.humidity"),
        motor: sheetCopy(locale, "chart.motor"),
      };
      /** 그룹 안 표시 순서 */
      const LABEL_RANK: Record<HoverMetricGroup, string[]> = {
        temp: [
          "온도",
          CHANNEL_SLOT_LABELS.A,
          CHANNEL_SLOT_LABELS.B,
          CHANNEL_SLOT_LABELS.C,
          "온도 추세",
          "온도 산포",
          "온도 편차",
        ],
        hum: [
          "습도",
          "습도 추세",
          "습도 산포",
          "습도 편차",
          "습도 상한 접촉",
          "습도 하한 접촉",
        ],
        motor: [
          "모터",
          CHANNEL_SLOT_LABELS.A,
          CHANNEL_SLOT_LABELS.B,
          CHANNEL_SLOT_LABELS.C,
        ],
      };
      const rank = (group: HoverMetricGroup, label: string) => {
        const i = LABEL_RANK[group].indexOf(label);
        return i >= 0 ? i : 50;
      };

      const coverageLegend = [
        { kind: "sparse" as const, label: sheetCopy(locale, "chart.sparse"), fill: "var(--status-warn)", opacity: 0.55 },
        { kind: "offline" as const, label: sheetCopy(locale, "chart.commDown"), fill: "var(--status-danger)", opacity: 0.55 },
        { kind: "void" as const, label: sheetCopy(locale, "chart.none"), fill: "currentColor", opacity: 0.35 },
      ].filter((item) => coverageBands.some((b) => b.kind === item.kind));

      return (
        <>
          {GROUP_ORDER.map((group) => {
        const groupItems = items
          .filter((it) => it.group === group)
          .sort(
            (a, b) =>
              rank(group, a.sourceLabel) - rank(group, b.sourceLabel) ||
              a.label.localeCompare(b.label, locale),
          );
        if (groupItems.length === 0) return null;
        return (
          <div
            key={group}
            role="group"
            aria-label={GROUP_ARIA[group]}
            className="inline-flex flex-wrap items-center gap-x-2.5 gap-y-1"
            data-legend-group={group}
          >
            {groupItems.map((it) => (
              <Fragment key={it.key}>{it.node}</Fragment>
            ))}
          </div>
        );
          })}
          {eventLane?.statsLine ? (
            <div className="basis-full w-full min-w-0">
              <span className="inline-flex items-center farm-chart-fs-legend tabular-nums text-muted-foreground">
                {eventLane.label} · {eventLane.statsLine}
              </span>
            </div>
          ) : null}
          {coverageLegend.length > 0 ? (
            <div
              role="group"
              aria-label={sheetCopy(locale, "chart.coverage")}
              className="inline-flex flex-wrap items-center gap-x-2.5 gap-y-1"
            >
              {coverageLegend.map((item) => (
                <span
                  key={item.kind}
                  className="inline-flex items-center gap-1 farm-chart-fs-legend text-muted-foreground"
                >
                  <span
                    className="inline-block h-2 w-3 rounded-sm"
                    style={{
                      backgroundColor: item.fill,
                      opacity: item.opacity,
                    }}
                    aria-hidden
                  />
                  {item.label}
                </span>
              ))}
            </div>
          ) : null}
        </>
      );
    })() : null}
    {legendTrailing ? (
      <div className="ml-auto min-w-0 shrink-0">{legendTrailing}</div>
    ) : null}
  </div>
  );
}
