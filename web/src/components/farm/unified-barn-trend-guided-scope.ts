/**
 * 통합 추세 패널의 안내 X스코프 재생 비율.
 *
 * `unified-barn-trend-panel.tsx`에서 분리(동작 보존).
 * 토큰 변경 시 스택 setState와 humanize 캐시는 패널에 남긴다.
 */
import type { GuidedScopeRect } from "@/lib/ui/guided-scope-jitter";

/** 구간 안내 — 실제 X스코프 UI로 클릭→드래그→커밋 시연. token 증가 시 재생. */
export type GuidedXScopeGesture = {
  token: number;
  startRatio: number;
  endRatio: number;
  startIndex?: number;
  endIndex?: number;
  /** plot 상단=0 · 하단=1. yStart/yEnd 미지정 시 온도 레인 직사각형 */
  yRatio?: number;
  yStartRatio?: number;
  yEndRatio?: number;
  durationMs?: number;
};

export type GuidedScopePlayback = {
  token: number;
  startRatio: number;
  endRatio: number;
  startIndex?: number;
  endIndex?: number;
  durationMs?: number;
  base: GuidedScopeRect;
};

/** 온도 레인(또는 지정 비율)을 플롯 비율 직사각형으로 만든다. */
export function buildGuidedScopePlayback(input: {
  gesture: GuidedXScopeGesture;
  leftDomain: [number, number];
  tempLo: number;
  tempHi: number;
}): GuidedScopePlayback {
  const { gesture, leftDomain, tempLo, tempHi } = input;
  const domain = leftDomain;
  const span = domain[1] - domain[0] || 1;
  const bandH = Math.max(0, tempHi - tempLo);
  /** 온도 레인 안 넉넉한 직사각형 — 가장자리 ~10% 여백 */
  const inset = Math.max(bandH * 0.1, 1);
  let domainYTop = tempHi - inset;
  let domainYBot = tempLo + inset;
  if (domainYTop < domainYBot) {
    const mid = (tempLo + tempHi) / 2;
    domainYTop = mid + bandH * 0.35;
    domainYBot = mid - bandH * 0.35;
  }
  const toPlotRatio = (domainY: number) =>
    Math.min(1, Math.max(0, (domain[1] - domainY) / span));

  let y0: number;
  let y1: number;
  if (gesture.yStartRatio != null && gesture.yEndRatio != null) {
    y0 = Math.min(gesture.yStartRatio, gesture.yEndRatio);
    y1 = Math.max(gesture.yStartRatio, gesture.yEndRatio);
  } else if (gesture.yRatio != null) {
    const m = gesture.yRatio;
    y0 = Math.max(0, m - 0.08);
    y1 = Math.min(1, m + 0.08);
  } else {
    y0 = toPlotRatio(domainYTop);
    y1 = toPlotRatio(domainYBot);
  }
  if (y1 - y0 < 0.05) {
    const mid = (y0 + y1) / 2;
    y0 = Math.max(0, mid - 0.04);
    y1 = Math.min(1, mid + 0.04);
  }

  const base: GuidedScopeRect = {
    startRatio: gesture.startRatio,
    endRatio: gesture.endRatio,
    yStartRatio: y0,
    yEndRatio: y1,
    durationMs: gesture.durationMs,
  };

  return {
    token: gesture.token,
    startRatio: gesture.startRatio,
    endRatio: gesture.endRatio,
    startIndex: gesture.startIndex,
    endIndex: gesture.endIndex,
    durationMs: gesture.durationMs,
    base,
  };
}

/**
 * X는 초과 인덱스 기준 비율 고정(좌표 드리프트 방지). Y만 humanize 결과를 쓴다.
 */
export function resolveGuidedScopePlayback(
  playback: GuidedScopePlayback,
  human: GuidedScopeRect,
): GuidedXScopeGesture {
  return {
    token: playback.token,
    startRatio: playback.startRatio,
    endRatio: playback.endRatio,
    startIndex: playback.startIndex,
    endIndex: playback.endIndex,
    yStartRatio: human.yStartRatio,
    yEndRatio: human.yEndRatio,
    durationMs: human.durationMs ?? playback.durationMs,
  };
}
