"use client";

import { useEffect, useRef, useState } from "react";
import type {
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
} from "react";
import { isPrimaryPress } from "@/lib/ui/pointer-press";
import { X_SCOPE_DRAG_PX, X_SCOPE_MIN_SPAN } from "./trend-chart-geometry";

/** 드래프트 직사각형 view 좌표 — a/b=x, y0/y=y */
export type XDraftRect = { a: number; b: number; y0: number; y: number };

/** onXScopeCommit 인자 — 카테고리 인덱스 범위 + Y 중심 비율 */
export type XScopeCommitRange = {
  start: number;
  end: number;
  /**
   * 플롯 본문 기준 0~1. **>1** = 명령 이력 레인(시간-only 스코프 신호).
   */
  yStartRatio: number;
  yEndRatio: number;
};

/**
 * 구간 안내 — 실제 X스코프 UI와 동일 경로로 클릭→드래그→커밋 시연.
 * token 증가 시 재생. CSS 오버레이가 아님.
 */
export type GuidedXScopeGesture = {
  token: number;
  startRatio: number;
  endRatio: number;
  /** 카테고리 절대 인덱스 — 있으면 커밋 시 비율 재변환 생략 */
  startIndex?: number;
  endIndex?: number;
  yRatio?: number;
  yStartRatio?: number;
  yEndRatio?: number;
  durationMs?: number;
} | null;

type UseTrendScopeGestureOptions = {
  xScopeSelect: boolean;
  n: number;
  onXScopeCommit?: (range: XScopeCommitRange) => void;
  onXScopeBack?: () => void;
  guidedXScopeGesture: GuidedXScopeGesture;
  onGuidedXScopeComplete?: () => void;
  /** 렌더 시점 기하 매퍼 — 컴포넌트에서 주입 */
  indexFromXView: (xView: number) => number;
  yCenterRatioFromView: (yView: number) => number;
  xViewFromRatio: (r: number) => number;
  yViewFromRatio: (r: number) => number;
  xViewFromClient: (clientX: number, rect: DOMRect) => number;
  yViewFromClient: (clientY: number, rect: DOMRect) => number;
  clearHover: () => void;
};

/**
 * X스코프(구간 줌) 제스처 상태·핸들러를 캡슐화한다.
 *
 * - 실제 드래그(pointerDown→move→up) 직사각형 draft + 커밋
 * - 구간 시연용 guided 제스처(RAF 애니메이션 → 동일 커밋 경로)
 * - 스코프 끔 시 draft 즉시 폐기 (prop sync + effect)
 *
 * trend-chart.tsx 내부 로직을 동작 변경 없이 1:1 이동. 렌더 시점 기하 매퍼는
 * 옵션으로 주입받고, 외부에서 읽는 ref/state(xDraft·xDraftRef·xScopeDraggingRef)와
 * 포인터 핸들러를 반환한다.
 */
export function useTrendScopeGesture(opts: UseTrendScopeGestureOptions) {
  const {
    xScopeSelect,
    n,
    onXScopeCommit,
    onXScopeBack,
    guidedXScopeGesture,
    onGuidedXScopeComplete,
    indexFromXView,
    yCenterRatioFromView,
    xViewFromRatio,
    yViewFromRatio,
    xViewFromClient,
    yViewFromClient,
    clearHover,
  } = opts;

  const [xDraft, setXDraft] = useState<XDraftRect | null>(null);
  const xScopeOriginRef = useRef<{ x: number; y: number } | null>(null);
  const xScopeDraggingRef = useRef(false);
  const guidedScopeActiveRef = useRef(false);
  const guidedTokenSeenRef = useRef(0);
  const xDraftRef = useRef<XDraftRect | null>(null);

  /** Prop sync during render — 스코프 끔 시 드래프트 즉시 폐기 */
  const [prevXScopeSelect, setPrevXScopeSelect] = useState(xScopeSelect);
  if (xScopeSelect !== prevXScopeSelect) {
    setPrevXScopeSelect(xScopeSelect);
    if (!xScopeSelect) setXDraft(null);
  }
  useEffect(() => {
    if (xScopeSelect) return;
    xDraftRef.current = null;
    xScopeOriginRef.current = null;
    xScopeDraggingRef.current = false;
  }, [xScopeSelect]);

  const commitXScopeFromViews = (
    a: number,
    b: number,
    y0: number,
    y1: number,
  ) => {
    if (!onXScopeCommit || n < 2) return;
    let start = indexFromXView(Math.min(a, b));
    let end = indexFromXView(Math.max(a, b));
    if (end - start < X_SCOPE_MIN_SPAN) {
      const mid = Math.round((start + end) / 2);
      start = Math.max(0, mid - Math.floor(X_SCOPE_MIN_SPAN / 2));
      end = Math.min(n - 1, start + X_SCOPE_MIN_SPAN);
      start = Math.max(0, end - X_SCOPE_MIN_SPAN);
    }
    onXScopeCommit({
      start,
      end,
      yStartRatio: yCenterRatioFromView(y0),
      yEndRatio: yCenterRatioFromView(y1),
    });
  };

  /**
   * 실제 X스코프 draft UI로 클릭→드래그→커밋 (구간 시연).
   */
  useEffect(() => {
    const g = guidedXScopeGesture;
    if (!g || !onXScopeCommit || n < 2) return;
    if (g.token === guidedTokenSeenRef.current) return;
    guidedTokenSeenRef.current = g.token;

    const hasIdx =
      g.startIndex != null &&
      g.endIndex != null &&
      Number.isFinite(g.startIndex) &&
      Number.isFinite(g.endIndex);
    let commitStart = 0;
    let commitEnd = n - 1;
    let x0: number;
    let x1: number;
    if (hasIdx) {
      commitStart = Math.max(
        0,
        Math.min(n - 1, Math.round(Math.min(g.startIndex!, g.endIndex!))),
      );
      commitEnd = Math.max(
        0,
        Math.min(n - 1, Math.round(Math.max(g.startIndex!, g.endIndex!))),
      );
      if (commitEnd - commitStart < X_SCOPE_MIN_SPAN) {
        /** 최소 폭은 왼쪽(과거)으로만 확장 — 오른쪽 정상 봉 유입 방지 */
        commitStart = Math.max(0, commitEnd - X_SCOPE_MIN_SPAN);
      }
      x0 = xViewFromRatio(n <= 1 ? 0 : commitStart / (n - 1));
      x1 = xViewFromRatio(n <= 1 ? 1 : commitEnd / (n - 1));
    } else {
      x0 = xViewFromRatio(Math.min(g.startRatio, g.endRatio));
      x1 = xViewFromRatio(Math.max(g.startRatio, g.endRatio));
    }

    const yTopR =
      g.yStartRatio ??
      g.yEndRatio ??
      g.yRatio ??
      0.35;
    const yBotR =
      g.yEndRatio ??
      g.yStartRatio ??
      g.yRatio ??
      0.55;
    const y0 = yViewFromRatio(Math.min(yTopR, yBotR));
    const y1 = yViewFromRatio(Math.max(yTopR, yBotR));
    /** 클릭은 좌상단, 드래그는 우하단으로 직사각형 확장 */
    const duration = Math.max(1200, g.durationMs ?? 2800);
    let t0: number | null = null;
    let raf = 0;
    guidedScopeActiveRef.current = true;
    clearHover();

    const easeInOut = (t: number) =>
      t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;

    const tick = (now: number) => {
      if (t0 == null) t0 = now;
      const u = Math.min(1, (now - t0) / duration);
      /** 0–12% 클릭 홀드 · 12–82% 대각 드래그 · 82–100% 확정 전 홀드 */
      if (u < 0.12) {
        const next = { a: x0, b: x0, y0, y: y0 };
        xDraftRef.current = next;
        setXDraft(next);
      } else if (u < 0.82) {
        const dragT = easeInOut((u - 0.12) / 0.7);
        const bx = x0 + (x1 - x0) * dragT;
        const by = y0 + (y1 - y0) * dragT;
        const next = { a: x0, b: bx, y0, y: by };
        xDraftRef.current = next;
        setXDraft(next);
      } else {
        const next = { a: x0, b: x1, y0, y: y1 };
        xDraftRef.current = next;
        setXDraft(next);
      }

      if (u < 1) {
        raf = requestAnimationFrame(tick);
        return;
      }

      xDraftRef.current = null;
      setXDraft(null);
      guidedScopeActiveRef.current = false;
      if (hasIdx) {
        onXScopeCommit({
          start: commitStart,
          end: commitEnd,
          yStartRatio: yCenterRatioFromView(y0),
          yEndRatio: yCenterRatioFromView(y1),
        });
      } else {
        commitXScopeFromViews(x0, x1, y0, y1);
      }
      onGuidedXScopeComplete?.();
    };

    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      guidedScopeActiveRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- token-driven replay
  }, [guidedXScopeGesture?.token, n, onXScopeCommit]);

  /** 플롯·명령 레인 공용 — client 좌표로 드래프트 시작 (capture는 호출측) */
  const beginXScopeAt = (clientX: number, clientY: number, plot: HTMLElement) => {
    if (guidedScopeActiveRef.current) return;
    if (!xScopeSelect || !onXScopeCommit || n < 2) return;
    xScopeOriginRef.current = { x: clientX, y: clientY };
    xScopeDraggingRef.current = false;
    const rect = plot.getBoundingClientRect();
    const x = xViewFromClient(clientX, rect);
    const y = yViewFromClient(clientY, rect);
    const next = { a: x, b: x, y0: y, y };
    xDraftRef.current = next;
    setXDraft(next);
    clearHover();
  };

  const moveXScopeAt = (clientX: number, clientY: number, plot: HTMLElement) => {
    if (guidedScopeActiveRef.current) return;
    if (!xScopeSelect || xDraftRef.current == null || !xScopeOriginRef.current) {
      return;
    }
    const dx = Math.abs(clientX - xScopeOriginRef.current.x);
    const dy = Math.abs(clientY - xScopeOriginRef.current.y);
    if (!xScopeDraggingRef.current && dx < X_SCOPE_DRAG_PX && dy < X_SCOPE_DRAG_PX) {
      return;
    }
    xScopeDraggingRef.current = true;
    const rect = plot.getBoundingClientRect();
    const x = xViewFromClient(clientX, rect);
    const y = yViewFromClient(clientY, rect);
    const next = {
      a: xDraftRef.current.a,
      b: x,
      y0: xDraftRef.current.y0,
      y,
    };
    xDraftRef.current = next;
    setXDraft(next);
  };

  /** @returns 스코프 커밋 여부 (탭만이면 false) */
  const endXScopeAt = (
    clientX: number,
    clientY: number,
    plot: HTMLElement,
    opts?: { timeOnly?: boolean },
  ): boolean => {
    if (guidedScopeActiveRef.current) return false;
    if (!xScopeSelect || xDraftRef.current == null) return false;
    const rect = plot.getBoundingClientRect();
    const x = xViewFromClient(clientX, rect);
    const y = yViewFromClient(clientY, rect);
    const a = xDraftRef.current.a;
    const y0 = xDraftRef.current.y0;
    xDraftRef.current = null;
    setXDraft(null);
    xScopeOriginRef.current = null;

    if (!xScopeDraggingRef.current) {
      xScopeDraggingRef.current = false;
      return false;
    }
    xScopeDraggingRef.current = false;
    if (!onXScopeCommit) return false;

    let start = indexFromXView(Math.min(a, x));
    let end = indexFromXView(Math.max(a, x));
    if (end - start < X_SCOPE_MIN_SPAN) {
      const mid = Math.round((start + end) / 2);
      start = Math.max(0, mid - Math.floor(X_SCOPE_MIN_SPAN / 2));
      end = Math.min(n - 1, start + X_SCOPE_MIN_SPAN);
      start = Math.max(0, end - X_SCOPE_MIN_SPAN);
    }
    onXScopeCommit({
      start,
      end,
      yStartRatio: opts?.timeOnly ? 0 : yCenterRatioFromView(y0),
      yEndRatio: opts?.timeOnly ? 1 : yCenterRatioFromView(y),
    });
    return true;
  };

  const onXScopePointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!isPrimaryPress(e)) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    beginXScopeAt(e.clientX, e.clientY, e.currentTarget);
  };

  const onXScopePointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    moveXScopeAt(e.clientX, e.clientY, e.currentTarget);
  };

  const onXScopePointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    endXScopeAt(e.clientX, e.clientY, e.currentTarget);
  };

  const onXScopePointerCancel = () => {
    xDraftRef.current = null;
    setXDraft(null);
    xScopeOriginRef.current = null;
    xScopeDraggingRef.current = false;
  };

  const onXScopeContextMenu = (e: ReactMouseEvent<HTMLDivElement>) => {
    if (!xScopeSelect || !onXScopeBack) return;
    e.preventDefault();
    e.stopPropagation();
    onXScopeBack();
  };

  return {
    xDraft,
    xDraftRef,
    xScopeDraggingRef,
    beginXScopeAt,
    moveXScopeAt,
    endXScopeAt,
    onXScopePointerDown,
    onXScopePointerMove,
    onXScopePointerUp,
    onXScopePointerCancel,
    onXScopeContextMenu,
  };
}
