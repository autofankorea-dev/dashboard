/**
 * 추이 차트 SVG — 결정적(순수) 배경/오버레이 레이어.
 *
 * 상태·ref·이벤트 핸들러가 없는, 데이터+기하 매퍼만으로 그려지는 레이어를
 * `trend-chart.tsx`에서 1:1 분리한다. (호버 십자선·핀·드래그 라벨 등 상호작용
 * 레이어는 ref/상태 결합이 강해 컴포넌트에 유지)
 *
 * 각 컴포넌트는 Fragment로 동일 key의 SVG 엘리먼트 배열을 반환 — DOM 출력·키가
 * 기존과 완전히 동일하다.
 */
import { Fragment } from "react";
import { cn } from "@/lib/utils";
import type { Band } from "@/lib/farm/severity-score";
import { SEV_COLOR } from "@/lib/farm/severity-score";
import type { UplinkCoverageBand } from "@/lib/farm/trend-uplink-coverage";
import type { TrendAxis, TrendReferenceLine } from "@/lib/domain/trend-chart-types";
import { PAD_TOP } from "./trend-chart-geometry";

/** 렌더 시점 기하 매퍼·치수 — 컴포넌트에서 주입 */
export type TrendPlotGeom = {
  xFor: (i: number) => number;
  yFor: (value: number, axis: TrendAxis) => number;
  padL: number;
  padR: number;
  viewW: number;
  innerW: number;
  innerH: number;
  n: number;
};

/** 업링크 커버리지 밴드(sparse/offline/void) 배경 rect */
export function CoverageBandsLayer({
  bands,
  geom,
}: {
  bands: UplinkCoverageBand[];
  geom: TrendPlotGeom;
}) {
  const { xFor, padL, padR, viewW, innerW, innerH, n } = geom;
  return (
    <Fragment>
      {bands.map((g) => {
        const x0 = xFor(g.i0);
        const x1 = xFor(g.i1);
        const slot = n > 1 ? innerW / (n - 1) : innerW;
        const left = Math.max(padL, x0 - slot / 2);
        const right = Math.min(viewW - padR, x1 + slot / 2);
        const fill =
          g.kind === "sparse"
            ? "var(--status-warn)"
            : g.kind === "offline"
              ? "var(--status-danger)"
              : "currentColor";
        const fillOpacity =
          g.kind === "sparse" ? 0.16 : g.kind === "offline" ? 0.2 : 0.1;
        return (
          <rect
            key={`cov-${g.kind}-${g.i0}-${g.i1}`}
            x={left}
            y={PAD_TOP}
            width={Math.max(0.4, right - left)}
            height={innerH}
            fill={fill}
            fillOpacity={fillOpacity}
            stroke="none"
            className={g.kind === "void" ? "text-muted-foreground" : undefined}
          />
        );
      })}
    </Fragment>
  );
}

/** null 구간(끊긴 데이터) 회색 rect */
export function NullGapsLayer({
  gaps,
  geom,
}: {
  gaps: { i0: number; i1: number }[];
  geom: TrendPlotGeom;
}) {
  const { xFor, padL, padR, viewW, innerW, innerH, n } = geom;
  return (
    <Fragment>
      {gaps.map((g) => {
        const x0 = xFor(g.i0);
        const x1 = xFor(g.i1);
        const slot = n > 1 ? innerW / (n - 1) : innerW;
        const left = Math.max(padL, x0 - slot / 2);
        const right = Math.min(viewW - padR, x1 + slot / 2);
        return (
          <rect
            key={`null-gap-${g.i0}-${g.i1}`}
            x={left}
            y={PAD_TOP}
            width={Math.max(0.4, right - left)}
            height={innerH}
            fill="#64748b"
            fillOpacity={0.18}
            stroke="none"
          />
        );
      })}
    </Fragment>
  );
}

/** 밴드 분할 가이드(수평 점선) */
export function BandGuidesLayer({
  guides,
  geom,
}: {
  guides: { key: string; value: number; className?: string }[];
  geom: TrendPlotGeom;
}) {
  const { yFor, padL, padR, viewW } = geom;
  return (
    <Fragment>
      {guides.map((guide) => {
        if (!Number.isFinite(guide.value)) return null;
        const y = yFor(guide.value, "left");
        if (!Number.isFinite(y)) return null;
        return (
          <line
            key={guide.key}
            x1={padL}
            x2={viewW - padR}
            y1={y}
            y2={y}
            stroke="currentColor"
            strokeWidth={0.4}
            strokeDasharray="2.5 3"
            vectorEffect="non-scaling-stroke"
            className={cn("text-muted-foreground", guide.className)}
            opacity={0.35}
          />
        );
      })}
    </Fragment>
  );
}

/** 알람·범위 밴드 창 — fillWindow=false면 채움 없음 */
export function AlarmBandsLayer({
  bands,
  geom,
}: {
  bands: {
    band: Band;
    axis: TrendAxis;
    color?: string;
    fillWindow?: boolean;
    fillOpacity?: number;
    id?: string;
  }[];
  geom: TrendPlotGeom;
}) {
  const { yFor, padL, padR, viewW } = geom;
  return (
    <Fragment>
      {bands.map(({ band, axis, color, fillWindow, fillOpacity, id }, idx) => {
        if (fillWindow === false) return null;
        const yTop = yFor(band.hi, axis);
        const yBot = yFor(band.lo, axis);
        const y = Math.min(yTop, yBot);
        const h = Math.max(2, Math.abs(yBot - yTop));
        const fill = color ?? SEV_COLOR.warning;
        return (
          <g key={id ?? `alarm-${idx}`} pointerEvents="none">
            <rect
              x={padL}
              y={y}
              width={Math.max(0, viewW - padR - padL)}
              height={h}
              fill={fill}
              fillOpacity={fillOpacity ?? 0.14}
              stroke="none"
              data-farm-alarm-range={id}
            />
          </g>
        );
      })}
    </Fragment>
  );
}

/** 참조선(referenceLines — 알람 모서리 중복 제거 후) */
export function ReferenceLinesLayer({
  lines,
  geom,
}: {
  lines: TrendReferenceLine[];
  geom: TrendPlotGeom;
}) {
  const { yFor, padL, padR, viewW } = geom;
  return (
    <Fragment>
      {lines.map((ref, idx) => {
        const y = yFor(ref.value, ref.axis ?? "left");
        if (!Number.isFinite(y)) return null;
        return (
          <line
            key={`ref-${idx}`}
            x1={padL}
            x2={viewW - padR}
            y1={y}
            y2={y}
            stroke={ref.color}
            strokeWidth={0.5}
            strokeDasharray="2 1.5"
            vectorEffect="non-scaling-stroke"
            opacity={0.7}
          />
        );
      })}
    </Fragment>
  );
}
