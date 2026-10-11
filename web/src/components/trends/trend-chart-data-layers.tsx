"use client";

import type { CSSProperties } from "react";
import {
  type Band,
  SEV_COLOR,
  sevOfScore,
  severityScore,
} from "@/lib/farm/severity-score";
import type {
  TrendAxis,
  TrendEnvelope,
  TrendHistogram,
  TrendReferenceLine,
  TrendScaleEdgeLabel,
  TrendSeries,
} from "@/lib/domain/trend-chart-types";
import { motionClass } from "@/lib/ui/motion-classes";
import { motionStaggerStepMs } from "@/lib/ui/motion-tokens";
import type { ClipPresenceEntry } from "@/lib/ui/use-clip-presence";
import { inferHoverMetricGroup } from "@/lib/farm/trend-chart-format";
import { PAD_TOP } from "./trend-chart-geometry";
import { clipWipeClass, type PinnedTip } from "./trend-chart-interaction";
import {
  AlarmBandsLayer,
  ReferenceLinesLayer,
  type TrendPlotGeom,
} from "./trend-chart-svg-layers";
import { CommandSettingBandsSvg, type PositionedCommandSettingHit } from "./trend-chart-event-lane";

/**
 * TrendChart SVG 데이터 레이어 (히스토그램·엔벨로프·시리즈·호버/핀).
 * `trend-chart.tsx`에서 분리(동작 보존). 지오메트리·제스처는 부모에 두고
 * 순수 프레젠테이션만 담당한다.
 */

export type TrendChartDataLayersProps = {
  mode: "line" | "bar";
  n: number;
  padL: number;
  padR: number;
  viewW: number;
  innerH: number;
  innerW: number;
  barW: number;
  barSlotW: number;
  hoverIdx: number | null;
  hoverSeries: string | null;
  edgeDragId: string | null;
  hoveredEdgeId?: string | null;
  glowFilterId: string;
  showMarkers: boolean;
  markerRadiusPx: number;
  series: TrendSeries[];
  histPresence: ClipPresenceEntry<TrendHistogram>[];
  envelopePresence: ClipPresenceEntry<TrendEnvelope>[];
  seriesPresence: ClipPresenceEntry<TrendSeries>[];
  scaleEdgeLabels: TrendScaleEdgeLabel[];
  uniqueAlarmBands: ClipPresenceEntry<{
    band: Band;
    axis: TrendAxis;
    color?: string;
    fillWindow?: boolean;
    fillOpacity?: number;
    id?: string;
  }>[];
  dedupedReferenceLines: TrendReferenceLine[];
  pinnedTips: PinnedTip[];
  plotGeom: TrendPlotGeom;
  yFor: (value: number, axis: TrendAxis) => number;
  xFor: (i: number) => number;
  xForBar: (i: number) => number;
  markerRx: (rPx: number) => number;
  markerRy: (rPx: number) => number;
  shouldShowMarker: (i: number) => boolean;
  lineSegments: (s: TrendSeries) => string[];
  envelopePaths: (env: TrendEnvelope) => string[];
  commandSettingHits?: PositionedCommandSettingHit[];
  commandHoverId?: string | null;
};

export function TrendChartDataLayers({
  mode,
  n,
  padL,
  padR,
  viewW,
  innerH,
  barW,
  barSlotW,
  hoverIdx,
  hoverSeries,
  edgeDragId,
  hoveredEdgeId = null,
  glowFilterId,
  showMarkers,
  markerRadiusPx,
  series,
  histPresence,
  envelopePresence,
  seriesPresence,
  scaleEdgeLabels,
  uniqueAlarmBands,
  dedupedReferenceLines,
  pinnedTips,
  plotGeom,
  yFor,
  xFor,
  xForBar,
  markerRx,
  markerRy,
  shouldShowMarker,
  lineSegments,
  envelopePaths,
  commandSettingHits = [],
  commandHoverId = null,
}: TrendChartDataLayersProps) {
  return (
    <>
      {mode === "line"
        ? uniqueAlarmBands.map(({ item, key, phase }) => (
            <g
              key={key}
              className={clipWipeClass(phase)}
              data-clip-phase={phase}
            >
              <AlarmBandsLayer bands={[item]} geom={plotGeom} />
            </g>
          ))
        : null}
      {mode === "line"
        ? histPresence.map(({ item: h, key: histKey, phase }) => {
            const yBase = yFor(h.baseline, "left");
            const slot = n > 1 ? plotGeom.innerW / (n - 1) : plotGeom.innerW;
            const isVolume = h.style === "volume";
            const isOverlay = h.style === "overlay";
            const gs = Math.max(1, h.groupSize ?? 1);
            const gi = h.groupIndex ?? 0;
            const barWHist = Math.max(
              0.22,
              slot *
                (isVolume && gs > 1
                  ? 0.62 / gs
                  : isVolume
                    ? 0.5
                    : isOverlay
                      ? 0.28
                      : 0.55),
            );
            const cluster =
              isVolume && gs > 1
                ? (gi - (gs - 1) / 2) * (barWHist + 0.12)
                : 0;
            const opacity =
              h.fillOpacity ?? (isOverlay ? 0.14 : isVolume ? 0.7 : 0.75);
            return (
              <g
                key={histKey}
                className={clipWipeClass(phase)}
                data-clip-phase={phase}
              >
                {(!isVolume || gi === 0) &&
                !isOverlay &&
                Math.abs(yBase - (PAD_TOP + innerH)) > 0.6 ? (
                  <line
                    x1={padL}
                    x2={viewW - padR}
                    y1={yBase}
                    y2={yBase}
                    stroke="var(--muted-foreground)"
                    strokeWidth={0.4}
                    strokeDasharray={isVolume ? "1 2" : "1.5 1.5"}
                    vectorEffect="non-scaling-stroke"
                    opacity={isVolume ? 0.35 : 0.5}
                  />
                ) : null}
                {isOverlay ? (
                  <line
                    x1={padL}
                    x2={viewW - padR}
                    y1={yBase}
                    y2={yBase}
                    stroke="#f87171"
                    strokeWidth={0.55}
                    strokeDasharray="3 2.5"
                    vectorEffect="non-scaling-stroke"
                    opacity={0.55}
                  />
                ) : null}
                {h.values.map((v, i) => {
                  if (v == null || !Number.isFinite(v)) return null;
                  const yVal = yFor(v, "left");
                  const top = Math.min(yBase, yVal);
                  const height = Math.max(0.35, Math.abs(yVal - yBase));
                  const up = v >= h.baseline;
                  const barOp =
                    h.fillOpacityValues?.[i] != null &&
                    Number.isFinite(h.fillOpacityValues[i]!)
                      ? (h.fillOpacityValues[i] as number)
                      : opacity;
                  const hoverGroup = hoverSeries
                    ? inferHoverMetricGroup(hoverSeries)
                    : null;
                  const histGroup = inferHoverMetricGroup(
                    h.legendLabel ?? histKey,
                  );
                  const barFocused =
                    hoverIdx === i &&
                    (hoverGroup == null || hoverGroup === histGroup);
                  return (
                    <rect
                      key={`${histKey}-${i}`}
                      x={xFor(i) + cluster - barWHist / 2}
                      y={top}
                      width={barWHist}
                      height={height}
                      fill={isVolume || up ? h.colorUp : h.colorDown}
                      fillOpacity={
                        barFocused ? Math.min(1, barOp + 0.28) : barOp
                      }
                      stroke={
                        barFocused
                          ? isVolume || up
                            ? h.colorUp
                            : h.colorDown
                          : "none"
                      }
                      strokeWidth={barFocused ? 0.4 : 0}
                      vectorEffect="non-scaling-stroke"
                    />
                  );
                })}
              </g>
            );
          })
        : null}
      {mode === "line"
        ? envelopePresence.map(({ item: env, key: envKey, phase }) => {
            const paths = envelopePaths(env);
            if (!paths.length) return null;
            return (
              <g
                key={envKey}
                className={clipWipeClass(phase)}
                data-clip-phase={phase}
              >
                {paths.map((d, pi) => (
                  <path
                    key={`${envKey}-p${pi}`}
                    d={d}
                    fill={env.fill}
                    fillOpacity={env.fillOpacity ?? 0.22}
                    stroke="none"
                  />
                ))}
              </g>
            );
          })
        : null}

      {mode === "line" && commandSettingHits.length > 0 ? (
        <CommandSettingBandsSvg
          hits={commandSettingHits}
          hoverId={commandHoverId}
        />
      ) : null}

      <ReferenceLinesLayer lines={dedupedReferenceLines} geom={plotGeom} />

      {scaleEdgeLabels
        .filter((g) => g.showLine)
        .map((guide) => {
          const y = yFor(guide.value, guide.axis ?? "left");
          if (!Number.isFinite(y)) return null;
          const dragging = edgeDragId === guide.id;
          const highlighted =
            dragging ||
            (Boolean(guide.lineHighlight) && hoveredEdgeId === guide.id);
          const baseW = guide.lineStrokeWidth ?? 0.45;
          const dash =
            guide.lineDasharray === "solid" || guide.lineDasharray === ""
              ? undefined
              : (guide.lineDasharray ?? "1.5 2");
          const coreOpacity = highlighted ? 0.95 : 0.7;
          return (
            <g key={`scale-guide-${guide.id}`} pointerEvents="none">
              {highlighted ? (
                <line
                  x1={padL}
                  x2={viewW - padR}
                  y1={y}
                  y2={y}
                  stroke={guide.color}
                  strokeWidth={baseW + 4.2}
                  strokeDasharray={dash}
                  vectorEffect="non-scaling-stroke"
                  opacity={dragging ? 0.58 : 0.42}
                  filter={`url(#${glowFilterId})`}
                />
              ) : null}
              <line
                x1={padL}
                x2={viewW - padR}
                y1={y}
                y2={y}
                stroke={guide.color}
                strokeWidth={dragging ? baseW + 0.35 : baseW}
                strokeDasharray={dash}
                vectorEffect="non-scaling-stroke"
                opacity={coreOpacity}
              />
            </g>
          );
        })}

      {mode === "bar"
        ? series.map((s, si) =>
            s.data.map((v, i) => {
              if (v == null || !Number.isFinite(v)) return null;
              const axis = s.axis ?? "left";
              const yTop = yFor(v, axis);
              const baseY = PAD_TOP + innerH;
              const gx = xForBar(i) - barSlotW / 2 + si * barW;
              return (
                <rect
                  key={`${s.name}-${i}`}
                  x={gx}
                  y={yTop}
                  width={Math.max(0.4, barW * 0.92)}
                  height={Math.max(0, baseY - yTop)}
                  fill={s.color}
                  opacity={hoverIdx === i ? 1 : 0.85}
                />
              );
            }),
          )
        : seriesPresence.map(({ item: s, key: seriesKey, phase }, si) => {
            const axis = s.axis ?? "left";
            const segs = s.markerOnly ? [] : lineSegments(s);
            const hoverGroup = hoverSeries
              ? inferHoverMetricGroup(hoverSeries)
              : null;
            const focused =
              hoverGroup == null ||
              inferHoverMetricGroup(s.name) === hoverGroup;
            const lineOpacity = focused ? 1 : 0.22;
            const strokeW = focused && hoverSeries ? 1.85 : 1.55;
            return (
              <g
                key={seriesKey}
                className={clipWipeClass(phase)}
                data-clip-phase={phase}
                style={{
                  opacity: lineOpacity,
                  transition: "opacity 120ms linear",
                }}
              >
                {segs.map((pts, idx) => (
                  <g key={idx}>
                    {!s.strokeDasharray ? (
                      <polyline
                        points={pts}
                        fill="none"
                        stroke={s.color}
                        strokeWidth={strokeW + 2.2}
                        strokeLinejoin="round"
                        strokeLinecap="round"
                        vectorEffect="non-scaling-stroke"
                        filter={`url(#${glowFilterId})`}
                        className={motionClass.farmChartLineGlow}
                        opacity={focused ? 0.35 : 0.08}
                      />
                    ) : null}
                    <polyline
                      points={pts}
                      fill="none"
                      stroke={s.color}
                      strokeWidth={strokeW}
                      strokeLinejoin="round"
                      strokeLinecap="round"
                      strokeDasharray={s.strokeDasharray}
                      vectorEffect="non-scaling-stroke"
                    />
                  </g>
                ))}
                {(showMarkers || s.markerOnly)
                  ? s.data.map((v, i) => {
                      if (v == null || !Number.isFinite(v)) return null;
                      if (!s.markerOnly && !shouldShowMarker(i)) return null;
                      const cx = xFor(i);
                      const cy = yFor(v, axis);
                      const rPx = s.markerOnly
                        ? Math.max(markerRadiusPx, 2.1)
                        : markerRadiusPx;
                      const markerDelayMs =
                        120 +
                        si * motionStaggerStepMs +
                        Math.min(i, 8) * 16;
                      const markerStyle =
                        phase === "enter"
                          ? ({
                              ["--farm-chart-marker-delay" as string]:
                                `${markerDelayMs}ms`,
                            } as CSSProperties)
                          : undefined;
                      const markerClass =
                        phase === "enter"
                          ? motionClass.farmChartMarkerPop
                          : undefined;
                      const label = s.markerLabels?.[i] ?? null;
                      const fontSize = Math.max(2.4, markerRy(rPx) * 2.6);
                      if (s.band) {
                        const sev = sevOfScore(severityScore(v, s.band));
                        if (sev !== "normal") {
                          return (
                            <ellipse
                              key={`${s.name}-sev-${i}`}
                              cx={cx}
                              cy={cy}
                              rx={markerRx(rPx)}
                              ry={markerRy(rPx)}
                              fill={SEV_COLOR[sev]}
                              className={markerClass}
                              style={markerStyle}
                            />
                          );
                        }
                      }
                      return (
                        <g
                          key={`${s.name}-dot-${i}`}
                          className={markerClass}
                          style={markerStyle}
                        >
                          <ellipse
                            cx={cx}
                            cy={cy}
                            rx={markerRx(rPx)}
                            ry={markerRy(rPx)}
                            fill={s.color}
                          />
                          {label ? (
                            <text
                              x={cx}
                              y={cy - markerRy(rPx) * 2.35}
                              textAnchor="middle"
                              fill={s.color}
                              stroke="var(--background)"
                              strokeWidth={0.45}
                              paintOrder="stroke"
                              fontSize={fontSize}
                              fontWeight={600}
                              pointerEvents="none"
                            >
                              {label}
                            </text>
                          ) : null}
                        </g>
                      );
                    })
                  : null}
              </g>
            );
          })}

      {/* 호버 강조 — 링 펄스 + 코어 */}
      {mode === "line" && hoverIdx != null && hoverIdx >= 0 && hoverIdx < n
        ? series.map((s) => {
            const v = s.data[hoverIdx];
            if (v == null || !Number.isFinite(v)) return null;
            const axis = s.axis ?? "left";
            const isFocus =
              hoverSeries == null ||
              inferHoverMetricGroup(hoverSeries) ===
                inferHoverMetricGroup(s.name);
            if (!isFocus) return null;
            const cx = xFor(hoverIdx);
            const cy = yFor(v, axis);
            return (
              <g key={`hover-${s.name}`}>
                <ellipse
                  cx={cx}
                  cy={cy}
                  rx={markerRx(markerRadiusPx + 5)}
                  ry={markerRy(markerRadiusPx + 5)}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={1.1}
                  vectorEffect="non-scaling-stroke"
                  className={motionClass.farmChartHoverRing}
                />
                <ellipse
                  cx={cx}
                  cy={cy}
                  rx={markerRx(markerRadiusPx + 1.8)}
                  ry={markerRy(markerRadiusPx + 1.8)}
                  fill={s.color}
                  opacity={0.98}
                />
                <ellipse
                  cx={cx}
                  cy={cy}
                  rx={markerRx(markerRadiusPx * 0.45)}
                  ry={markerRy(markerRadiusPx * 0.45)}
                  fill="#fff"
                  opacity={0.9}
                />
              </g>
            );
          })
        : null}
      {/* 고정 핀 강조 */}
      {mode === "line"
        ? pinnedTips.map((pin) => {
            if (pin.eventMark) return null;
            if (pin.idx < 0 || pin.idx >= n) return null;
            const group = inferHoverMetricGroup(pin.seriesKey);
            return series.map((s) => {
              if (inferHoverMetricGroup(s.name) !== group) return null;
              const v = s.data[pin.idx];
              if (v == null || !Number.isFinite(v)) return null;
              const axis = s.axis ?? "left";
              const cx = xFor(pin.idx);
              const cy = yFor(v, axis);
              return (
                <g key={`pin-${pin.id}-${s.name}`}>
                  <ellipse
                    cx={cx}
                    cy={cy}
                    rx={markerRx(markerRadiusPx + 6)}
                    ry={markerRy(markerRadiusPx + 6)}
                    fill="none"
                    stroke={s.color}
                    strokeWidth={1.35}
                    vectorEffect="non-scaling-stroke"
                    opacity={0.95}
                  />
                  <ellipse
                    cx={cx}
                    cy={cy}
                    rx={markerRx(markerRadiusPx + 2)}
                    ry={markerRy(markerRadiusPx + 2)}
                    fill={s.color}
                    opacity={1}
                  />
                </g>
              );
            });
          })
        : null}
    </>
  );
}
