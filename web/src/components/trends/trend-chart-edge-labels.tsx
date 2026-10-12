"use client";

import { Check, RotateCcw } from "lucide-react";
import type { Dispatch, RefObject, SetStateAction } from "react";
import { AlarmDomainIcon } from "@/components/settings/alarm-domain-icon";
import type {
  ScaleEdgeDragEvent,
  ScaleEdgeNumericCommitEvent,
  TrendScaleEdgeLabel,
} from "@/lib/domain/trend-chart-types";
import {
  parseScaleEdgeValueUnit,
  type EdgeBandLabel,
} from "@/lib/farm/trend-chart-geometry";
import { chartTipPresenceClass } from "./trend-chart-interaction";
import type { ScaleEdgeLabelDragArm } from "./use-trend-scale-edge-edit";
import { isPrimaryPress } from "@/lib/ui/pointer-press";
import { cn } from "@/lib/utils";
import { TrendYLabelChip } from "./trend-y-label-chip";

/**
 * 스케일 엣지 강조선·끝단 라벨(드래그·숫자 입력·적용).
 * trend-chart.tsx JSX를 동작 변경 없이 1:1 이동.
 */
export function TrendChartEdgeLabels({
  hoveredEdgePresence,
  edgeBandLabels,
  edgeEdit,
  setEdgeEdit,
  onScaleEdgeApply,
  onScaleEdgeRevert,
  labelGutter,
  onScaleEdgeDrag,
  yLabelColumn,
  hoveredEdgeId,
  setHoveredEdgeId,
  dimPlotValues,
  edgeDragId,
  clearHover,
  scaleEdgeLabels,
  plotRef,
  labelDragArmRef,
  onScaleEdgeNumericCommit,
  beginScaleEdgeEdit,
  edgeValueMaxCh,
  commitScaleEdgeEdit,
  cancelScaleEdgeEdit,
  scaleEdgeApplyBusy,
  scaleEdgeApplyDisabled,
}: {
  hoveredEdgePresence: {
    mounted: boolean;
    phase: "enter" | "exit";
    value: EdgeBandLabel | null;
  };
  edgeBandLabels: EdgeBandLabel[];
  edgeEdit: { id: string; text: string } | null;
  setEdgeEdit: Dispatch<SetStateAction<{ id: string; text: string } | null>>;
  onScaleEdgeApply?: () => void;
  onScaleEdgeRevert?: () => void;
  labelGutter: boolean;
  onScaleEdgeDrag?: (e: ScaleEdgeDragEvent) => void;
  yLabelColumn: boolean;
  hoveredEdgeId: string | null;
  setHoveredEdgeId: Dispatch<SetStateAction<string | null>>;
  dimPlotValues: boolean;
  edgeDragId: string | null;
  clearHover: () => void;
  scaleEdgeLabels: TrendScaleEdgeLabel[];
  plotRef: RefObject<HTMLDivElement | null>;
  labelDragArmRef: RefObject<ScaleEdgeLabelDragArm | null>;
  onScaleEdgeNumericCommit?: (e: ScaleEdgeNumericCommitEvent) => void;
  beginScaleEdgeEdit: (guideId: string) => void;
  edgeValueMaxCh: number;
  commitScaleEdgeEdit: () => void;
  cancelScaleEdgeEdit: () => void;
  scaleEdgeApplyBusy: boolean;
  scaleEdgeApplyDisabled: boolean;
}) {
  return (
    <>
    {hoveredEdgePresence.mounted && hoveredEdgePresence.value ? (
      <div
        className={cn(
          "pointer-events-none absolute inset-x-0 z-[4] -translate-y-1/2",
          chartTipPresenceClass(hoveredEdgePresence.phase),
        )}
        style={{ top: `${hoveredEdgePresence.value.topPct}%` }}
        aria-hidden
      >
        <div
          className="h-[1.5px] w-full rounded-full"
          style={{
            background: hoveredEdgePresence.value.color,
            boxShadow: `0 0 3px 0.5px ${hoveredEdgePresence.value.color}`,
            opacity: 0.8,
          }}
        />
      </div>
    ) : null}

    {edgeBandLabels.map((label) => {
      const editing = edgeEdit?.id === label.id;
      const showActions =
        Boolean(label.showApplyActions) &&
        (onScaleEdgeApply != null || onScaleEdgeRevert != null);
      const alarmIconDomain =
        label.labelIcon === "temp-alarm"
          ? "temp"
          : label.labelIcon === "hum-alarm"
            ? "humidity"
            : null;
      const valueText = alarmIconDomain ? (
        <AlarmDomainIcon
          domain={alarmIconDomain}
          sizeClass={labelGutter ? "size-4" : "size-3.5"}
        />
      ) : (
        <TrendYLabelChip
          text={label.text}
          mark={!editing ? label.mark : undefined}
          className={
            labelGutter
              ? "min-h-7 px-1.5 py-1 text-xs font-semibold"
              : "farm-chart-fs-axis"
          }
        />
      );
      return (
        <span
          key={label.id}
          className={cn(
            "absolute z-[2] -translate-y-1/2 leading-none tabular-nums",
            labelGutter ? "text-xs font-semibold" : "farm-chart-fs-axis",
            showActions && "inline-flex items-center gap-0.5 pr-0",
            (editing || Boolean(label.leadingText) || Boolean(label.labelIcon)) &&
              "inline-flex items-center gap-1 whitespace-nowrap",
            Boolean(label.leadingText) &&
              !editing &&
              "shadow-sm ring-1 ring-current/20",
            Boolean(label.labelIcon) &&
              !editing &&
              "rounded-md bg-card/85 px-0.5 py-0.5",
            label.draggable && !editing
              ? onScaleEdgeDrag
                ? "pointer-events-auto cursor-ns-resize select-none"
                : "pointer-events-auto cursor-text select-none"
              : "pointer-events-auto",
            "transition-opacity duration-motion-fast",
            hoveredEdgeId != null &&
              hoveredEdgeId !== label.id &&
              "opacity-45",
            dimPlotValues && "opacity-30",
            hoveredEdgeId === label.id && "z-[6] font-semibold",
            label.side === "left" && "left-1 text-left",
            /** 설정 명칭 단독(레거시) — 수치 칩 바로 왼쪽 */
            label.side === "plotStart" &&
              "left-1/2 z-[3] -translate-x-[calc(100%+0.35rem)] text-right font-medium",
            /** 설정 수치 — 플롯 중앙 (leadingText 있으면 명칭+수치) */
            label.side === "center" &&
              "left-1/2 z-[3] -translate-x-1/2 text-center",
            /** 모바일 거터 — 우측 단일 열(큰 칩). PC 위젯은 플롯 밖 칸 */
            label.side === "right" &&
              yLabelColumn &&
              "right-1 z-[3] whitespace-nowrap",
            label.side === "right" &&
              labelGutter &&
              "right-1 max-w-[6.5rem] text-center",
            label.side === "right" &&
              !labelGutter &&
              !yLabelColumn &&
              label.labelLane === "inner" &&
              !showActions &&
              "right-11 text-center",
            label.side === "right" &&
              !labelGutter &&
              !yLabelColumn &&
              label.labelLane === "inner" &&
              showActions &&
              "right-1 text-center",
            label.side === "right" &&
              !labelGutter &&
              !yLabelColumn &&
              label.labelLane !== "inner" &&
              "right-0.5 text-center",
            edgeDragId === label.id &&
              (labelGutter ||
              label.side === "center" ||
              label.side === "plotStart"
                ? "min-h-9 text-sm ring-2 ring-current/45"
                : "ring-1 ring-current/40"),
          )}
          style={{ top: `${label.topPct}%`, color: label.color }}
          title={
            label.draggable
              ? onScaleEdgeDrag
                ? `${label.title} ${label.text} · 드래그 조절 · 더블클릭(PC)·더블탭(모바일)·우클릭 숫자 입력`
                : `${label.title} ${label.text} · 클릭·더블클릭·우클릭으로 숫자 입력`
              : `${label.title}${label.labelIcon ? ` ${label.text}` : ""}`
          }
          aria-label={
            label.labelIcon
              ? `${label.title} ${label.text}`
              : undefined
          }
          onPointerEnter={() => {
            clearHover();
            setHoveredEdgeId(label.id);
          }}
          onPointerLeave={() =>
            setHoveredEdgeId((cur) => (cur === label.id ? null : cur))
          }
          onPointerDown={
            label.draggable && !editing
              ? (e) => {
                  if (!isPrimaryPress(e) || !plotRef.current) return;
                  e.stopPropagation();
                  const guide = scaleEdgeLabels.find((g) => g.id === label.id);
                  if (!guide?.draggable) return;
                  if (!onScaleEdgeDrag) return;
                  e.preventDefault();
                  plotRef.current.setPointerCapture(e.pointerId);
                  labelDragArmRef.current = {
                    id: guide.id,
                    axis: guide.axis ?? "left",
                    value: guide.value,
                    x: e.clientX,
                    y: e.clientY,
                    pointerId: e.pointerId,
                    pointerType: e.pointerType,
                  };
                  clearHover();
                  setHoveredEdgeId(null);
                }
              : undefined
          }
          onClick={
            label.draggable && !editing && onScaleEdgeNumericCommit
              ? (e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  beginScaleEdgeEdit(label.id);
                }
              : undefined
          }
          onDoubleClick={
            label.draggable && onScaleEdgeNumericCommit
              ? (e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  beginScaleEdgeEdit(label.id);
                }
              : undefined
          }
          onContextMenu={
            label.draggable && onScaleEdgeNumericCommit
              ? (e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  beginScaleEdgeEdit(label.id);
                }
              : undefined
          }
        >
          {editing ? (
            <>
              {label.leadingText ? (
                <span className="font-medium not-italic tracking-tight">
                  {label.leadingText}
                </span>
              ) : null}
              <input
                autoFocus
                type="text"
                inputMode="decimal"
                aria-label={`${label.title} 숫자 입력`}
                className={cn(
                  "rounded-sm border border-current/40 bg-background text-center tabular-nums outline-none select-text",
                  labelGutter
                    ? "h-7 w-14 px-1 text-xs font-semibold"
                    : "h-4 w-10 px-0.5 farm-chart-fs-axis",
                )}
                style={{
                  color: label.color,
                  minWidth: `${edgeValueMaxCh}ch`,
                }}
                value={edgeEdit.text}
                onChange={(e) =>
                  setEdgeEdit({ id: label.id, text: e.target.value })
                }
                onFocus={(e) => e.currentTarget.select()}
                onBlur={() => commitScaleEdgeEdit()}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    commitScaleEdgeEdit();
                  } else if (e.key === "Escape") {
                    e.preventDefault();
                    cancelScaleEdgeEdit();
                  }
                }}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
              />
              {parseScaleEdgeValueUnit(label.text) ? (
                <span className="tabular-nums">
                  {parseScaleEdgeValueUnit(label.text)}
                </span>
              ) : null}
            </>
          ) : label.leadingText ? (
            <>
              <span className="font-medium not-italic tracking-tight">
                {label.leadingText}
              </span>
              {valueText}
            </>
          ) : (
            valueText
          )}
          {showActions ? (
            <span
              className="ml-0.5 inline-flex items-center gap-0.5"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
            >
              {onScaleEdgeApply ? (
                <button
                  type="button"
                  aria-label="설정값 적용"
                  title="적용 (명령 전송)"
                  disabled={scaleEdgeApplyBusy || scaleEdgeApplyDisabled}
                  className={cn(
                    "inline-flex size-5 items-center justify-center rounded border border-current/35 bg-background/95",
                    "hover:bg-current/10 disabled:opacity-40",
                  )}
                  onPointerDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (scaleEdgeApplyBusy || scaleEdgeApplyDisabled) return;
                    onScaleEdgeApply();
                  }}
                >
                  <Check className="size-3" strokeWidth={2.5} aria-hidden />
                </button>
              ) : null}
              {onScaleEdgeRevert ? (
                <button
                  type="button"
                  aria-label="설정값 되돌리기"
                  title="되돌리기"
                  disabled={scaleEdgeApplyBusy}
                  className={cn(
                    "inline-flex size-5 items-center justify-center rounded border border-current/35 bg-background/95",
                    "hover:bg-current/10 disabled:opacity-40",
                  )}
                  onPointerDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (scaleEdgeApplyBusy) return;
                    onScaleEdgeRevert();
                  }}
                >
                  <RotateCcw className="size-3" strokeWidth={2.5} aria-hidden />
                </button>
              ) : null}
            </span>
          ) : null}
        </span>
      );
    })}

    </>
  );
}
