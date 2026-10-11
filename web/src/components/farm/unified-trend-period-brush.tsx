"use client";

import { useId, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import type { TrendPeriodId } from "@/lib/domain/farm-trend-types";
import {
  comfortScoreBandLabel,
  comfortScoreToColor,
} from "@/lib/farm/env-comfort-score";
import { downsampleTrendValues } from "@/lib/farm/trend-display-buckets";
import { trendPlotPadRatios } from "@/lib/farm/trend-chart-geometry";
import { motionClass } from "@/lib/ui/motion-classes";
import { isPrimaryPress } from "@/lib/ui/pointer-press";
import { cn } from "@/lib/utils";

/** 30d 컨텍스트 기준 — 우측(now) 정렬 윈도우 비율 (농장 기간 시드용) */
export const BRUSH_PERIOD_WINDOW: Record<
  TrendPeriodId,
  BrushWindow
> = {
  "30d": { start: 0, width: 1 },
  "7d": { start: 1 - 7 / 30, width: 7 / 30 },
  "24h": { start: 1 - 1 / 30, width: 1 / 30 },
};

const BRUSH_VIEW_H = 88;
const BRUSH_BASELINE = 82;
const BRUSH_MAX_BAR = 70;

export type BrushOverviewMode = "comfort" | "dual";

export function brushOverviewBarRect(value: number): { y: number; height: number } {
  const score = Math.max(0, Math.min(100, value));
  const height = Math.max(3, (score / 100) * BRUSH_MAX_BAR);
  return { y: BRUSH_BASELINE - height, height };
}

/** 이중 막대 — 같은 시각 칸을 위칸(왼쪽)·아래칸(오른쪽)으로 나눈다. */
export function brushGroupedBarSlot(
  index: number,
  count: number,
  padL: number,
  innerW: number,
): { a: { x: number; width: number }; b: { x: number; width: number } } {
  const n = Math.max(1, count);
  const slotW = (innerW * 100) / n;
  const outerGap = Math.min(0.22, slotW * 0.14);
  const pairGap = Math.min(0.14, slotW * 0.1);
  const inner = Math.max(0.5, slotW - outerGap);
  const barW = Math.max(0.26, (inner - pairGap) / 2);
  const x0 = (padL + (index / n) * innerW) * 100;
  return {
    a: { x: x0, width: barW },
    b: { x: x0 + barW + pairGap, width: barW },
  };
}

/** 드래그 없이 탭으로 판정하는 최대 폭(비율) */
const BRUSH_CLICK_SPAN = 0.02;

/** 최소 구간 — 약 6시간 (30일 트랙 기준) */
export const BRUSH_MIN_WIDTH = 6 / (30 * 24);

/** 휠 연속 룩백 — 한 칸마다 폭 배수. 오른쪽(지금)은 고정 */
export const BRUSH_WHEEL_ZOOM_FACTOR = 1.18;

export type BrushWindow = { start: number; width: number };

export type BrushHighlightWindow = BrushWindow;

export function clampBrushWindow(start: number, width: number): BrushWindow {
  const w = Math.min(1, Math.max(BRUSH_MIN_WIDTH, width));
  const s = Math.min(1 - w, Math.max(0, start));
  return { start: s, width: w };
}

/** 오른쪽 끝(지금)=1 고정. dir<0 확대(폭↓), dir>0 축소(폭↑). */
export function zoomBrushLookback(
  win: BrushWindow,
  dir: 1 | -1,
  factor = BRUSH_WHEEL_ZOOM_FACTOR,
): BrushWindow {
  const nextWidth = dir < 0 ? win.width / factor : win.width * factor;
  const width = Math.min(1, Math.max(BRUSH_MIN_WIDTH, nextWidth));
  return { start: 1 - width, width };
}

/** 칩 탭 — 24시간 ↔ 7일 ↔ 30일 (오른쪽 고정) */
export function cycleBrushLookbackPreset(win: BrushWindow): BrushWindow {
  const days = win.width * 30;
  if (days <= 2) return BRUSH_PERIOD_WINDOW["7d"];
  if (days <= 10) return BRUSH_PERIOD_WINDOW["30d"];
  return BRUSH_PERIOD_WINDOW["24h"];
}

/** 드래그 → 실구간. 거의 클릭이면 null — 호출측에서 창 이동. */
export function brushWindowFromDraft(
  a: number,
  b: number,
): BrushWindow | null {
  const span = Math.abs(b - a);
  if (span < BRUSH_CLICK_SPAN) return null;
  return clampBrushWindow(Math.min(a, b), span);
}

export function moveBrushWindow(
  win: BrushWindow,
  center: number,
): BrushWindow {
  return clampBrushWindow(center - win.width / 2, win.width);
}

export function displayPeriodFromBrushWindow(win: BrushWindow): TrendPeriodId {
  const days = win.width * 30;
  if (days <= 2) return "24h";
  if (days <= 10) return "7d";
  return "30d";
}

export function formatBrushWindowLabel(win: BrushWindow): string {
  const days = win.width * 30;
  const hours = days * 24;
  if (hours < 20) return `약 ${Math.max(1, Math.round(hours))}시간`;
  if (days < 1.6) return "약 1일";
  return `약 ${Math.round(days)}일`;
}

/** 휠 룩백 칩 — 「최근 N」 */
export function formatLookbackWindowLabel(win: BrushWindow): string {
  const days = win.width * 30;
  const hours = days * 24;
  if (hours < 20) return `최근 ${Math.max(1, Math.round(hours))}시간`;
  if (days < 1.6) return "최근 1일";
  return `최근 ${Math.round(days)}일`;
}

/** 차트 플롯과 같은 좌·우 패딩으로 브러시 막대·선택창을 맞춘다. */
export function brushPlotPad(labelGutter = false) {
  return trendPlotPadRatios({ leftUnit: true, labelGutter });
}

/** 트랙 가로 비율(0–1) → 데이터 구간 비율(패딩 제외). */
export function brushRatioFromTrackU(
  u: number,
  labelGutter = false,
): number {
  const pad = brushPlotPad(labelGutter);
  if (!(pad.innerW > 0) || !Number.isFinite(u)) return 0;
  return Math.min(1, Math.max(0, (u - pad.padL) / pad.innerW));
}

/** 데이터 구간 창 → 트랙 CSS % (차트 xFor와 같은 패딩). */
export function brushWindowCssPct(
  win: BrushWindow,
  labelGutter = false,
): { leftPct: number; widthPct: number } {
  const pad = brushPlotPad(labelGutter);
  return {
    leftPct: (pad.padL + win.start * pad.innerW) * 100,
    widthPct: win.width * pad.innerW * 100,
  };
}

/** 차트 X 스코프 → 브러시 선택창 안 하이라이트 (0~1) */
export function resolveBrushHighlightWindow(
  win: BrushWindow,
  xScope: { start: number; end: number } | null | undefined,
  chartPointCount: number,
): BrushHighlightWindow {
  if (!xScope || chartPointCount < 2) return win;

  const span = chartPointCount - 1;
  const i0 = Math.max(0, Math.min(xScope.start, xScope.end));
  const i1 = Math.min(span, Math.max(xScope.start, xScope.end));
  if (i1 <= i0) return win;

  const relStart = i0 / span;
  const relEnd = i1 / span;
  const relWidth = Math.max(0.02, relEnd - relStart);

  return {
    start: win.start + relStart * win.width,
    width: relWidth * win.width,
  };
}

function averageSparkScore(
  spark: (number | null)[],
  win: BrushWindow,
): number | null {
  const n = spark.length;
  if (n === 0) return null;
  const from = Math.max(0, Math.floor(win.start * n));
  const to = Math.min(n, Math.ceil((win.start + win.width) * n));
  let sum = 0;
  let count = 0;
  for (let i = from; i < to; i++) {
    const v = spark[i];
    if (v != null && Number.isFinite(v)) {
      sum += v;
      count += 1;
    }
  }
  return count > 0 ? sum / count : null;
}

function brushTimeHint(index: number, count: number): string {
  if (count <= 0) return "30일 구간";
  const frac = (index + 0.5) / count;
  const daysAgo = Math.round((1 - frac) * 30);
  if (daysAgo <= 0) return "최근";
  if (daysAgo >= 30) return "약 30일 전";
  return `약 ${daysAgo}일 전`;
}

function BrushScoreHoverBlock({
  label,
  score,
  color,
  band,
}: {
  label?: string;
  score: number;
  color: string;
  band: string;
}) {
  return (
    <div>
      {label ? (
        <p className="farm-chart-fs-legend font-medium text-muted-foreground">
          {label}
        </p>
      ) : null}
      <div className={cn(label ? "mt-0.5" : null, "flex items-baseline gap-1.5")}>
        <span
          className="text-xl font-bold tabular-nums leading-none tracking-tight"
          style={{ color }}
        >
          {Math.round(score)}
        </span>
        <span className="farm-chart-fs-legend text-muted-foreground">/ 100</span>
      </div>
      <div className="mt-1 flex items-center gap-1.5">
        <span
          className="size-2 shrink-0 rounded-sm"
          style={{ background: color }}
          aria-hidden
        />
        <span className="farm-chart-fs-meta font-semibold text-foreground">
          {band}
        </span>
      </div>
    </div>
  );
}

type HoverBar = {
  index: number;
  score: number | null;
  score2: number | null;
  /** 0~1 — 카드 가로 위치 */
  ratio: number;
};

type Props = {
  window: BrushWindow;
  onWindowChange: (next: BrushWindow) => void;
  /** 30일 환경 양호도(0~100). 한 칸 또는 위칸 */
  overviewValues?: (number | null)[];
  /** 두 칸일 때 아래칸 양호도 */
  overviewSecondaryValues?: (number | null)[] | null;
  overviewMode?: BrushOverviewMode;
  /** 차트 X 스코프 — 브러시 선택창 동기화 */
  xScope?: { start: number; end: number } | null;
  /** 현재 기간 차트 포인트 수 (스코프 인덱스 기준) */
  chartPointCount?: number;
  /** 공유 브러시가 영역 맨 위일 때 점수는 트랙 아래 */
  hoverPlacement?: "above" | "below";
  /** 모바일 차트와 같이 우측 거터가 넓을 때 */
  labelGutter?: boolean;
  className?: string;
};

/**
 * 30일 양호도 내비 — 드래그로 실구간, 탭으로 같은 폭 이동.
 * 차트는 선택 구간만 표시. 농장 24h/7d/30d 상태는 바꾸지 않음.
 */
export function UnifiedTrendPeriodBrush({
  window: winProp,
  onWindowChange,
  overviewValues = [],
  overviewSecondaryValues = null,
  overviewMode = "comfort",
  xScope = null,
  chartPointCount = 0,
  hoverPlacement = "above",
  labelGutter = false,
  className,
}: Props) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ a: number; b: number } | null>(null);
  const [draft, setDraft] = useState<{ a: number; b: number } | null>(null);
  const [hover, setHover] = useState<HoverBar | null>(null);
  const sheenId = `brush-track-sheen-${useId().replace(/:/g, "")}`;

  const spark = useMemo(() => {
    if (overviewValues.length <= 96) return overviewValues;
    return downsampleTrendValues(overviewValues, 96);
  }, [overviewValues]);
  const spark2 = useMemo(() => {
    if (overviewMode !== "dual" || overviewSecondaryValues == null) return [];
    if (overviewSecondaryValues.length <= 96) return overviewSecondaryValues;
    return downsampleTrendValues(overviewSecondaryValues, 96);
  }, [overviewMode, overviewSecondaryValues]);
  const dual = overviewMode === "dual" && spark2.length > 0;

  const win = useMemo(
    () => resolveBrushHighlightWindow(winProp, xScope, chartPointCount),
    [winProp, xScope, chartPointCount],
  );
  const scopedActive =
    xScope != null && chartPointCount >= 2 && win.width < winProp.width - 0.001;

  const windowLabel = formatBrushWindowLabel(winProp);
  const resolvedDraft =
    draft != null ? brushWindowFromDraft(draft.a, draft.b) : null;
  const activeWin = resolvedDraft ?? (draft != null ? winProp : win);
  const avgScore = useMemo(
    () => averageSparkScore(spark, activeWin),
    [spark, activeWin],
  );
  const avgScore2 = useMemo(
    () => (dual ? averageSparkScore(spark2, activeWin) : null),
    [dual, spark2, activeWin],
  );
  const draftWin =
    draft != null
      ? {
          start: Math.min(draft.a, draft.b),
          width: Math.max(BRUSH_MIN_WIDTH, Math.abs(draft.b - draft.a)),
        }
      : null;

  const plotPad = useMemo(() => brushPlotPad(labelGutter), [labelGutter]);
  const activeCss = brushWindowCssPct(activeWin, labelGutter);
  const draftCss =
    draftWin != null ? brushWindowCssPct(draftWin, labelGutter) : null;

  const ratioFromEvent = (clientX: number) => {
    const el = trackRef.current;
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0) return 0;
    const u = (clientX - rect.left) / rect.width;
    return brushRatioFromTrackU(u, labelGutter);
  };

  const updateHoverFromClientX = (clientX: number) => {
    if (dragRef.current || (spark.length === 0 && spark2.length === 0)) {
      setHover(null);
      return;
    }
    const r = ratioFromEvent(clientX);
    const n = Math.max(spark.length, spark2.length, 1);
    const index = Math.min(n - 1, Math.max(0, Math.floor(r * n)));
    const raw = spark[index];
    const raw2 = dual ? spark2[index] : null;
    const score =
      raw != null && Number.isFinite(raw)
        ? Math.max(0, Math.min(100, raw))
        : null;
    const score2 =
      raw2 != null && Number.isFinite(raw2)
        ? Math.max(0, Math.min(100, raw2))
        : null;
    if (score == null && score2 == null) {
      setHover(null);
      return;
    }
    setHover({
      index,
      score,
      score2,
      ratio: (index + 0.5) / n,
    });
  };

  const commitDraft = (a: number, b: number) => {
    const fromDrag = brushWindowFromDraft(a, b);
    onWindowChange(fromDrag ?? moveBrushWindow(winProp, a));
    setDraft(null);
    dragRef.current = null;
  };

  const hoverBand =
    hover?.score != null ? comfortScoreBandLabel(hover.score) : null;
  const hoverBand2 =
    hover?.score2 != null ? comfortScoreBandLabel(hover.score2) : null;
  const scoreLabel = dual
    ? `위 ${avgScore != null ? Math.round(avgScore) : "—"} · 아래 ${avgScore2 != null ? Math.round(avgScore2) : "—"}`
    : avgScore != null
      ? String(Math.round(avgScore))
      : "—";
  const hoverColor =
    hover?.score != null ? comfortScoreToColor(hover.score) : null;
  const hoverColor2 =
    hover?.score2 != null ? comfortScoreToColor(hover.score2) : null;

  return (
    <div
      className={cn("select-none", className)}
      data-tour-id="unified-trend-period-brush"
      data-farm-chart-period-nav=""
    >
      <div className="relative">
        {hover && (hoverBand || hoverBand2) ? (
          <div
            className={cn(
              hoverPlacement === "below"
                ? "pointer-events-none absolute top-[calc(100%+0.35rem)] z-20 w-max min-w-[7.5rem] -translate-x-1/2"
                : "pointer-events-none absolute bottom-[calc(100%+0.35rem)] z-20 w-max min-w-[7.5rem] -translate-x-1/2",
              "rounded-lg border border-border/80 bg-popover px-2.5 py-2 text-popover-foreground",
              "ring-1 ring-foreground/10",
            )}
            style={{
              left: `clamp(3.75rem, ${(plotPad.padL + hover.ratio * plotPad.innerW) * 100}%, calc(100% - 3.75rem))`,
            }}
            role="status"
            data-tour-id="unified-trend-brush-score-card"
          >
            <p className="farm-chart-fs-legend font-medium text-muted-foreground">
              환경 양호도
            </p>
            <div className={cn(dual ? "mt-1.5 flex flex-col gap-2" : "mt-0.5")}>
              {hover.score != null && hoverBand && hoverColor ? (
                <BrushScoreHoverBlock
                  label={dual ? "위칸" : undefined}
                  score={hover.score}
                  color={hoverColor}
                  band={hoverBand}
                />
              ) : null}
              {dual && hover.score2 != null && hoverBand2 && hoverColor2 ? (
                <BrushScoreHoverBlock
                  label="아래칸"
                  score={hover.score2}
                  color={hoverColor2}
                  band={hoverBand2}
                />
              ) : null}
            </div>
            <p className="mt-1 farm-chart-fs-legend leading-snug text-muted-foreground">
              {brushTimeHint(hover.index, Math.max(spark.length, spark2.length))}
            </p>
          </div>
        ) : null}

        <div
          ref={trackRef}
          className={cn(
            "relative h-[calc(5.5rem*2/3)] select-none overflow-hidden rounded-xl border border-border/80",
            "bg-gradient-to-b from-muted/50 via-muted/25 to-background/90",
            "shadow-[inset_0_1px_0_0_hsl(0_0%_100%/_0.04)]",
            "cursor-ew-resize touch-none",
          )}
          onPointerDown={(e) => {
            if (!isPrimaryPress(e)) return;
            setHover(null);
            e.currentTarget.setPointerCapture(e.pointerId);
            const r = ratioFromEvent(e.clientX);
            dragRef.current = { a: r, b: r };
            setDraft({ a: r, b: r });
          }}
          onPointerMove={(e) => {
            if (dragRef.current) {
              const r = ratioFromEvent(e.clientX);
              dragRef.current = { ...dragRef.current, b: r };
              setDraft({ a: dragRef.current.a, b: r });
              return;
            }
            updateHoverFromClientX(e.clientX);
          }}
          onPointerUp={(e) => {
            if (!dragRef.current) return;
            const r = ratioFromEvent(e.clientX);
            commitDraft(dragRef.current.a, r);
            updateHoverFromClientX(e.clientX);
          }}
          onPointerCancel={() => {
            setDraft(null);
            dragRef.current = null;
            setHover(null);
          }}
          onPointerLeave={() => {
            if (!dragRef.current) setHover(null);
          }}
          role="slider"
          tabIndex={0}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(winProp.start * 100)}
          aria-valuetext={`${windowLabel}${scopedActive ? " · 차트 스코프 구간" : ""} · 점수 ${scoreLabel}`}
          aria-label={`30일 구간 선택 ${windowLabel} · 드래그로 구간 · 탭으로 같은 폭 이동 · 우클릭으로 30일 전체`}
          title={`드래그: 구간 선택 · 탭: 같은 폭으로 이동 · 우클릭: 30일 전체${scopedActive ? " · 스코프 구간 표시" : ""}`}
          onContextMenu={(e) => {
            e.preventDefault();
            setDraft(null);
            dragRef.current = null;
            setHover(null);
            onWindowChange(BRUSH_PERIOD_WINDOW["30d"]);
          }}
          onKeyDown={(e) => {
            const step = 0.03;
            if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
              e.preventDefault();
              const dir = e.key === "ArrowLeft" ? -step : step;
              onWindowChange(
                clampBrushWindow(winProp.start + dir, winProp.width),
              );
              return;
            }
            if (e.key === "Home") {
              e.preventDefault();
              onWindowChange(clampBrushWindow(0, winProp.width));
              return;
            }
            if (e.key === "End") {
              e.preventDefault();
              onWindowChange(clampBrushWindow(1 - winProp.width, winProp.width));
            }
          }}
        >
          <svg
            viewBox={`0 0 100 ${BRUSH_VIEW_H}`}
            preserveAspectRatio="none"
            className="absolute inset-0 h-full w-full text-foreground"
            aria-hidden
          >
            <defs>
              <linearGradient id={sheenId} x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="0%"
                  stopColor="rgb(255 255 255)"
                  stopOpacity="0.06"
                />
                <stop
                  offset="100%"
                  stopColor="rgb(255 255 255)"
                  stopOpacity="0"
                />
              </linearGradient>
            </defs>
            <rect
              x={0}
              y={0}
              width={100}
              height={BRUSH_VIEW_H}
              fill={`url(#${sheenId})`}
            />
            {(() => {
              const n = Math.max(1, dual ? Math.max(spark.length, spark2.length) : spark.length);
              const bars: ReactNode[] = [];
              for (let i = 0; i < n; i++) {
                const v = spark[i];
                const v2 = dual ? spark2[i] : null;
                const delayMs = Math.min(480, Math.round((i / n) * 420));
                const active = hover?.index === i;
                const delayStyle = {
                  ["--farm-brush-bar-delay" as string]: `${delayMs}ms`,
                } as CSSProperties;
                if (dual) {
                  const slot = brushGroupedBarSlot(
                    i,
                    n,
                    plotPad.padL,
                    plotPad.innerW,
                  );
                  if (v != null && Number.isFinite(v)) {
                    const bar = brushOverviewBarRect(v);
                    bars.push(
                      <rect
                        key={`${i}-a`}
                        className={motionClass.farmChartBrushBar}
                        x={slot.a.x}
                        y={bar.y}
                        width={slot.a.width}
                        height={bar.height}
                        rx={Math.min(0.45, slot.a.width * 0.35)}
                        fill={comfortScoreToColor(Math.max(0, Math.min(100, v)))}
                        opacity={active ? 1 : 0.9}
                        style={delayStyle}
                      />,
                    );
                  }
                  if (v2 != null && Number.isFinite(v2)) {
                    const bar = brushOverviewBarRect(v2);
                    bars.push(
                      <rect
                        key={`${i}-b`}
                        className={motionClass.farmChartBrushBar}
                        x={slot.b.x}
                        y={bar.y}
                        width={slot.b.width}
                        height={bar.height}
                        rx={Math.min(0.45, slot.b.width * 0.35)}
                        fill={comfortScoreToColor(Math.max(0, Math.min(100, v2)))}
                        opacity={active ? 1 : 0.78}
                        style={delayStyle}
                      />,
                    );
                  }
                  continue;
                }
                if (v == null || !Number.isFinite(v)) continue;
                const x = (plotPad.padL + (i / n) * plotPad.innerW) * 100;
                const w = Math.max(0.55, (plotPad.innerW * 100) / n - 0.2);
                const bar = brushOverviewBarRect(v);
                bars.push(
                  <rect
                    key={i}
                    className={motionClass.farmChartBrushBar}
                    x={x}
                    y={bar.y}
                    width={w}
                    height={bar.height}
                    rx={Math.min(0.45, w * 0.35)}
                    fill={comfortScoreToColor(Math.max(0, Math.min(100, v)))}
                    opacity={active ? 1 : 0.88}
                    style={delayStyle}
                  />,
                );
              }
              return bars;
            })()}
            <line
              x1={plotPad.padL * 100}
              x2={(plotPad.padL + plotPad.innerW) * 100}
              y1={BRUSH_BASELINE - 0.75 * BRUSH_MAX_BAR}
              y2={BRUSH_BASELINE - 0.75 * BRUSH_MAX_BAR}
              stroke="currentColor"
              strokeOpacity={0.2}
              strokeDasharray="2 2.5"
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
            />
          </svg>

          <div
            className={cn(
              "pointer-events-none absolute inset-y-0 bg-background/70 backdrop-blur-[1px]",
              !draft && motionClass.farmChartBrushWindow,
            )}
            style={{
              left: 0,
              width: `${activeCss.leftPct}%`,
            }}
          />
          <div
            className={cn(
              "pointer-events-none absolute inset-y-0 bg-background/70 backdrop-blur-[1px]",
              !draft && motionClass.farmChartBrushWindow,
            )}
            style={{
              left: `${activeCss.leftPct + activeCss.widthPct}%`,
              right: 0,
            }}
          />

          {draftWin != null && resolvedDraft != null ? (
            <div
              className="pointer-events-none absolute inset-y-1 rounded-sm border border-dashed border-foreground/35 bg-foreground/5"
              style={{
                left: `${draftCss?.leftPct ?? 0}%`,
                width: `${draftCss?.widthPct ?? 0}%`,
              }}
              aria-hidden
            />
          ) : null}

          <div
            className={cn(
              "pointer-events-none absolute inset-y-0 border-y border-foreground/40",
              motionClass.farmChartBrushWindow,
              draft && resolvedDraft != null && "border-foreground/60",
            )}
            style={{
              left: `${activeCss.leftPct}%`,
              width: `${activeCss.widthPct}%`,
            }}
          >
            <span
              className="absolute inset-y-2 left-0 w-1 rounded-full bg-foreground/70"
              aria-hidden
            />
            <span
              className="absolute inset-y-2 right-0 w-1 rounded-full bg-foreground/70"
              aria-hidden
            />
          </div>

          {resolvedDraft != null ? (
            <span className="pointer-events-none absolute right-2 top-1.5 rounded border border-primary/40 bg-primary/90 px-1.5 py-0.5 farm-chart-fs-axis font-medium text-primary-foreground backdrop-blur-sm">
              {formatBrushWindowLabel(resolvedDraft)}
            </span>
          ) : draft ? (
            <span className="pointer-events-none absolute right-2 top-1.5 rounded border border-border/60 bg-background/90 px-1.5 py-0.5 farm-chart-fs-axis font-medium text-muted-foreground backdrop-blur-sm">
              탭→같은 폭 이동
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
