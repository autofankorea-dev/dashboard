"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AlertCircle, Info } from "lucide-react";
import { dashboardAffordance } from "@/lib/ui/dashboard-page-ui";
import { cn } from "@/lib/utils";
import { motionDuration } from "@/lib/ui/motion-tokens";
import { FEEDBACK_Z } from "@/lib/ui/feedback-layers";
import { opsFeedbackIcon, opsFeedbackTone } from "@/lib/ui/ops-feedback";
import type { CommandConfirmModel } from "@/lib/farm/command-confirm";
import { useSheetCopy } from "@/components/account/profile-sheet-prefs";

type Props = {
  model: CommandConfirmModel | null;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

const btnClass =
  "inline-flex min-h-9 items-center justify-center rounded-md px-3 py-1.5 text-sm font-medium leading-snug";

/** 명령 전송 전 승인 — CommandPipelineOverlay와 같은 메시지 카드 셸 */
export function CommandConfirmOverlay({
  model,
  busy = false,
  onCancel,
  onConfirm,
}: Props) {
  const t = useSheetCopy();
  const [mounted, setMounted] = useState(false);
  const [show, setShow] = useState(false);
  const visible = model != null;
  const titleId = useId();
  const descId = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);
  const onCancelRef = useRef(onCancel);
  const onConfirmRef = useRef(onConfirm);
  const sentRef = useRef(false);

  useEffect(() => {
    onCancelRef.current = onCancel;
    onConfirmRef.current = onConfirm;
  }, [onCancel, onConfirm]);

  useEffect(() => {
    sentRef.current = false;
  }, [model]);

  if (!visible) {
    if (show) setShow(false);
  } else if (!mounted) {
    setMounted(true);
  }

  useEffect(() => {
    if (!visible) {
      const t = window.setTimeout(
        () => setMounted(false),
        motionDuration.normal + 20,
      );
      return () => window.clearTimeout(t);
    }
    const id = window.requestAnimationFrame(() => setShow(true));
    return () => window.cancelAnimationFrame(id);
  }, [visible]);

  useEffect(() => {
    if (!visible || !show) return;
    cancelRef.current?.focus();
  }, [visible, show]);

  useEffect(() => {
    if (!visible) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onCancelRef.current();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [visible]);

  const handleConfirm = () => {
    if (busy || sentRef.current) return;
    sentRef.current = true;
    onConfirmRef.current();
  };

  if (!mounted || typeof document === "undefined" || !model) return null;

  return createPortal(
    <div
      className={cn(
        "ui-motion-command-overlay fixed inset-0 flex items-center justify-center p-4",
        show ? "opacity-100" : "opacity-0",
      )}
      style={{ zIndex: FEEDBACK_Z.overlay }}
      data-feedback-layer="overlay"
      data-mobile-viewport-overlay
      role="presentation"
      onClick={() => {
        if (!busy) onCancel();
      }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        className={cn(
          "ui-motion-command-card max-w-[min(100vw-2rem,25rem)] rounded-xl border bg-background/95 px-5 py-4 text-center shadow-xl ring-1 ring-border/60 backdrop-blur-sm",
          opsFeedbackTone.info,
          show
            ? "translate-y-0 scale-100 opacity-100"
            : "translate-y-2 scale-95 opacity-0",
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <Info
          className={cn("mx-auto mb-2.5 size-8", opsFeedbackIcon.info)}
          aria-hidden
        />
        <p
          id={titleId}
          className="text-sm font-semibold leading-snug text-foreground"
        >
          {model.title}
        </p>
        <div id={descId} className="mt-2.5 space-y-2">
          <p className="text-xs leading-snug text-muted-foreground">
            <span className="font-semibold text-foreground">{t("confirm.target")} </span>
            {model.target}
          </p>
          <div className="flex flex-col items-center gap-1">
            {model.lines.map((line, index) => (
              <p
                key={`${line.label}-${index}`}
                className="flex items-center justify-center gap-2 text-xs leading-snug text-muted-foreground"
              >
                <span className="min-w-[4.5rem] text-right font-semibold text-foreground">
                  {line.label}:
                </span>
                <span
                  className={cn(
                    "inline-flex w-[4.25rem] items-center justify-end gap-1 tabular-nums",
                    line.fromWarn &&
                      "font-semibold text-[var(--status-warn)]",
                  )}
                >
                  {line.fromWarn ? (
                    <AlertCircle
                      className={cn(
                        "size-3.5 shrink-0",
                        opsFeedbackIcon.warn,
                      )}
                      aria-hidden
                    />
                  ) : null}
                  {line.from}
                </span>
                <span className="text-muted-foreground/80" aria-hidden>
                  →
                </span>
                <span className="w-[3.25rem] text-left font-semibold tabular-nums text-foreground">
                  {line.to}
                </span>
              </p>
            ))}
          </div>
        </div>
        <div className="mt-4 flex items-center justify-center gap-2">
          <button
            ref={cancelRef}
            type="button"
            className={cn(btnClass, dashboardAffordance.tool)}
            disabled={busy}
            onClick={onCancel}
          >
            {t("confirm.cancel")}
          </button>
          <button
            type="button"
            className={cn(btnClass, dashboardAffordance.action)}
            disabled={busy}
            aria-busy={busy || undefined}
            onClick={handleConfirm}
          >
            {t("confirm.send")}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
