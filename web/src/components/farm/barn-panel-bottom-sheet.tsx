"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type TouchEvent as ReactTouchEvent,
} from "react";
import { createPortal } from "react-dom";
import { XIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useHydrationSafeDashboardCompact } from "@/components/layout/dashboard-viewport-context";
import { cn } from "@/lib/utils";
import { motionClass } from "@/lib/ui/motion-classes";
import { motionDuration } from "@/lib/ui/motion-tokens";

const DISMISS_DRAG_PX = 88;
const PEEK_EXPAND_DRAG_PX = 36;

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function sheetPeekHost(): HTMLElement | null {
  if (typeof document === "undefined") return null;
  return (
    document.querySelector<HTMLElement>("[data-dashboard-overlay-host]") ??
    document.querySelector<HTMLElement>("[data-viewport-preview]") ??
    document.body
  );
}

type Props = {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  auditRegion?: string;
  /** 있으면 헤더에「뒤로」— 시트 내 push 네비. */
  onBack?: () => void;
  backLabel?: string;
  /**
   * 컨트롤러 피커 등 — 본문 remount로 focus-out 시 닫히지 않게.
   * 운영 명령 상세 등에는 false(기본)로 두어 오버레이/ESC 닫기를 허용.
   */
  suppressFocusOutClose?: boolean;
  /**
   * 차트 이동 후 흐름 유지 — 본문 없이 하단 핸들만.
   * 핸들 탭·위로 끌기 → onExpand, 펼친 뒤 아래로 끌기·배경 → onPeek.
   */
  peek?: boolean;
  onPeek?: () => void;
  onExpand?: () => void;
  peekAriaLabel?: string;
  /** true면 peek 핸들 포털만 렌더 스킵(상태는 유지 — 맵 복귀 시 재표시) */
  suppressPeekHandle?: boolean;
};

/** 모바일 stack — bottom sheet shell (설정·컨트롤러 carousel 공용). */
export function BarnPanelBottomSheet({
  open,
  onClose,
  title,
  children,
  className,
  contentClassName,
  auditRegion = "barn-panel-bottom-sheet",
  onBack,
  backLabel = "뒤로",
  suppressFocusOutClose = false,
  peek = false,
  onPeek,
  onExpand,
  peekAriaLabel = "컨트롤러 시트 열기",
  suppressPeekHandle = false,
}: Props) {
  const viewportCompact = useHydrationSafeDashboardCompact();
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startYRef = useRef<number | null>(null);
  const dragYRef = useRef(0);
  const host = open ? sheetPeekHost() : null;
  const [peekVisible, setPeekVisible] = useState(false);
  if (open && peek && !peekVisible) setPeekVisible(true);
  if (!open && peekVisible) setPeekVisible(false);
  if (
    open &&
    !peek &&
    peekVisible &&
    prefersReducedMotion()
  ) {
    setPeekVisible(false);
  }

  useEffect(() => {
    if (!open || peek || prefersReducedMotion()) return;
    const t = window.setTimeout(
      () => setPeekVisible(false),
      motionDuration.emphasis,
    );
    return () => window.clearTimeout(t);
  }, [open, peek]);

  useEffect(() => {
    if (!open || peek || typeof document === "undefined") return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open, peek]);

  const resetDrag = useCallback(() => {
    dragYRef.current = 0;
    setDragY(0);
    setDragging(false);
    startYRef.current = null;
  }, []);

  const handleClose = useCallback(() => {
    resetDrag();
    onClose();
  }, [onClose, resetDrag]);

  const handlePeek = useCallback(() => {
    resetDrag();
    onPeek?.();
  }, [onPeek, resetDrag]);

  const onHandleTouchStart = useCallback((e: ReactTouchEvent) => {
    const t = e.touches[0];
    if (!t) return;
    startYRef.current = t.clientY;
    setDragging(true);
  }, []);

  const onHandleTouchMove = useCallback((e: ReactTouchEvent) => {
    const start = startYRef.current;
    const t = e.touches[0];
    if (start == null || !t) return;
    const dy = Math.max(0, t.clientY - start);
    dragYRef.current = dy;
    setDragY(dy);
  }, []);

  const onHandleTouchEnd = useCallback(() => {
    const dy = dragYRef.current;
    startYRef.current = null;
    setDragging(false);
    if (dy >= DISMISS_DRAG_PX) {
      if (onPeek) handlePeek();
      else handleClose();
      return;
    }
    dragYRef.current = 0;
    setDragY(0);
  }, [handleClose, handlePeek, onPeek]);

  const onPeekTouchStart = useCallback((e: ReactTouchEvent) => {
    const t = e.touches[0];
    if (!t) return;
    startYRef.current = t.clientY;
  }, []);

  const onPeekTouchEnd = useCallback(
    (e: ReactTouchEvent) => {
      const start = startYRef.current;
      startYRef.current = null;
      const t = e.changedTouches[0];
      if (start == null || !t) return;
      if (start - t.clientY >= PEEK_EXPAND_DRAG_PX) {
        onExpand?.();
      }
    },
    [onExpand],
  );

  if (!open) return null;

  const peekHandle =
    peekVisible && host && !suppressPeekHandle
      ? createPortal(
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 z-[45] flex justify-center"
            data-audit-region={`${auditRegion}-peek`}
            data-testid="barn-sheet-peek"
          >
            <button
              type="button"
              className={cn(
                "pointer-events-auto flex min-h-12 w-full max-w-lg cursor-grab touch-none flex-col items-center pt-4 pb-3.5",
                "bg-card/95 backdrop-blur-md",
                "rounded-t-xl border border-b-0 border-border/80",
                motionClass.microInteractive,
              )}
              aria-label={peekAriaLabel}
              aria-expanded={false}
              data-testid="barn-sheet-peek-handle"
              data-sheet-drag-handle
              onClick={() => onExpand?.()}
              onTouchStart={onPeekTouchStart}
              onTouchEnd={onPeekTouchEnd}
              onTouchCancel={() => {
                startYRef.current = null;
              }}
            >
              <span
                className="h-2 w-14 rounded-full bg-muted-foreground/50"
                aria-hidden
              />
            </button>
          </div>,
          host,
        )
      : null;

  return (
    <>
      {peekHandle}
      <Dialog
        open={open && !peek}
        onOpenChange={(next, eventDetails) => {
          if (next) return;
          if (suppressFocusOutClose && eventDetails.reason === "focus-out") {
            eventDetails.cancel();
            return;
          }
          if (onPeek && eventDetails.reason !== "close-press") {
            eventDetails.cancel();
            handlePeek();
            return;
          }
          handleClose();
        }}
      >
      <DialogContent
        showCloseButton={!onPeek}
        className={cn(
          "top-auto flex max-h-none flex-col gap-0 overflow-hidden rounded-b-none rounded-t-xl p-0 pb-[env(safe-area-inset-bottom,0px)]",
          motionClass.durationEmphasis,
          motionClass.easeEmphasis,
          motionClass.sheetEnter,
          viewportCompact
            ? "bottom-auto left-1/2 h-full w-full -translate-x-1/2 translate-y-0"
            : "bottom-0 h-[85dvh] max-h-[85dvh] left-0 w-full max-w-none translate-x-0 translate-y-0 sm:max-w-none md:h-[min(85dvh,36rem)] md:max-h-[min(85dvh,36rem)]",
          className,
        )}
        style={
          dragY > 0
            ? {
                transform: `translateY(${dragY}px)`,
                transition: dragging ? "none" : undefined,
              }
            : undefined
        }
        data-mobile-viewport-sheet={viewportCompact || undefined}
        data-audit-region={auditRegion}
      >
        <div
          className="flex min-h-11 shrink-0 cursor-grab touch-none items-center justify-center pt-3 pb-2 active:cursor-grabbing"
          data-sheet-drag-handle
          aria-label={onPeek ? "시트를 아래로 끌어 접기" : "시트를 아래로 끌어 닫기"}
          onTouchStart={onHandleTouchStart}
          onTouchMove={onHandleTouchMove}
          onTouchEnd={onHandleTouchEnd}
          onTouchCancel={onHandleTouchEnd}
        >
          <span className="h-1.5 w-12 rounded-full bg-muted-foreground/40" aria-hidden />
        </div>
        <DialogHeader className="relative shrink-0 border-b px-4 py-3">
          <div className="flex items-center gap-2 pr-8">
            {onBack ? (
              <button
                type="button"
                onClick={onBack}
                className="shrink-0 rounded-md border px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-muted/60 hover:text-foreground"
              >
                {backLabel}
              </button>
            ) : null}
            <DialogTitle className="min-w-0 flex-1 text-sm font-semibold">
              {title}
            </DialogTitle>
          </div>
          {onPeek ? (
            <button
              type="button"
              className="absolute top-2 right-2 inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted/60 hover:text-foreground"
              aria-label="시트 닫기"
              onClick={handleClose}
            >
              <XIcon className="size-4" aria-hidden />
            </button>
          ) : null}
        </DialogHeader>
        <div
          className={cn(
            "flex min-h-0 flex-1 flex-col overflow-hidden",
            contentClassName,
          )}
        >
          {children}
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
}
