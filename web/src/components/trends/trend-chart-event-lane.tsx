"use client";

import {
  useMemo,
  useRef,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { farmChartUi } from "@/lib/ui/farm-chart-ui-scale";
import {
  dashboardAffordance,
  dashboardChroma,
} from "@/lib/ui/dashboard-page-ui";
import { motionClass } from "@/lib/ui/motion-classes";
import { isPrimaryPress } from "@/lib/ui/pointer-press";
import { cn } from "@/lib/utils";
import {
  buildCommandHoldSegments,
  commandHoldBandRect,
  commandHoldRowIndex,
  COMMAND_HOLD_FILL_OPACITY,
  COMMAND_HOLD_LINE_OPACITY,
  COMMAND_HOLD_TEMP_DOMAIN,
  COMMAND_HOLD_VENT_DOMAIN,
  COMMAND_SETTING_COLOR,
  COMMAND_SETTING_DASH,
  COMMAND_SETTING_FILL_OPACITY,
  COMMAND_SETTING_LINE_OPACITY,
  commandSettingHasWindow,
} from "@/lib/farm/command-hold-bands";
import type {
  TrendCommandSettingSeg,
  TrendEventLane,
  TrendEventMark,
} from "@/lib/domain/trend-chart-types";
import { X_SCOPE_DRAG_PX } from "./trend-chart-geometry";

export type PositionedEventMark = {
  mark: TrendEventMark;
  xView: number;
  yView: number;
};

export function EventLaneSvgGuides({
  padL,
  padR,
  viewW,
  laneTop,
  laneH,
  rowCount,
}: {
  padL: number;
  padR: number;
  viewW: number;
  laneTop: number;
  laneH: number;
  rowCount: number;
}) {
  const rows = Math.max(1, rowCount);
  const x2 = viewW - padR;
  return (
    <g aria-hidden>
      <line
        x1={padL}
        x2={x2}
        y1={laneTop}
        y2={laneTop}
        stroke="currentColor"
        className="text-border"
        strokeWidth={0.7}
        vectorEffect="non-scaling-stroke"
      />
      {Array.from({ length: Math.max(0, rows - 1) }, (_, index) => (
        <line
          key={`row-${index}`}
          x1={padL}
          x2={x2}
          y1={laneTop + ((index + 1) / rows) * laneH}
          y2={laneTop + ((index + 1) / rows) * laneH}
          stroke="currentColor"
          className="text-border"
          strokeWidth={0.65}
          vectorEffect="non-scaling-stroke"
        />
      ))}
      {Array.from({ length: rows }, (_, index) => (
        <line
          key={`split-${index}`}
          x1={padL}
          x2={x2}
          y1={laneTop + ((index + 0.5) / rows) * laneH}
          y2={laneTop + ((index + 0.5) / rows) * laneH}
          stroke="currentColor"
          className="text-border"
          strokeWidth={0.4}
          strokeOpacity={0.45}
          vectorEffect="non-scaling-stroke"
        />
      ))}
    </g>
  );
}

/** A/B/C 행의 온도·환기 유지띠. 본선 Y와 분리된 0–30℃ / 0–100% 축. */
export function CommandHoldLaneSvg({
  marks,
  padL,
  padR,
  viewW,
  laneTop,
  laneH,
  rowCount,
}: {
  marks: PositionedEventMark[];
  padL: number;
  padR: number;
  viewW: number;
  laneTop: number;
  laneH: number;
  rowCount: number;
}) {
  const rows = Math.max(1, rowCount);
  const rowH = laneH / rows;
  const xMin = padL;
  const xMax = viewW - padR;
  const segments = buildCommandHoldSegments(
    marks.map((p) => ({
      id: p.mark.id,
      x: p.xView,
      hold: p.mark.hold,
    })),
    xMax,
  );
  return (
    <g aria-hidden>
      {segments.map((seg) => {
        const row = commandHoldRowIndex(seg.channel) ?? 0;
        const top = laneTop + row * rowH;
        const half = rowH / 2;
        const x0 = Math.max(xMin, Math.min(xMax, seg.x0));
        const x1 = Math.max(xMin, Math.min(xMax, seg.x1));
        const w = x1 - x0;
        if (!(w > 0.3)) return null;
        const fillOp = COMMAND_HOLD_FILL_OPACITY[seg.channel];
        const lineOp = COMMAND_HOLD_LINE_OPACITY[seg.channel];
        const temp = commandHoldBandRect(
          seg.tempLo,
          seg.tempHi,
          COMMAND_HOLD_TEMP_DOMAIN,
          top,
          half,
        );
        const vent = commandHoldBandRect(
          seg.ventLo,
          seg.ventHi,
          COMMAND_HOLD_VENT_DOMAIN,
          top + half,
          half,
        );
        return (
          <g key={seg.markId}>
            {temp ? (
              <>
                <rect
                  x={x0}
                  y={temp.y}
                  width={w}
                  height={temp.h}
                  fill="var(--channel-temp)"
                  fillOpacity={fillOp}
                  stroke="none"
                />
                <line
                  x1={x0}
                  x2={x0 + w}
                  y1={temp.y}
                  y2={temp.y}
                  stroke="var(--channel-temp)"
                  strokeOpacity={lineOp}
                  strokeWidth={0.45}
                  vectorEffect="non-scaling-stroke"
                />
                <line
                  x1={x0}
                  x2={x0 + w}
                  y1={temp.y + temp.h}
                  y2={temp.y + temp.h}
                  stroke="var(--channel-temp)"
                  strokeOpacity={lineOp}
                  strokeWidth={0.45}
                  vectorEffect="non-scaling-stroke"
                />
              </>
            ) : null}
            {vent ? (
              <>
                <rect
                  x={x0}
                  y={vent.y}
                  width={w}
                  height={vent.h}
                  fill="var(--channel-motor)"
                  fillOpacity={fillOp}
                  stroke="none"
                />
                <line
                  x1={x0}
                  x2={x0 + w}
                  y1={vent.y}
                  y2={vent.y}
                  stroke="var(--channel-motor)"
                  strokeOpacity={lineOp}
                  strokeWidth={0.45}
                  vectorEffect="non-scaling-stroke"
                />
                <line
                  x1={x0}
                  x2={x0 + w}
                  y1={vent.y + vent.h}
                  y2={vent.y + vent.h}
                  stroke="var(--channel-motor)"
                  strokeOpacity={lineOp}
                  strokeWidth={0.45}
                  vectorEffect="non-scaling-stroke"
                />
              </>
            ) : null}
          </g>
        );
      })}
    </g>
  );
}

type LaneScopeHandlers = {
  begin: (clientX: number, clientY: number) => void;
  move: (clientX: number, clientY: number) => void;
  /** @returns true if time scope committed (tap should not pin) */
  end: (clientX: number, clientY: number) => boolean;
  cancel: () => void;
};

/** 유지띠 탭=카드 · 가로 드래그=시간 스코프. 점·클러스터는 그리지 않는다. */
export function EventLaneHtmlOverlay({
  lane,
  marks,
  viewW,
  chartH,
  laneTop,
  laneH,
  padL,
  padR,
  labelGutter,
  selectedId,
  onSelect,
  onHover,
  onEmptyContextMenu,
  scopeHandlers = null,
}: {
  lane: TrendEventLane;
  marks: PositionedEventMark[];
  viewW: number;
  chartH: number;
  laneTop: number;
  laneH: number;
  padL: number;
  padR: number;
  labelGutter?: boolean;
  selectedId: string | null;
  onSelect: (
    mark: TrendEventMark,
    anchor?: { nx: number; ny: number },
  ) => void;
  onHover: (
    mark: TrendEventMark | null,
    client?: { x: number; y: number },
  ) => void;
  /** 빈 공간 우클릭: 카드가 있으면 일괄 닫고 true 반환(줌인 뒤로가기보다 우선) */
  onEmptyContextMenu?: () => boolean;
  /** 띠 위 가로 드래그도 시간 스코프 (탭=핀) */
  scopeHandlers?: LaneScopeHandlers | null;
}) {
  const rowCount = Math.max(1, lane.rowLabels.length);
  const rowH = laneH / rowCount;
  const selectedRow =
    marks.find((row) => row.mark.id === selectedId)?.mark.row ?? null;
  const pctY = (yView: number) =>
    `${chartH > 0 ? (yView / chartH) * 100 : 0}%`;
  const xMin = padL;
  const xMax = viewW - padR;

  const markById = useMemo(() => {
    const map = new Map<string, PositionedEventMark>();
    for (const p of marks) map.set(p.mark.id, p);
    return map;
  }, [marks]);

  const segments = useMemo(
    () =>
      buildCommandHoldSegments(
        marks.map((p) => ({
          id: p.mark.id,
          x: p.xView,
          hold: p.mark.hold,
        })),
        xMax,
      ),
    [marks, xMax],
  );

  const armRef = useRef<{
    pointerId: number;
    x: number;
    y: number;
    mark: TrendEventMark;
  } | null>(null);
  const draggedRef = useRef(false);

  const clearArm = () => {
    armRef.current = null;
    draggedRef.current = false;
  };

  const onSegPointerDown = (
    event: ReactPointerEvent<HTMLButtonElement>,
    mark: TrendEventMark,
  ) => {
    event.stopPropagation();
    if (!isPrimaryPress(event)) return;
    armRef.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      mark,
    };
    draggedRef.current = false;
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      /* ignore */
    }
    scopeHandlers?.begin(event.clientX, event.clientY);
  };

  const onSegPointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const arm = armRef.current;
    if (!arm || arm.pointerId !== event.pointerId) return;
    const dist = Math.hypot(event.clientX - arm.x, event.clientY - arm.y);
    if (dist >= X_SCOPE_DRAG_PX) draggedRef.current = true;
    scopeHandlers?.move(event.clientX, event.clientY);
  };

  const onSegPointerUp = (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    const arm = armRef.current;
    if (!arm || arm.pointerId !== event.pointerId) {
      clearArm();
      return;
    }
    const committed = scopeHandlers?.end(event.clientX, event.clientY) ?? false;
    const wasDrag = draggedRef.current || committed;
    const mark = arm.mark;
    clearArm();
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      /* ignore */
    }
    if (wasDrag) return;
    onSelect(mark);
  };

  const onSegPointerCancel = (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (armRef.current?.pointerId === event.pointerId) {
      scopeHandlers?.cancel();
      clearArm();
    }
  };

  return (
    <div
      className="pointer-events-none absolute inset-0 z-[3]"
      data-tour-id="chart-command-hit"
    >
      {lane.rowLabels.map((name, index) => (
        <div
          key={name}
          className={cn(
            "pointer-events-none absolute -translate-y-1/2 rounded-sm bg-background/85 text-right leading-none",
            farmChartUi.fsAxis,
            labelGutter ? "right-1" : "right-0.5",
            selectedRow === index
              ? dashboardChroma.chromeActiveText
              : dashboardChroma.chromeIdleText,
          )}
          style={{ top: pctY(laneTop + ((index + 0.5) / rowCount) * laneH) }}
          aria-hidden
        >
          {name}
        </div>
      ))}

      {marks.length === 0 ? (
        <p
          className={cn(
            "pointer-events-none absolute left-1/2 -translate-x-1/2 -translate-y-1/2 text-center",
            farmChartUi.fsMeta,
            dashboardChroma.chromeIdleText,
          )}
          style={{ top: pctY(laneTop + laneH / 2) }}
        >
          {lane.emptyLabel}
        </p>
      ) : null}

      {segments.map((seg) => {
        const placed = markById.get(seg.markId);
        if (!placed) return null;
        const row = commandHoldRowIndex(seg.channel) ?? placed.mark.row;
        const x0 = Math.max(xMin, Math.min(xMax, seg.x0));
        const x1 = Math.max(xMin, Math.min(xMax, seg.x1));
        const w = x1 - x0;
        if (!(w > 0.3) || !(viewW > 0) || !(chartH > 0)) return null;
        const isSelected = selectedId === placed.mark.id;
        return (
          <button
            key={seg.markId}
            type="button"
            className={cn(
              "pointer-events-auto absolute",
              dashboardAffordance.hitSurface,
              motionClass.microHover,
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-foreground",
              isSelected && "z-[1]",
            )}
            style={{
              left: `${(x0 / viewW) * 100}%`,
              width: `${(w / viewW) * 100}%`,
              top: pctY(laneTop + row * rowH),
              height: `${(rowH / chartH) * 100}%`,
            }}
            aria-label={placed.mark.ariaLabel}
            aria-pressed={isSelected}
            data-trend-event-mark=""
            onPointerDown={(event) => onSegPointerDown(event, placed.mark)}
            onPointerMove={onSegPointerMove}
            onPointerUp={onSegPointerUp}
            onPointerCancel={onSegPointerCancel}
            onClick={(event) => {
              event.stopPropagation();
              if (event.detail !== 0) return;
              onSelect(placed.mark);
            }}
            onPointerEnter={(event) =>
              onHover(placed.mark, { x: event.clientX, y: event.clientY })
            }
            onMouseEnter={(event) =>
              onHover(placed.mark, { x: event.clientX, y: event.clientY })
            }
            onMouseMove={(event) => {
              event.stopPropagation();
              onHover(placed.mark, { x: event.clientX, y: event.clientY });
            }}
            onMouseLeave={() => onHover(null)}
            onFocus={() => onHover(placed.mark)}
            onBlur={() => onHover(null)}
            onContextMenu={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onEmptyContextMenu?.();
            }}
          />
        );
      })}
    </div>
  );
}

export type PositionedCommandSettingHit = {
  seg: TrendCommandSettingSeg;
  x0: number;
  x1: number;
  y: number;
  h: number;
};

export function CommandSettingBandsSvg({
  hits,
  hoverId,
}: {
  hits: PositionedCommandSettingHit[];
  hoverId: string | null;
}) {
  return (
    <g aria-hidden data-tour-id="farm-chart-command-pane">
      {hits.map((hit) => {
        const ch = hit.seg.mark.hold?.channel;
        if (!ch || !commandSettingHasWindow(ch)) return null;
        const w = hit.x1 - hit.x0;
        if (!(w > 0.3) || !(hit.h > 0.3)) return null;
        const dim = hoverId != null && hoverId !== hit.seg.mark.id;
        return (
          <rect
            key={`win-${hit.seg.mark.id}:${hit.seg.band ?? "temp"}`}
            x={hit.x0}
            y={hit.y}
            width={w}
            height={hit.h}
            fill={COMMAND_SETTING_COLOR}
            fillOpacity={COMMAND_SETTING_FILL_OPACITY[ch]}
            stroke="none"
            opacity={dim ? 0.4 : 1}
          />
        );
      })}
      {hits.map((hit) => {
        const ch = hit.seg.mark.hold?.channel;
        if (!ch) return null;
        const w = hit.x1 - hit.x0;
        if (!(w > 0.3) || !(hit.h > 0.3)) return null;
        const dim = hoverId != null && hoverId !== hit.seg.mark.id;
        const dash = COMMAND_SETTING_DASH[ch];
        const y1 = hit.y;
        const y2 = hit.y + hit.h;
        return (
          <g
            key={`edge-${hit.seg.mark.id}:${hit.seg.band ?? "temp"}`}
            opacity={dim ? 0.28 : 1}
          >
            <line
              x1={hit.x0}
              x2={hit.x1}
              y1={y1}
              y2={y1}
              stroke={COMMAND_SETTING_COLOR}
              strokeOpacity={COMMAND_SETTING_LINE_OPACITY}
              strokeWidth={1.2}
              strokeDasharray={dash}
              vectorEffect="non-scaling-stroke"
            />
            <line
              x1={hit.x0}
              x2={hit.x1}
              y1={y2}
              y2={y2}
              stroke={COMMAND_SETTING_COLOR}
              strokeOpacity={COMMAND_SETTING_LINE_OPACITY}
              strokeWidth={1.2}
              strokeDasharray={dash}
              vectorEffect="non-scaling-stroke"
            />
          </g>
        );
      })}
    </g>
  );
}

export function CommandSettingHitOverlay({
  hits,
  viewW,
  chartH,
  selectedId,
  onSelect,
  onHover,
  onEmptyContextMenu,
  scopeHandlers = null,
}: {
  hits: PositionedCommandSettingHit[];
  viewW: number;
  chartH: number;
  selectedId: string | null;
  onSelect: (
    mark: TrendEventMark,
    anchor?: { nx: number; ny: number },
  ) => void;
  onHover: (
    mark: TrendEventMark | null,
    client?: { x: number; y: number },
  ) => void;
  onEmptyContextMenu?: () => boolean;
  scopeHandlers?: LaneScopeHandlers | null;
}) {
  const pctY = (yView: number) =>
    `${chartH > 0 ? (yView / chartH) * 100 : 0}%`;
  const armRef = useRef<{
    pointerId: number;
    x: number;
    y: number;
    mark: TrendEventMark;
  } | null>(null);
  const draggedRef = useRef(false);

  const clearArm = () => {
    armRef.current = null;
    draggedRef.current = false;
  };

  const onSegPointerDown = (
    event: ReactPointerEvent<HTMLButtonElement>,
    mark: TrendEventMark,
  ) => {
    event.stopPropagation();
    if (!isPrimaryPress(event)) return;
    armRef.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      mark,
    };
    draggedRef.current = false;
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      /* ignore */
    }
    scopeHandlers?.begin(event.clientX, event.clientY);
  };

  const onSegPointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const arm = armRef.current;
    if (!arm || arm.pointerId !== event.pointerId) return;
    const dist = Math.hypot(event.clientX - arm.x, event.clientY - arm.y);
    if (dist >= X_SCOPE_DRAG_PX) draggedRef.current = true;
    scopeHandlers?.move(event.clientX, event.clientY);
  };

  const onSegPointerUp = (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    const arm = armRef.current;
    if (!arm || arm.pointerId !== event.pointerId) {
      clearArm();
      return;
    }
    const committed = scopeHandlers?.end(event.clientX, event.clientY) ?? false;
    const wasDrag = draggedRef.current || committed;
    const mark = arm.mark;
    clearArm();
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      /* ignore */
    }
    if (wasDrag) return;
    onSelect(mark);
  };

  const onSegPointerCancel = (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (armRef.current?.pointerId === event.pointerId) {
      scopeHandlers?.cancel();
      clearArm();
    }
  };

  if (hits.length === 0 || !(viewW > 0) || !(chartH > 0)) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-[3]">
      {hits.map((hit) => {
        const w = hit.x1 - hit.x0;
        if (!(w > 0.3) || !(hit.h > 0.3)) return null;
        const isSelected = selectedId === hit.seg.mark.id;
        return (
          <button
            key={`${hit.seg.mark.id}:${hit.seg.band ?? "temp"}`}
            type="button"
            className={cn(
              "pointer-events-auto absolute",
              dashboardAffordance.hitSurface,
              motionClass.microHover,
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-foreground",
              isSelected && "z-[1]",
            )}
            style={{
              left: `${(hit.x0 / viewW) * 100}%`,
              width: `${(w / viewW) * 100}%`,
              top: pctY(hit.y),
              height: `${(hit.h / chartH) * 100}%`,
            }}
            aria-label={hit.seg.mark.ariaLabel}
            aria-pressed={isSelected}
            data-trend-event-mark=""
            onPointerDown={(event) => onSegPointerDown(event, hit.seg.mark)}
            onPointerMove={onSegPointerMove}
            onPointerUp={onSegPointerUp}
            onPointerCancel={onSegPointerCancel}
            onClick={(event) => {
              event.stopPropagation();
              if (event.detail !== 0) return;
              onSelect(hit.seg.mark);
            }}
            onPointerEnter={(event) =>
              onHover(hit.seg.mark, { x: event.clientX, y: event.clientY })
            }
            onMouseEnter={(event) =>
              onHover(hit.seg.mark, { x: event.clientX, y: event.clientY })
            }
            onMouseMove={(event) => {
              event.stopPropagation();
              onHover(hit.seg.mark, { x: event.clientX, y: event.clientY });
            }}
            onMouseLeave={() => onHover(null)}
            onFocus={() => onHover(hit.seg.mark)}
            onBlur={() => onHover(null)}
            onContextMenu={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onEmptyContextMenu?.();
            }}
          />
        );
      })}
    </div>
  );
}
