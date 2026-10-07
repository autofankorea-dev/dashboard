"use client";

import { useEffect, useSyncExternalStore } from "react";

import { DashboardViewportProvider } from "@/components/layout/dashboard-viewport-context";
import { PushDeviceRegistrar } from "@/components/layout/push-device-registrar";
import {
  getViewportPreviewMode,
  isViewportCompact,
  subscribeViewportPreview,
  syncViewportPreviewToDocument,
} from "@/lib/ui/viewport-preview-store";
import { cn } from "@/lib/utils";

type Role = "admin" | "operator" | "viewer";

type Props = {
  children: React.ReactNode;
  /** @deprecated 하단 단일 탭 제거 — 호환용으로 유지 */
  role?: Role | null;
};

/** 토글 기준 compact 레이아웃 (브라우저 너비·비율 무관). 보기 탭은 하단 독. */
export function DashboardViewportShell({ children }: Props) {
  const previewMode = useSyncExternalStore(
    subscribeViewportPreview,
    getViewportPreviewMode,
    () => "desktop" as const,
  );

  const compact = isViewportCompact(previewMode);

  useEffect(() => {
    syncViewportPreviewToDocument(previewMode);
  }, [previewMode]);

  return (
    <DashboardViewportProvider compact={compact}>
      <PushDeviceRegistrar />
      <div
        className={cn(
          "flex h-[100dvh] min-w-0 flex-col overflow-hidden",
          compact &&
            "items-center justify-center bg-muted/50 dark:bg-muted/25",
        )}
      >
        <div
          data-dashboard-compact={compact || undefined}
          data-viewport-preview={previewMode}
          data-mobile-preview-frame={compact || undefined}
          className={cn(
            "relative flex min-h-0 w-full flex-col overflow-hidden bg-background",
            compact
              ? "shadow-xl ring-1 ring-border/60"
              : "h-full",
          )}
        >
          <div
            className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
            data-dashboard-overlay-host=""
          >
            {children}
          </div>
          {compact ? (
            <div
              className={cn(
                /* absolute 금지 — 프레임 overflow에 하단이 잘림. flex 흐름 + shrink-0 */
                "z-40 flex shrink-0 border-t bg-background/95 backdrop-blur",
                "supports-[backdrop-filter]:bg-background/90",
                "px-3 pt-2",
                /* 프리뷰(safe-area=0)에서도 탭 하단이 프레임에 붙지 않게 */
                "pb-[max(0.5rem,env(safe-area-inset-bottom,0px))]",
              )}
              data-farm-view-toggle-dock
            >
              <div
                data-farm-view-toggle-slot="mobile"
                className="mx-auto flex w-full max-w-lg items-center justify-center empty:hidden"
              />
            </div>
          ) : null}
        </div>
      </div>
    </DashboardViewportProvider>
  );
}
