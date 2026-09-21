"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { dashboardAffordance } from "@/lib/ui/dashboard-page-ui";
import { cn } from "@/lib/utils";
import { motionClass } from "@/lib/ui/motion-classes";
import { FEEDBACK_Z } from "@/lib/ui/feedback-layers";
import { BusyButtonLabel } from "@/components/common/busy-button-label";

type Props = {
  open: boolean;
  title: string;
  children: ReactNode;
  primaryLabel: string | null;
  primaryBusyLabel?: string;
  primaryDisabled?: boolean;
  busy?: boolean;
  hint?: string;
  onClose: () => void;
  onPrimary?: () => void;
  closeLabel?: string;
};

const btnClass =
  "inline-flex min-h-9 min-w-0 flex-1 items-center justify-center rounded-md px-3 py-1.5 text-sm font-medium leading-snug";

/** 한눈 행 편집 — CommandConfirmOverlay와 같은 중앙 덮개 셸. 자식은 닫혀도 유지. */
export function SettingsEditOverlay({
  open,
  title,
  children,
  primaryLabel,
  primaryBusyLabel,
  primaryDisabled = false,
  busy = false,
  hint,
  onClose,
  onPrimary,
  closeLabel = "닫기",
}: Props) {
  const [mounted, setMounted] = useState(false);
  const [show, setShow] = useState(false);
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const primaryRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  const onPrimaryRef = useRef(onPrimary);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);
  useEffect(() => {
    onPrimaryRef.current = onPrimary;
  }, [onPrimary]);

  if (typeof document !== "undefined" && !mounted) {
    setMounted(true);
  }
  if (!open) {
    if (show) setShow(false);
  }

  useEffect(() => {
    if (!open) return;
    const id = window.requestAnimationFrame(() => setShow(true));
    return () => window.cancelAnimationFrame(id);
  }, [open]);

  useEffect(() => {
    if (!open || !show) return;
    const primary = primaryRef.current;
    if (primary && !primary.disabled) {
      primary.focus();
      return;
    }
    closeRef.current?.focus();
  }, [open, show]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        if (!busy) onCloseRef.current();
        return;
      }
      if (e.key !== "Enter" || e.repeat || e.isComposing || e.keyCode === 229) {
        return;
      }
      const confirm = onPrimaryRef.current;
      if (!confirm || busy || primaryDisabled) return;
      const el = e.target;
      if (el instanceof HTMLTextAreaElement) return;
      if (el instanceof HTMLElement && el.isContentEditable) return;
      e.preventDefault();
      e.stopPropagation();
      confirm();
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [open, busy, primaryDisabled]);

  if (!mounted || typeof document === "undefined") return null;

  return createPortal(
    <div
      className={cn(
        motionClass.commandOverlay,
        "fixed inset-0 flex items-center justify-center p-4",
        show && open ? "opacity-100" : "opacity-0",
        !open && "pointer-events-none invisible hidden",
      )}
      style={{ zIndex: FEEDBACK_Z.overlay }}
      data-feedback-layer={open ? "overlay" : undefined}
      data-audit-region="settings-edit-overlay"
      data-mobile-viewport-overlay={open ? true : undefined}
      role="presentation"
      aria-hidden={!open}
      onClick={() => {
        if (open && !busy) onClose();
      }}
    >
      <div
        role={open ? "dialog" : undefined}
        aria-modal={open ? true : undefined}
        aria-labelledby={open ? titleId : undefined}
        className={cn(
          motionClass.commandCard,
          "w-full max-w-[min(100vw-2rem,25rem)] rounded-xl border bg-background px-4 py-4 text-left ring-1 ring-border/60 select-none",
          "[&_input]:select-text [&_textarea]:select-text",
          show && open
            ? "translate-y-0 scale-100 opacity-100"
            : "translate-y-2 scale-95 opacity-100",
        )}
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => {
          if (e.detail > 1) e.preventDefault();
        }}
      >
        <p
          id={titleId}
          className="text-sm font-semibold leading-snug text-foreground"
        >
          {title}
        </p>
        <div className="mt-3">{children}</div>
        <div className={cn("mt-4 flex items-center justify-center gap-2", !open && "hidden")}>
          <button
            ref={closeRef}
            type="button"
            className={cn(btnClass, dashboardAffordance.tool)}
            disabled={busy}
            tabIndex={open ? 0 : -1}
            onClick={onClose}
          >
            {closeLabel}
          </button>
          {primaryLabel && onPrimary ? (
            <button
              ref={primaryRef}
              type="button"
              className={cn(btnClass, dashboardAffordance.action)}
              disabled={primaryDisabled || busy}
              tabIndex={open ? 0 : -1}
              aria-busy={busy || undefined}
              onClick={onPrimary}
            >
              <BusyButtonLabel
                busy={busy}
                idleLabel={primaryLabel}
                busyLabel={primaryBusyLabel ?? primaryLabel}
              />
            </button>
          ) : null}
        </div>
        {hint && open ? (
          <p className="mt-2 text-center text-xs text-muted-foreground">
            {hint}
          </p>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
