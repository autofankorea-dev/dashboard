"use client";

import { useState } from "react";
import { useAppNavigate } from "@/components/layout/use-app-navigate";
import { PanelCloseButton } from "@/components/farm/panel-close-button";
import { GridMetricLabel, gridMetricAriaLabel } from "@/lib/farm/grid-metric-label";
import { METRIC_ID_COLORS } from "@/lib/farm/trend-chart-series";
import {
  SEV_COLOR,
  SEV_LABEL,
  heatmapSevOpacity,
  severityScore,
  sevOfScore,
  type Band,
} from "@/lib/farm/severity-score";
import {
  computeStackMetricRows,
  currentStackMetricValue,
  formatStackMetricValue,
  worstStackMetricSev,
  type StackMetric,
  type StackMetricRowWithValues,
} from "@/lib/farm/stack-metric";
import { cn } from "@/lib/utils";
import { useSheetCopy } from "@/components/account/profile-sheet-prefs";
import { dashboardAffordance } from "@/lib/ui/dashboard-page-ui";

const CELL_H = 14; // 집계 히트맵 행 높이(px)
const MINI_CELL_H = 11; // 컨트롤러 미니 히트맵 행 높이(px)

/** 그리드 확대 시 표시할 컨트롤러 단위 히트맵 데이터. */
export type HeatController = {
  key: string;
  eqpmnNo: string;
  label: string;
  metrics: StackMetric[];
  href: string | null;
};

type Row = StackMetricRowWithValues;

function heatmapCellTitle(opts: {
  aggregationLabel: string;
  periodLabel?: string;
  metricLabel: string;
  value: number | null;
  unit?: string;
  sev: keyof typeof SEV_LABEL;
  controllerCount?: number;
  binIndex: number;
  binCount: number;
}): string {
  const parts = [
    opts.aggregationLabel,
    opts.periodLabel,
    opts.metricLabel,
    formatStackMetricValue(opts.value, opts.unit),
    SEV_LABEL[opts.sev],
    `구간 ${opts.binIndex + 1}/${opts.binCount}`,
  ].filter(Boolean);
  if (opts.controllerCount != null && opts.controllerCount > 0) {
    parts.push(`컨트롤러 ${opts.controllerCount}대`);
  }
  return parts.join(" · ");
}

/** 지표(행)×시간(열) 히트맵 셀. interactive면 라벨/셀 클릭으로 지표 선택. */
function HeatCells({
  rows,
  rowH,
  selected,
  onSelect,
  labelMode = "icon",
  aggregationLabel = "축사 평균",
  periodLabel,
  controllerCount,
}: {
  rows: Row[];
  rowH: number;
  selected?: string | null;
  onSelect?: (id: string) => void;
  labelMode?: "text" | "icon";
  aggregationLabel?: string;
  periodLabel?: string;
  controllerCount?: number;
}) {
  const interactive = Boolean(onSelect);
  return (
    <div className="flex items-stretch gap-1">
      <div className="flex flex-col justify-between py-px" aria-hidden>
        {rows.map((r) => {
          const active = selected === r.metric.id;
          const content = (
            <GridMetricLabel
              id={r.metric.id}
              label={r.metric.label}
              mode={labelMode}
              className={cn(
                labelMode === "text" && "text-[0.6rem] leading-none",
                active
                  ? "font-semibold text-primary"
                  : labelMode === "text"
                    ? "text-muted-foreground"
                    : undefined,
              )}
              iconClassName="size-3.5"
            />
          );
          const rowLabel = gridMetricAriaLabel(r.metric.id, r.metric.label);
          return interactive ? (
            <button
              key={r.metric.id}
              type="button"
              onClick={() => onSelect?.(r.metric.id)}
              style={{ height: rowH }}
              className={cn(
                "flex w-5 shrink-0 items-center justify-center rounded-sm transition-colors",
                dashboardAffordance.hitSurface,
                "hover:bg-muted hover:text-foreground",
              )}
              aria-label={rowLabel}
            >
              {content}
            </button>
          ) : (
            <div
              key={r.metric.id}
              style={{ height: rowH }}
              className="flex w-5 shrink-0 items-center justify-center"
              aria-label={rowLabel}
            >
              {content}
            </div>
          );
        })}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-px">
        {rows.map((r) => (
          <div key={r.metric.id} className="flex gap-px" style={{ height: rowH }}>
            {r.sevs.map((sev, i) =>
              interactive ? (
                <button
                  key={i}
                  type="button"
                  onClick={() => onSelect?.(r.metric.id)}
                  title={heatmapCellTitle({
                    aggregationLabel,
                    periodLabel,
                    metricLabel: r.metric.label,
                    value: r.binnedValues[i] ?? null,
                    unit: r.metric.unit,
                    sev,
                    controllerCount,
                    binIndex: i,
                    binCount: r.sevs.length,
                  })}
                  aria-label={`${r.metric.label} ${SEV_LABEL[sev]}`}
                  className={cn(
                    "min-w-0 flex-1 rounded-[1px] transition-opacity hover:opacity-100",
                    selected === r.metric.id && "ring-1 ring-inset ring-primary/50"
                  )}
                  style={{
                    background: SEV_COLOR[sev],
                    opacity: heatmapSevOpacity(sev),
                  }}
                />
              ) : (
                <div
                  key={i}
                  title={heatmapCellTitle({
                    aggregationLabel,
                    periodLabel,
                    metricLabel: r.metric.label,
                    value: r.binnedValues[i] ?? null,
                    unit: r.metric.unit,
                    sev,
                    controllerCount,
                    binIndex: i,
                    binCount: r.sevs.length,
                  })}
                  className={cn(
                    "min-w-0 flex-1 rounded-[1px]",
                    selected === r.metric.id && "ring-1 ring-inset ring-primary/40"
                  )}
                  style={{
                    background: SEV_COLOR[sev],
                    opacity: heatmapSevOpacity(sev),
                  }}
                />
              )
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/** 컨트롤러 1대 미니 히트맵 + 해당 컨트롤러로 이동. */
function ControllerMiniHeat({
  controller,
  bars,
  selected,
  onMove,
  moving: _moving,
  canMove,
  labelMode = "icon",
}: {
  controller: HeatController;
  bars?: number;
  selected: string | null;
  onMove: () => void;
  moving: boolean;
  canMove: boolean;
  labelMode?: "text" | "icon";
}) {
  const rows = computeStackMetricRows(controller.metrics, bars);
  const worst = worstStackMetricSev(rows);
  return (
    <div
      className={cn(
        "rounded-md border bg-background p-2",
        worst === "warning"
          ? "border-red-500/50"
          : worst === "caution"
            ? "border-amber-500/50"
            : "border-border"
      )}
    >
      <div className="mb-1 flex items-center gap-1.5">
        <span
          className="inline-block size-2 shrink-0 rounded-sm"
          style={{ background: SEV_COLOR[worst] }}
          aria-hidden
        />
        <span className="truncate text-[0.7rem] font-semibold">{controller.label}</span>
        <span className="shrink-0 text-[0.6rem] text-muted-foreground">EQP{controller.eqpmnNo}</span>
        <span className="ml-auto shrink-0">
          {canMove ? (
            <button
              type="button"
              onClick={onMove}
              className="rounded-full border border-[color-mix(in_oklch,var(--status-ok)_60%,transparent)] px-2 py-0.5 text-[0.6rem] font-semibold text-[var(--status-ok-on-canvas)] transition-colors hover:bg-[color-mix(in_oklch,var(--status-ok)_12%,transparent)]"
            >
              이동
            </button>
          ) : null}
        </span>
      </div>
      <HeatCells rows={rows} rowH={MINI_CELL_H} selected={selected} labelMode={labelMode} />
    </div>
  );
}

/** 결측 구간을 끊어 여러 폴리라인으로 분리해 그리는 라인 차트(집계 폴백 · 상세 스몰멀티플 공용). */
export function MetricLineChart({
  values,
  band,
  height = 112,
  color = "var(--channel-hum)",
}: {
  values: (number | null)[];
  band: Band | null;
  height?: number;
  /** 선 색 — 목록 그래프(TREND_CHART_COLORS)와 동일 팔레트 사용. */
  color?: string;
}) {
  const nums = values.filter((v): v is number => v != null && Number.isFinite(v));
  if (nums.length === 0) {
    return (
      <div className="flex h-24 items-center justify-center text-xs text-muted-foreground">
        데이터 없음
      </div>
    );
  }
  const W = 520;
  const H = height;
  const padY = 6;
  const lo = Math.min(band ? band.lo : Infinity, ...nums);
  const hi = Math.max(band ? band.hi : -Infinity, ...nums);
  const span = Math.max(0.001, hi - lo);
  const dLo = lo - span * 0.14;
  const dHi = hi + span * 0.14;
  const n = values.length;
  const x = (i: number) => (n > 1 ? (i / (n - 1)) * W : W / 2);
  const y = (v: number) => padY + (1 - (v - dLo) / (dHi - dLo)) * (H - padY * 2);
  const segments: string[] = [];
  let cur: string[] = [];
  values.forEach((v, i) => {
    if (v == null || !Number.isFinite(v)) {
      if (cur.length > 1) segments.push(cur.join(" "));
      cur = [];
      return;
    }
    cur.push(`${x(i)},${y(v)}`);
  });
  if (cur.length > 1) segments.push(cur.join(" "));
  const bandTop = band ? y(band.hi) : null;
  const bandBot = band ? y(band.lo) : null;
  let lastValidIdx = -1;
  for (let j = values.length - 1; j >= 0; j--) {
    const xv = values[j];
    if (xv != null && Number.isFinite(xv)) {
      lastValidIdx = j;
      break;
    }
  }
  return (
    <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label="지표 상세 추이" style={{ display: "block" }}>
      {band && bandTop != null && bandBot != null ? (
        <>
          <line x1={0} y1={bandTop} x2={W} y2={bandTop} stroke={SEV_COLOR.warning} strokeDasharray="4 3" strokeOpacity={0.65} vectorEffect="non-scaling-stroke" />
          <line x1={0} y1={bandBot} x2={W} y2={bandBot} stroke={SEV_COLOR.warning} strokeDasharray="4 3" strokeOpacity={0.65} vectorEffect="non-scaling-stroke" />
        </>
      ) : null}
      {segments.map((pts, i) => (
        <polyline key={i} points={pts} fill="none" stroke={color} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
      ))}
      {lastValidIdx >= 0
        ? (() => {
            const v = values[lastValidIdx]!;
            const sev = sevOfScore(severityScore(v, band));
            if (sev === "normal" || sev === "neutral") return null;
            return (
              <circle
                key={lastValidIdx}
                cx={x(lastValidIdx)}
                cy={y(v)}
                r={2.6}
                fill={SEV_COLOR[sev]}
              />
            );
          })()
        : null}
    </svg>
  );
}

type Props = {
  /** 집계(스톨 평균) 지표들 — 개요 히트맵. */
  metrics: StackMetric[];
  /** 표시 열 수 — 원본 버킷을 이 수로 묶는다(색 = 구간 내 최악). */
  bars?: number;
  /** 확대 시 표시할 컨트롤러 단위 히트맵(있으면 컨트롤러별 미니 히트맵, 없으면 집계 라인). */
  controllers?: HeatController[];
  /** 컨트롤러별 '이동' — 목록 뷰로 클라이언트 전환(그리드 딥링크 스트립 회피). 없으면 href router.push 폴백. */
  onOpenController?: (controller: HeatController) => void;
  /** 컨트롤러 데이터가 없을 때 집계 '컨트롤러 이동' 라우팅 대상. */
  controllerHref?: string | null;
  /**
   * 지표(행) 클릭을 상위로 보고 — 제공되면 내부 확대(미니 히트맵/라인)를 렌더하지 않고
   * 상위(그리드 하단 전체폭 상세 패널)에서 오버레이 그래프를 펼친다.
   */
  onExpand?: (metricId: string) => void;
  /** 상위 확대 모드에서 현재 선택(펼쳐진) 지표 — 셀 하이라이트용. */
  activeMetricId?: string | null;
  /** 히트맵 상단 집계 설명 (예: 축사 평균 · 24시간). */
  caption?: string;
  /** 행 라벨 — icon(기본) | text */
  labelMode?: "text" | "icon";
  periodLabel?: string;
  controllerCount?: number;
  className?: string;
};

/**
 * 심각도 히트맵 — 지표(행) × 시간(열).
 * 최신 열만 현재 알람 밴드로 채점하고, 과거 열은 미채점(neutral).
 * 이상 셀/행 클릭 시 하단에서 컨트롤러별 미니 히트맵이 인라인 모프로 확대된다.
 * (컨트롤러 데이터가 없으면 집계 라인 차트로 폴백)
 */
export function SeverityHeatmap({
  metrics,
  bars,
  controllers,
  onOpenController,
  controllerHref,
  onExpand,
  activeMetricId,
  caption,
  labelMode = "icon",
  periodLabel,
  controllerCount,
  className,
}: Props) {
  const { navigate, isPending } = useAppNavigate();
  const t = useSheetCopy();
  const [selected, setSelected] = useState<string | null>(null);
  const [seq, setSeq] = useState(0);

  const rows = computeStackMetricRows(metrics, bars);
  const worst = worstStackMetricSev(rows);
  const hasControllers = Boolean(controllers && controllers.length > 0);

  // 상위 확대 모드(onExpand)면 내부 상태 대신 상위가 선택을 관장한다.
  const external = Boolean(onExpand);
  const sel = external ? activeMetricId ?? null : selected;

  const select = (id: string) => {
    if (external) {
      onExpand?.(id);
      return;
    }
    setSelected((prev) => (prev === id ? null : id));
    setSeq((s) => s + 1);
  };

  const selMetric = selected ? metrics.find((m) => m.id === selected) ?? null : null;
  const selCur = selMetric ? currentStackMetricValue(selMetric.values) : null;

  const move = (href: string | null) => {
    if (!href) return;
    navigate(href, { message: t("nav.controller") });
  };

  return (
    <div className={cn("min-w-0", className)} data-tour-id="heatmap">
      {caption ? (
        <p className="mb-1 text-[0.65rem] text-muted-foreground">{caption}</p>
      ) : null}
      <HeatCells
        rows={rows}
        rowH={CELL_H}
        selected={sel}
        onSelect={select}
        labelMode={labelMode}
        aggregationLabel="축사 평균"
        periodLabel={periodLabel}
        controllerCount={controllerCount}
      />

      {!external && selected ? (
        <div className="overflow-hidden">
          <div key={seq} className="farm-heat-morph mt-1.5">
            {hasControllers ? (
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                {controllers!.map((c) => (
                  <ControllerMiniHeat
                    key={c.key}
                    controller={c}
                    bars={bars}
                    selected={selected}
                    moving={isPending}
                    canMove={Boolean(onOpenController) || Boolean(c.href)}
                    labelMode={labelMode}
                    onMove={() =>
                      onOpenController ? onOpenController(c) : move(c.href)
                    }
                  />
                ))}
              </div>
            ) : (
              <div className="rounded-md border bg-background p-2">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className="truncate text-[0.7rem] font-semibold">
                    {selMetric?.label} · 현재 {formatStackMetricValue(selCur, selMetric?.unit)}
                  </span>
                  <div className="flex shrink-0 items-center gap-1">
                    {controllerHref ? (
                      <button
                        type="button"
                        onClick={() => move(controllerHref)}
                        className="rounded-full border border-[color-mix(in_oklch,var(--status-ok)_60%,transparent)] px-2 py-0.5 text-[0.6rem] font-semibold text-[var(--status-ok-on-canvas)] transition-colors hover:bg-[color-mix(in_oklch,var(--status-ok)_12%,transparent)]"
                      >
                        컨트롤러 이동
                      </button>
                    ) : null}
                    <PanelCloseButton
                      size="sm"
                      onClick={() => setSelected(null)}
                    />
                  </div>
                </div>
                {selMetric ? (
                  <MetricLineChart
                    values={selMetric.values}
                    band={selMetric.band}
                    color={METRIC_ID_COLORS[selMetric.id] ?? "var(--channel-hum)"}
                  />
                ) : null}
              </div>
            )}
          </div>
        </div>
      ) : external && worst === "normal" && !sel ? null : (
        <div className="mt-1 flex items-center gap-1 text-[0.55rem] leading-none text-muted-foreground">
          <span className="inline-block size-1.5 rounded-sm" style={{ background: SEV_COLOR[worst] }} />
          {external && sel
            ? `${metrics.find((m) => m.id === sel)?.label ?? ""} 그래프 표시 중 · 다른 행 클릭 시 전환`
            : worst === "normal"
              ? "정상"
              : `${SEV_LABEL[worst]} 감지 · 셀 클릭 시 ${external ? "그래프" : "컨트롤러별"} 확대`}
        </div>
      )}
    </div>
  );
}
