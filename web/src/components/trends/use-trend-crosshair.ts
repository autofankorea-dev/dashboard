"use client";

import { useLayoutEffect, useRef, type RefObject } from "react";
import type { TrendPeriodId } from "@/lib/domain/farm-trend-types";
import { formatTrendBandEdge } from "@/lib/farm/trend-chart-format";
import {
  PAD_TOP,
  chartDomainYFromViewY,
  formatCrosshairClock,
  interpolateTimelineMsFromXView,
} from "@/lib/farm/trend-chart-geometry";

const CROSSHAIR_CHIP_GAP_PX = 8;

export type TrendCrosshairValues = (chartY: number) => {
  tempC?: number | null;
  humidityPct?: number | null;
  motorPct?: number | null;
} | null;

/**
 * 십자선(세로·가로 선) + 값 칩 — mousemove마다 리렌더하지 않도록 DOM을 직접 조작한다.
 *
 * - `crossVRef`/`crossHRef`: SVG line, `crossChip*Ref`: HTML 칩과 파트 span (JSX에 그대로 부착)
 * - `setCrosshairAt`: 선 위치·표시, `fillCrosshairChip`: 시각·온도·습도·모터 텍스트와 칩 배치
 * - `hoverActive`가 꺼지면 마지막 십자선 위치로 칩을 복원한다 (렌더마다 layout effect)
 *
 * trend-chart.tsx 내부 로직을 동작 변경 없이 1:1 이동.
 */
export function useTrendCrosshair(opts: {
  plotRef: RefObject<HTMLDivElement | null>;
  plotW: number;
  viewW: number;
  chartH: number;
  padL: number;
  innerW: number;
  innerH: number;
  n: number;
  timeAxisMs: number[] | null;
  categories: string[];
  period: TrendPeriodId | undefined;
  leftDomain: readonly [number, number];
  leftUnit: string;
  crosshairValues?: TrendCrosshairValues;
  /** 데이터 점/이벤트 카드가 떠 있는 동안은 칩을 숨긴다 */
  hoverActive: boolean;
}) {
  const {
    plotRef,
    plotW: plotPxW,
    viewW,
    chartH,
    padL,
    innerW,
    innerH,
    n,
    timeAxisMs,
    categories,
    period,
    leftDomain,
    leftUnit,
    crosshairValues,
    hoverActive,
  } = opts;
  const [lMin, lMax] = leftDomain;

  const crossVRef = useRef<SVGLineElement | null>(null);
  const crossHRef = useRef<SVGLineElement | null>(null);
  const crossChipRef = useRef<HTMLDivElement | null>(null);
  const crossChipTimeRef = useRef<HTMLSpanElement | null>(null);
  const crossChipTempRef = useRef<HTMLSpanElement | null>(null);
  const crossChipHumRef = useRef<HTMLSpanElement | null>(null);
  const crossChipMotorRef = useRef<HTMLSpanElement | null>(null);
  const crossChipOtherRef = useRef<HTMLSpanElement | null>(null);
  const lastCrosshairRef = useRef({ x: 0, y: 0, on: false });

  const setCrosshairChipVisible = (visible: boolean) => {
    if (crossChipRef.current) {
      crossChipRef.current.style.opacity = visible ? "1" : "0";
    }
  };

  const setPartText = (node: HTMLSpanElement | null, text: string | null) => {
    if (!node) return;
    if (text) {
      node.textContent = text;
      node.style.display = "";
    } else {
      node.textContent = "";
      node.style.display = "none";
    }
  };

  const fillCrosshairChip = (xView: number, yView: number) => {
    const el = crossChipRef.current;
    if (!el) return;
    lastCrosshairRef.current = { x: xView, y: yView, on: true };

    const ms = interpolateTimelineMsFromXView(
      xView,
      padL,
      innerW,
      timeAxisMs,
      n,
    );
    let timeLabel = "";
    if (ms != null) {
      timeLabel = formatCrosshairClock(ms, { withDate: period !== "24h" });
    } else if (n > 0) {
      const u = Math.min(1, Math.max(0, (xView - padL) / Math.max(innerW, 1)));
      const i = n <= 1 ? 0 : Math.round(u * (n - 1));
      timeLabel = categories[i] ?? "";
    }
    setPartText(crossChipTimeRef.current, timeLabel || null);

    const chartY = chartDomainYFromViewY(yView, PAD_TOP, innerH, [lMin, lMax]);
    let tempC: number | null = null;
    let humidityPct: number | null = null;
    let motorPct: number | null = null;
    let other: string | null = null;
    if (chartY != null) {
      if (crosshairValues) {
        const v = crosshairValues(chartY);
        tempC = v?.tempC ?? null;
        humidityPct = v?.humidityPct ?? null;
        motorPct = v?.motorPct ?? null;
      } else if (leftUnit === "℃") {
        tempC = chartY;
      } else if (leftUnit) {
        other = formatTrendBandEdge(chartY, leftUnit);
      }
    }
    setPartText(
      crossChipTempRef.current,
      tempC != null ? formatTrendBandEdge(tempC, "℃") : null,
    );
    setPartText(
      crossChipHumRef.current,
      humidityPct != null ? formatTrendBandEdge(humidityPct, "%") : null,
    );
    setPartText(
      crossChipMotorRef.current,
      motorPct != null ? formatTrendBandEdge(motorPct, "%") : null,
    );
    setPartText(crossChipOtherRef.current, other);

    const plotW = plotRef.current?.getBoundingClientRect().width || plotPxW || 1;
    const xPx = (xView / Math.max(viewW, 1)) * plotW;
    const padLPx = (padL / Math.max(viewW, 1)) * plotW;
    const chipW = el.offsetWidth || 96;
    const flip = xPx - padLPx < chipW + CROSSHAIR_CHIP_GAP_PX;
    el.style.left = `${(xView / Math.max(viewW, 1)) * 100}%`;
    el.style.top = `${(yView / Math.max(chartH, 1)) * 100}%`;
    el.style.transform = flip
      ? `translate(${CROSSHAIR_CHIP_GAP_PX}px, -50%)`
      : `translate(calc(-100% - ${CROSSHAIR_CHIP_GAP_PX}px), -50%)`;
  };

  const setCrosshairVisible = (visible: boolean) => {
    const op = visible ? "1" : "0";
    if (crossVRef.current) crossVRef.current.style.opacity = op;
    if (crossHRef.current) crossHRef.current.style.opacity = op;
    if (!visible) {
      lastCrosshairRef.current.on = false;
      setCrosshairChipVisible(false);
    }
  };

  const setCrosshairAt = (xView: number, yView: number) => {
    if (crossVRef.current) {
      crossVRef.current.setAttribute("x1", String(xView));
      crossVRef.current.setAttribute("x2", String(xView));
    }
    if (crossHRef.current) {
      crossHRef.current.setAttribute("y1", String(yView));
      crossHRef.current.setAttribute("y2", String(yView));
    }
    setCrosshairVisible(true);
  };

  useLayoutEffect(() => {
    if (hoverActive) {
      setCrosshairChipVisible(false);
      return;
    }
    const last = lastCrosshairRef.current;
    if (!last.on) return;
    fillCrosshairChip(last.x, last.y);
    setCrosshairChipVisible(true);
  });

  return {
    crossVRef,
    crossHRef,
    crossChipRef,
    crossChipTimeRef,
    crossChipTempRef,
    crossChipHumRef,
    crossChipMotorRef,
    crossChipOtherRef,
    setCrosshairChipVisible,
    fillCrosshairChip,
    setCrosshairVisible,
    setCrosshairAt,
  };
}
