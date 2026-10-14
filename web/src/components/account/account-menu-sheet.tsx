"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { useSheetCopy } from "@/components/account/profile-sheet-prefs";
import { useHydrationSafeDashboardCompact } from "@/components/layout/dashboard-viewport-context";
import { ACCOUNT_MENU_SHEET_Z, accountMenuLayout } from "@/lib/ui/account-menu-layout";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
};

type SheetMotionState = "open" | "exit";

const emptySubscribe = () => () => {};

function resolvePortalRoot(compact: boolean): HTMLElement | null {
  if (typeof window === "undefined") return null;
  if (compact) {
    const frame = document.querySelector("[data-mobile-preview-frame]");
    if (frame instanceof HTMLElement) return frame;
  }
  return document.body;
}

function measureHeaderBottom(portalRoot: HTMLElement): number {
  const header = document.querySelector("[data-app-header]");
  if (!header) return 0;
  const headerRect = header.getBoundingClientRect();
  if (portalRoot !== document.body) {
    const rootRect = portalRoot.getBoundingClientRect();
    return Math.max(0, Math.round(headerRect.bottom - rootRect.top));
  }
  return Math.round(headerRect.bottom);
}

function subscribeSheetLayout(
  compact: boolean,
  enabled: boolean,
  onStoreChange: () => void,
) {
  if (!enabled || typeof window === "undefined") return () => {};
  const header = document.querySelector("[data-app-header]");
  const root = resolvePortalRoot(compact);
  const ro =
    typeof ResizeObserver !== "undefined"
      ? new ResizeObserver(onStoreChange)
      : null;
  if (header) ro?.observe(header);
  if (root && root !== document.body) ro?.observe(root);
  window.addEventListener("resize", onStoreChange);
  window.addEventListener("scroll", onStoreChange, true);
  return () => {
    ro?.disconnect();
    window.removeEventListener("resize", onStoreChange);
    window.removeEventListener("scroll", onStoreChange, true);
  };
}

type SheetLayoutSnapshot = {
  portalRoot: HTMLElement | null;
  headerBottom: number;
};

const EMPTY_SHEET_LAYOUT: SheetLayoutSnapshot = {
  portalRoot: null,
  headerBottom: 0,
};

function useSheetLayout(compact: boolean, enabled: boolean) {
  const snapshotRef = useRef<SheetLayoutSnapshot>(EMPTY_SHEET_LAYOUT);

  const getSnapshot = useCallback(() => {
    if (!enabled || typeof window === "undefined") {
      return EMPTY_SHEET_LAYOUT;
    }
    const portalRoot = resolvePortalRoot(compact);
    const headerBottom = portalRoot ? measureHeaderBottom(portalRoot) : 0;
    const prev = snapshotRef.current;
    if (prev.portalRoot === portalRoot && prev.headerBottom === headerBottom) {
      return prev;
    }
    const next = { portalRoot, headerBottom };
    snapshotRef.current = next;
    return next;
  }, [compact, enabled]);

  return useSyncExternalStore(
    (onStoreChange) => subscribeSheetLayout(compact, enabled, onStoreChange),
    getSnapshot,
    () => EMPTY_SHEET_LAYOUT,
  );
}

export function AccountMenuSheet({ open, onOpenChange, children }: Props) {
  const t = useSheetCopy();
  const compact = useHydrationSafeDashboardCompact();
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);
  const [sheet, setSheet] = useState({
    visible: false,
    motion: "open" as SheetMotionState,
    lastOpen: open,
  });
  const panelRef = useRef<HTMLDivElement>(null);

  if (open !== sheet.lastOpen) {
    if (open) {
      setSheet({ visible: true, motion: "open", lastOpen: open });
    } else {
      setSheet((prev) => ({
        ...prev,
        motion: "exit",
        lastOpen: open,
      }));
    }
  }

  const { visible, motion: motionState } = sheet;
  const { portalRoot, headerBottom } = useSheetLayout(compact, visible && mounted);
  const inPreviewFrame =
    portalRoot != null && portalRoot !== document.body;

  useEffect(() => {
    if (!visible) return;

    const root = resolvePortalRoot(compact);
    if (!root) return;
    const scrollTarget = root === document.body ? document.body : root;
    const prevOverflow = scrollTarget.style.overflow;
    scrollTarget.style.overflow = "hidden";

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onOpenChange(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);

    return () => {
      scrollTarget.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [visible, compact, onOpenChange]);

  useEffect(() => {
    if (motionState === "open" && visible && panelRef.current) {
      panelRef.current.focus({ preventScroll: true });
    }
  }, [motionState, visible]);

  const finishExit = useCallback(() => {
    setSheet((prev) => {
      if (!prev.visible || prev.motion !== "exit") return prev;
      return { ...prev, visible: false, motion: "open" };
    });
  }, []);

  const handlePanelAnimationEnd = useCallback(
    (e: React.AnimationEvent<HTMLDivElement>) => {
      if (e.target !== e.currentTarget) return;
      if (motionState !== "exit") return;
      const name = e.animationName;
      if (
        name === "account-menu-sheet-panel-out" ||
        name === "none" ||
        name === ""
      ) {
        finishExit();
      }
    },
    [finishExit, motionState],
  );

  const handleBackdropAnimationEnd = useCallback(
    (e: React.AnimationEvent<HTMLButtonElement>) => {
      if (motionState !== "exit") return;
      if (e.animationName === "ui-motion-fade-out") {
        finishExit();
      }
    },
    [finishExit, motionState],
  );

  if (!mounted || !visible || !portalRoot) return null;

  return createPortal(
    <>
      <button
        type="button"
        className={cn(
          accountMenuLayout.sheetBackdrop,
          inPreviewFrame
            ? accountMenuLayout.sheetBackdropAbsolute
            : accountMenuLayout.sheetBackdropFixed,
        )}
        style={{ top: headerBottom, zIndex: ACCOUNT_MENU_SHEET_Z - 1 }}
        data-state={motionState}
        data-account-menu-sheet-backdrop
        aria-label={t("account.close")}
        onClick={() => onOpenChange(false)}
        onAnimationEnd={handleBackdropAnimationEnd}
      />
      <div
        ref={panelRef}
        id="account-menu-sheet"
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        aria-labelledby="account-menu-sheet-title"
        data-state={motionState}
        data-tour-id="account-menu-panel"
        data-account-menu-sheet-panel
        className={cn(
          accountMenuLayout.sheetPanel,
          inPreviewFrame
            ? accountMenuLayout.sheetPanelInFrame
            : accountMenuLayout.sheetPanelFixed,
        )}
        style={{
          top: headerBottom,
          zIndex: ACCOUNT_MENU_SHEET_Z,
          ["--account-menu-sheet-top" as string]: `${headerBottom}px`,
        }}
        onPointerDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        onAnimationEnd={handlePanelAnimationEnd}
      >
        <div className={accountMenuLayout.sheetInner}>{children}</div>
      </div>
    </>,
    portalRoot,
  );
}
