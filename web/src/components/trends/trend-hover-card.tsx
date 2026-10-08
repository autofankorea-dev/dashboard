"use client";

import { Fragment } from "react";
import {
  ControllerAffiliationMarks,
  ControllerNoMark,
  StallUnitNoMark,
} from "@/components/farm/controller-no-marks";
import { cn } from "@/lib/utils";
import { motionClass } from "@/lib/ui/motion-classes";
import type {
  TrendBreachNavTarget,
  TrendEnvelope,
  TrendEventMark,
  TrendHistogram,
  TrendSeries,
} from "@/lib/data/trend-chart-types";
import {
  HOVER_GROUP_LABEL,
  formatHistHoverDisplay,
  formatLimitBreachDelta,
  formatTrendBandEdge,
  formatTrendHoverValue,
  inferHoverMetricGroup,
  splitSpreadZoneLabel,
  spreadControllerNo,
} from "./trend-chart-format";

function MiniSpark({
  values,
  color,
  variant = "line",
}: {
  values: (number | null)[];
  color: string;
  variant?: "line" | "bars";
}) {
  const finite = values
    .map((v, i) => ({ v, i }))
    .filter((x): x is { v: number; i: number } => x.v != null && Number.isFinite(x.v));
  if (finite.length < 2) return null;
  const ys = finite.map((x) => x.v);
  const min = Math.min(...ys);
  const max = Math.max(...ys);
  const span = max - min || 1;
  const w = 56;
  const h = 16;
  if (variant === "bars") {
    const barW = Math.max(2.5, (w - (finite.length - 1) * 1.5) / finite.length);
    return (
      <svg
        width={w}
        height={h}
        className="shrink-0 opacity-90"
        aria-hidden
      >
        {finite.map(({ v }, idx) => {
          const bh = Math.max(2, ((v - min) / span) * (h - 2));
          const x = idx * (barW + 1.5);
          return (
            <rect
              key={idx}
              x={x}
              y={h - bh}
              width={barW}
              height={bh}
              fill={color}
              opacity={0.35 + (idx / Math.max(1, finite.length - 1)) * 0.55}
              rx={0.5}
            />
          );
        })}
      </svg>
    );
  }
  const pts = finite
    .map(({ v }, idx) => {
      const x = (idx / (finite.length - 1)) * w;
      const y = h - ((v - min) / span) * (h - 2) - 1;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg
      width={w}
      height={h}
      className="shrink-0 opacity-90"
      aria-hidden
    >
      <polyline
        points={pts}
        fill="none"
        stroke={color}
        strokeWidth={1.4}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

function AlarmTrack({
  lo,
  hi,
  value,
  unit,
  color,
}: {
  lo: number;
  hi: number;
  value: number | null;
  unit: string;
  color: string;
}) {
  const span = hi - lo;
  const outside =
    value != null && Number.isFinite(value) && (value < lo || value > hi);
  const breachSide =
    value != null && Number.isFinite(value)
      ? value > hi
        ? ("high" as const)
        : value < lo
          ? ("low" as const)
          : null
      : null;
  const breachDelta =
    value != null && Number.isFinite(value) && breachSide === "high"
      ? value - hi
      : value != null && Number.isFinite(value) && breachSide === "low"
        ? lo - value
        : null;
  const breachDeltaText =
    breachDelta != null && breachSide != null
      ? formatLimitBreachDelta(breachDelta, unit, breachSide)
      : null;
  const thresholdEdge =
    breachSide === "high" ? hi : breachSide === "low" ? lo : null;

  /** 구간 안: 위치 핀. 이탈: 해당 한계 끝단에 고정 */
  const pct =
    value != null && Number.isFinite(value) && span > 0
      ? outside
        ? breachSide === "high"
          ? 100
          : 0
        : Math.max(0, Math.min(100, ((value - lo) / span) * 100))
      : null;

  return (
    <div className="mt-1.5 border-t border-border/60 pt-1.5">
      <div className="mb-0.5 flex items-center justify-between gap-2 farm-chart-fs-axis text-muted-foreground">
        {outside && thresholdEdge != null && breachDeltaText ? (
          <>
            <span className="tabular-nums" title="임계값">
              {formatTrendBandEdge(thresholdEdge, unit)}
            </span>
            <span className="font-medium text-amber-600 dark:text-amber-400">
              한계 이탈
            </span>
            <span
              className="tabular-nums font-medium text-amber-600 dark:text-amber-400"
              title="이탈량"
            >
              {breachDeltaText}
            </span>
          </>
        ) : (
          <>
            <span className="tabular-nums">
              {formatTrendBandEdge(lo, unit)}
            </span>
            <span>알람 구간</span>
            <span className="tabular-nums">
              {formatTrendBandEdge(hi, unit)}
            </span>
          </>
        )}
      </div>
      <div className="relative h-1.5 rounded-sm bg-muted/80">
        {pct != null ? (
          <span
            className={cn(
              "absolute top-1/2 h-2.5 w-0.5 -translate-x-1/2 -translate-y-1/2 rounded-full",
              motionClass.farmChartAlarmPin,
            )}
            style={{ left: `${pct}%`, backgroundColor: color }}
          />
        ) : null}
      </div>
    </div>
  );
}

function MotorChannelMatrix({
  channels,
  hoverIdx,
}: {
  channels: NonNullable<TrendHistogram["hoverChannels"]>;
  hoverIdx: number;
}) {
  return (
    <div className="mt-1.5 space-y-1">
      {channels.map((ch) => {
        const raw = ch.values[hoverIdx];
        const pct =
          raw != null && Number.isFinite(raw)
            ? Math.max(0, Math.min(100, raw))
            : null;
        /** 데이터 카드 — 짧은 슬롯명 (1차/2차/3차 또는 레거시 A/B/C) */
        const tipLabel = ch.label.replace(/^채널\s*/, "") || ch.label;
        return (
          <div
            key={ch.label}
            className="flex items-center gap-1.5 farm-chart-fs-legend"
          >
            <span className="w-3 shrink-0 font-medium tabular-nums text-muted-foreground">
              {tipLabel}
            </span>
            <div className="h-1 min-w-0 flex-1 overflow-hidden rounded-sm bg-muted/80">
              <div
                className={cn(
                  "h-full rounded-sm",
                  motionClass.farmChartChannelBar,
                )}
                style={{
                  width: pct != null ? `${pct}%` : "0%",
                  backgroundColor: ch.color,
                  opacity: 0.75,
                }}
              />
            </div>
            <span className="w-7 shrink-0 text-right font-medium tabular-nums">
              {pct != null ? Math.round(pct) : "–"}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function TrendPointCardBody({
  idx,
  seriesKey,
  categories,
  series,
  envelopes,
  histograms,
  leftUnit,
  rightUnit,
  hideTime = false,
  onBreachEquipmentNavigate: _onBreachEquipmentNavigate,
}: {
  idx: number;
  seriesKey: string | null;
  categories: string[];
  series: TrendSeries[];
  envelopes: TrendEnvelope[];
  histograms: TrendHistogram[];
  leftUnit: string;
  rightUnit: string;
  /** 병합 카드 2번째 섹션 등에서 상단 시각(카테고리) 중복 표기 숨김 */
  hideTime?: boolean;
  onBreachEquipmentNavigate?: (target: TrendBreachNavTarget) => void;
}) {
  const group = seriesKey ? inferHoverMetricGroup(seriesKey) : null;
  const tipSeries = series.filter(
    (s) => group == null || inferHoverMetricGroup(s.name) === group,
  );
  const tipHists = histograms.filter((h) => {
    const label = h.legendLabel ?? "편차";
    return group == null || inferHoverMetricGroup(label) === group;
  });
  const sparkSeries =
    tipSeries.find((s) => s.name === seriesKey) ?? tipSeries[0];
  const sparkHist =
    tipHists.find((h) => (h.legendLabel ?? "") === seriesKey) ?? tipHists[0];
  const sparkColor = sparkSeries?.color ?? sparkHist?.colorUp ?? "var(--muted-foreground)";
  const sparkSrc =
    sparkSeries?.hoverSecondary ??
    sparkSeries?.data ??
    sparkHist?.hoverSecondary ??
    sparkHist?.values ??
    [];
  const sparkSlice = sparkSrc.slice(Math.max(0, idx - 7), idx + 1);

  const heroSeries =
    tipSeries.find((s) => s.name === seriesKey) ??
    tipSeries.find((s) =>
      group === "temp"
        ? s.name === "온도"
        : group === "hum"
          ? s.name === "습도"
          : false,
    ) ??
    (group === "motor" ? undefined : tipSeries[0]);

  const motorChannels: NonNullable<TrendHistogram["hoverChannels"]> = (() => {
    if (group !== "motor") return [];
    const fromMeta =
      tipHists.find((h) => h.hoverChannels?.length)?.hoverChannels ?? [];
    if (fromMeta.length) return fromMeta;
    return tipHists
      .filter((h) => {
        const lab = h.legendLabel ?? "";
        return (
          lab === "A" ||
          lab === "B" ||
          lab === "C" ||
          lab === "1차" ||
          lab === "2차" ||
          lab === "3차" ||
          /입기|배기|송풍/.test(lab)
        );
      })
      .map((h) => ({
        label: h.legendLabel!,
        color: h.colorUp,
        values: h.hoverSecondary ?? h.values,
      }));
  })();
  const showMotorMatrix = group === "motor" && motorChannels.length > 0;

  let heroHist =
    tipHists.find((h) => (h.legendLabel ?? "") === seriesKey) ??
    tipHists.find((h) => (h.legendLabel ?? "") === "모터") ??
    (group === "motor" ? tipHists[0] : undefined);
  if (group === "motor") {
    heroHist =
      tipHists.find((h) => (h.legendLabel ?? "") === "모터") ??
      tipHists.find((h) => h.hoverChannels?.length) ??
      tipHists[0];
  }

  let heroLabel = group ? HOVER_GROUP_LABEL[group] : "데이터";
  let heroText = "–";
  let heroUnit = "";
  let heroNum: number | null = null;
  let heroColor = sparkColor;

  if (group === "motor" && showMotorMatrix) {
    const vals = motorChannels
      .map((ch) => ch.values[idx])
      .filter((v): v is number => v != null && Number.isFinite(v));
    if (vals.length) {
      heroNum = Math.max(...vals);
      heroUnit = "%";
      heroText = `${Math.round(heroNum)}%`;
      heroLabel = "모터 max";
      heroColor =
        tipHists.find((h) => (h.legendLabel ?? "") === "모터")?.colorUp ??
        motorChannels[0]?.color ??
        sparkColor;
    }
  } else if (heroSeries) {
    const unit =
      (heroSeries.axis ?? "left") === "right" ? rightUnit : leftUnit;
    const sec = heroSeries.hoverSecondary?.[idx];
    const v = heroSeries.data[idx];
    if (sec != null && Number.isFinite(sec) && heroSeries.hoverSecondaryUnit) {
      heroNum = sec;
      heroUnit = heroSeries.hoverSecondaryUnit;
      heroText = formatTrendHoverValue(
        sec,
        heroSeries.hoverSecondaryUnit,
        heroSeries.name,
      );
    } else if (v != null && Number.isFinite(v)) {
      heroNum = v;
      heroUnit = unit;
      heroText = formatTrendHoverValue(v, unit, heroSeries.name);
    }
    heroLabel = heroSeries.name;
    heroColor = heroSeries.color;
  } else if (heroHist) {
    const sec = heroHist.hoverSecondary?.[idx];
    heroText = formatHistHoverDisplay(heroHist, idx);
    if (sec != null && Number.isFinite(sec)) {
      heroNum = sec;
      heroUnit = heroHist.hoverSecondaryUnit ?? "";
    }
    heroLabel =
      group === "motor" || heroHist.legendLabel === "모터"
        ? "모터 max"
        : (heroHist.legendLabel ?? "값");
    heroColor = heroHist.colorUp;
  }

  const heroKey = heroSeries?.name ?? heroHist?.legendLabel ?? "";
  const heroNote = heroSeries?.hoverNote?.[idx] ?? null;

  const secondarySeries = tipSeries.filter((s) => {
    if (s.name === heroKey) return false;
    if (s.markerOnly) return Boolean(s.hoverNote?.[idx]);
    return true;
  });

  const alarmMeta =
    group === "temp" || group === "hum"
      ? tipSeries.find((s) => s.hoverAlarmBand)?.hoverAlarmBand
      : undefined;

  const spreadExtremes =
    group === "temp" || group === "hum"
      ? (tipSeries.find((s) => s.hoverSpreadExtremes)?.hoverSpreadExtremes ??
        envelopes.find(
          (e) =>
            e.hoverExtremes &&
            e.legendLabel === (group === "temp" ? "온도 산포" : "습도 산포"),
        )?.hoverExtremes)
      : undefined;
  const spreadHigh = spreadExtremes?.high[idx] ?? null;
  const spreadLow = spreadExtremes?.low[idx] ?? null;
  const showSpreadHigh = Boolean(spreadHigh?.breached);
  const showSpreadLow = Boolean(spreadLow?.breached);
  const spreadSame =
    showSpreadHigh &&
    showSpreadLow &&
    spreadHigh != null &&
    spreadLow != null &&
    spreadHigh.zoneLabel === spreadLow.zoneLabel &&
    spreadHigh.equipmentLabel === spreadLow.equipmentLabel;
  const formatSpreadRow = (c: NonNullable<typeof spreadHigh>) => {
    const zone = splitSpreadZoneLabel(c.zoneLabel);
    const ctrlNo = spreadControllerNo(c.equipmentLabel);
    return (
      <>
        {zone.stallNo ? (
          <>
            {zone.prefix ? <span>{zone.prefix}</span> : null}
            <StallUnitNoMark stallNo={zone.stallNo} />
          </>
        ) : (
          <span>{c.zoneLabel}</span>
        )}
        {ctrlNo ? (
          <ControllerNoMark eqpmnNo={ctrlNo} />
        ) : (
          <span>{c.equipmentLabel}</span>
        )}
      </>
    );
  };

  const secondaryHists = tipHists.filter((h) => {
    const lab = h.legendLabel ?? "";
    if (lab === heroKey) return false;
    if (showMotorMatrix && (lab === "모터" || /^[ABC]$/.test(lab))) {
      return false;
    }
    return true;
  });

  const heroMain = heroText.replace(
    new RegExp(`${heroUnit.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`),
    "",
  );

  return (
    <>
      <div className="mb-1 flex items-center gap-1.5">
        <span className="rounded-sm bg-muted/80 px-1 py-px farm-chart-fs-axis font-semibold tracking-tight text-foreground/90">
          {group ? HOVER_GROUP_LABEL[group] : "데이터"}
        </span>
        {hideTime ? null : (
          <span className="farm-chart-fs-legend text-muted-foreground tabular-nums">
            {categories[idx]}
          </span>
        )}
        <div className="ml-auto">
          <MiniSpark
            values={sparkSlice}
            color={sparkColor}
            variant={group === "motor" ? "bars" : "line"}
          />
        </div>
      </div>

      <div
        className={cn(
          "flex items-baseline gap-0.5",
          motionClass.farmChartTipHero,
        )}
        key={`hero-${heroKey}-${idx}`}
      >
        <span
          className="text-[18px] font-semibold leading-none tabular-nums tracking-tight"
          style={{ color: heroColor }}
        >
          {heroMain || "–"}
        </span>
        {heroUnit ? (
          <span className="farm-chart-fs-legend font-medium text-muted-foreground">
            {heroUnit}
            {heroLabel === "모터 max" ? " max" : ""}
          </span>
        ) : null}
      </div>

      {heroNote ? (
        <div className="mt-1 space-y-0.5 farm-chart-fs-legend text-muted-foreground">
          {heroNote.split("\n").map((line) => (
            <div key={line} className="tabular-nums">
              {line}
            </div>
          ))}
        </div>
      ) : null}

      {(secondarySeries.length > 0 || secondaryHists.length > 0) &&
      !showMotorMatrix ? (
        <div className="mt-1.5 space-y-0.5">
          {secondarySeries.map((s) => {
            const note = s.hoverNote?.[idx];
            if (note) {
              return (
                <div key={s.name} className="space-y-0.5 farm-chart-fs-legend">
                  {note.split("\n").map((line) => (
                    <div
                      key={line}
                      className="flex items-start justify-between gap-2"
                    >
                      <span className="inline-flex min-w-0 items-center gap-1">
                        <span
                          className="inline-block h-1.5 w-1.5 shrink-0 rounded-sm"
                          style={{ backgroundColor: s.color }}
                        />
                        <span className="tabular-nums text-muted-foreground">
                          {line}
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
              );
            }
            const unit =
              (s.axis ?? "left") === "right" ? rightUnit : leftUnit;
            const sec = s.hoverSecondary?.[idx];
            const v = s.data[idx];
            const mappedPrimary =
              v == null || !Number.isFinite(v)
                ? "–"
                : formatTrendHoverValue(v, unit, s.name);
            const display =
              sec != null && Number.isFinite(sec) && s.hoverSecondaryUnit
                ? formatTrendHoverValue(sec, s.hoverSecondaryUnit, s.name)
                : mappedPrimary;
            return (
              <div
                key={s.name}
                className="flex items-center justify-between gap-2 farm-chart-fs-legend"
              >
                <span className="inline-flex min-w-0 items-center gap-1">
                  <span
                    className="inline-block h-1.5 w-1.5 shrink-0 rounded-sm"
                    style={{ backgroundColor: s.color }}
                  />
                  <span className="truncate text-muted-foreground">
                    {s.name}
                  </span>
                </span>
                <span className="shrink-0 tabular-nums">{display}</span>
              </div>
            );
          })}
          {secondaryHists.map((h, hi) => {
            const chartV = h.values[idx];
            const up =
              chartV != null && Number.isFinite(chartV)
                ? chartV >= h.baseline
                : true;
            return (
              <div
                key={`hist-tip-${hi}`}
                className="flex items-center justify-between gap-2 farm-chart-fs-legend"
              >
                <span className="inline-flex min-w-0 items-center gap-1">
                  <span
                    className="inline-block h-1.5 w-1.5 shrink-0 rounded-sm"
                    style={{
                      backgroundColor:
                        h.style === "volume" || up ? h.colorUp : h.colorDown,
                    }}
                  />
                  <span className="truncate text-muted-foreground">
                    {h.legendLabel ?? "편차"}
                  </span>
                </span>
                <span className="shrink-0 tabular-nums">
                  {formatHistHoverDisplay(h, idx)}
                </span>
              </div>
            );
          })}
        </div>
      ) : null}

      {showMotorMatrix ? (
        <MotorChannelMatrix channels={motorChannels} hoverIdx={idx} />
      ) : null}

      {showSpreadHigh || showSpreadLow ? (
        <div className="mt-1.5 space-y-1 border-t border-border/50 pt-1.5">
          <div className="farm-chart-fs-axis font-medium text-muted-foreground">
            임계 초과 구간
          </div>
          {spreadSame && spreadHigh ? (
            <div className="farm-chart-fs-legend flex flex-wrap items-center gap-x-1 leading-snug text-foreground/90">
              <span className="text-muted-foreground">산포 ·</span>
              {formatSpreadRow(spreadHigh)}
            </div>
          ) : (
            <>
              {showSpreadHigh && spreadHigh ? (
                <div className="farm-chart-fs-legend flex flex-wrap items-center gap-x-1 leading-snug text-foreground/90">
                  <span className="text-muted-foreground">상단 ·</span>
                  {formatSpreadRow(spreadHigh)}
                </div>
              ) : null}
              {showSpreadLow && spreadLow ? (
                <div className="farm-chart-fs-legend flex flex-wrap items-center gap-x-1 leading-snug text-foreground/90">
                  <span className="text-muted-foreground">하단 ·</span>
                  {formatSpreadRow(spreadLow)}
                </div>
              ) : null}
            </>
          )}
        </div>
      ) : null}

      {alarmMeta ? (
        <AlarmTrack
          lo={alarmMeta.lo}
          hi={alarmMeta.hi}
          value={heroNum}
          unit={alarmMeta.unit}
          color={heroColor}
        />
      ) : null}
    </>
  );
}

/** 명령 적중 등 이벤트 점 — 추이 데이터 카드와 같은 타이포·셸 */
export function TrendEventCardBody({ mark }: { mark: TrendEventMark }) {
  const card = mark.card;
  const heroColor =
    card.heroTone === "ok" ? "var(--status-ok-ink)" : undefined;
  return (
    <>
      <div className="mb-1 flex items-center gap-1.5">
        <span className="rounded-sm bg-muted/80 px-1 py-px farm-chart-fs-axis font-semibold tracking-tight text-foreground/90">
          {card.badge}
        </span>
        <span className="farm-chart-fs-legend text-muted-foreground tabular-nums">
          {card.time}
        </span>
      </div>
      <div
        className={cn(
          "flex items-baseline gap-2",
          motionClass.farmChartTipHero,
        )}
      >
        <span
          className="text-[18px] font-semibold leading-none tabular-nums tracking-tight"
          style={heroColor ? { color: heroColor } : undefined}
        >
          {card.hero}
        </span>
        {card.values && card.values.length > 0 ? (
          <span className="farm-chart-fs-legend font-medium tabular-nums text-foreground">
            {card.values[0]}
          </span>
        ) : null}
      </div>
      {card.values && card.values.length > 1 ? (
        <div className="mt-0.5 flex flex-col items-start gap-0.5 farm-chart-fs-legend font-medium tabular-nums text-foreground">
          {card.values.slice(1).map((v, i) => (
            <span key={i}>{v}</span>
          ))}
        </div>
      ) : !card.values && card.rows.length > 0 ? (
        <div className="mt-1.5 space-y-0.5">
          {card.rows.map((row) => (
            <div
              key={row.label}
              className="flex items-center justify-between gap-2 farm-chart-fs-legend"
            >
              <span className="truncate text-muted-foreground">
                {row.label}
              </span>
              <span
                className={cn(
                  "shrink-0 font-medium tabular-nums",
                  row.label === "단계" && card.heroTone === "ok"
                    ? "text-[var(--status-ok-ink)]"
                    : "text-foreground",
                )}
              >
                {row.value}
              </span>
            </div>
          ))}
        </div>
      ) : null}

      {card.target ? (
        <div className="mt-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 border-t border-border/50 pt-1.5 farm-chart-fs-legend text-foreground/90">
          <ControllerAffiliationMarks
            stallTyCode={card.target.stallTyCode ?? undefined}
            stallNo={card.target.stallNo ?? undefined}
            eqpmnNo={card.target.eqpmnNo}
          />
          {card.target.channel ? (
            <span className="font-semibold text-channel-info">
              {card.target.channel}
            </span>
          ) : null}
        </div>
      ) : card.footnote ? (
        <div className="mt-1 border-t border-border/50 pt-1 farm-chart-fs-legend text-muted-foreground">
          {card.footnote}
        </div>
      ) : null}
    </>
  );
}

const OVERLAY_MERGE_KEYS = ["온도", "습도", "모터"] as const;

function overlayMergeSectionKeys(
  series: TrendSeries[],
  histograms: TrendHistogram[],
): (typeof OVERLAY_MERGE_KEYS)[number][] {
  return OVERLAY_MERGE_KEYS.filter((key) => {
    const group = inferHoverMetricGroup(key);
    return (
      series.some((s) => inferHoverMetricGroup(s.name) === group) ||
      histograms.some(
        (h) => inferHoverMetricGroup(h.legendLabel ?? "") === group,
      )
    );
  });
}

/** 오버레이 hover/핀 — 온도·습도·모터 카드를 한 장으로 이어 붙인다. */
export function OverlayMergedPointCards({
  idx,
  categories,
  series,
  envelopes,
  histograms,
  leftUnit,
  rightUnit,
  onBreachEquipmentNavigate,
}: Omit<Parameters<typeof TrendPointCardBody>[0], "seriesKey" | "hideTime">) {
  const keys = overlayMergeSectionKeys(series, histograms);
  return (
    <>
      {keys.map((key, i) => (
        <Fragment key={key}>
          {i > 0 ? (
            <div className="my-1.5 border-t border-border/50" />
          ) : null}
          <TrendPointCardBody
            idx={idx}
            seriesKey={key}
            categories={categories}
            series={series}
            envelopes={envelopes}
            histograms={histograms}
            leftUnit={leftUnit}
            rightUnit={rightUnit}
            hideTime={i > 0}
            onBreachEquipmentNavigate={onBreachEquipmentNavigate}
          />
        </Fragment>
      ))}
    </>
  );
}
