"use client";

import { useCallback, useState, useSyncExternalStore, useTransition } from "react";
import { FileText, Loader2 } from "lucide-react";
import { fetchDailyReportPayloadAction } from "@/app/(dashboard)/farm/actions";
import { CommandPipelineOverlay } from "@/components/farm/command-pipeline-overlay";
import {
  InlineStatusToast,
  type InlineStatusTone,
} from "@/components/common/inline-status-toast";
import { parseFarmKeyFromQuery, type FarmKey } from "@/lib/domain/farm-key";
import { dailyReportPdfFilename } from "@/lib/report/daily-report-payload";
import {
  currentFarmSearchParams,
  getFarmUrlEpoch,
  getFarmUrlEpochServer,
  subscribeFarmUrlEpoch,
} from "@/lib/farm/farm-view-url";
import { ReportTemplateExample } from "@/components/account/tool-card-examples";
import { useSheetCopy } from "@/components/account/profile-sheet-prefs";
import { accountMenuLayout } from "@/lib/ui/account-menu-layout";
import { dashboardUi } from "@/lib/ui/dashboard-page-ui";
import { cn } from "@/lib/utils";

type Props = {
  /** SSR PageShell 값 — shallow 농장 전환 시 stale 할 수 있음 */
  farmKey: FarmKey | null;
  /** icon = 헤더 단독 · row = 간단 행 · tools-card = 헤더 카드 · hub-detail = FAB 상세 */
  presentation?: "icon" | "row" | "tools-card" | "hub-detail";
  className?: string;
};

function resolveReportFarmKey(serverFarmKey: FarmKey | null): FarmKey | null {
  const params = currentFarmSearchParams();
  const fromUrl = parseFarmKeyFromQuery(params.get("lsind"), params.get("item"));
  return fromUrl ?? serverFarmKey;
}

export function DailyReportButton({
  farmKey: serverFarmKey,
  presentation = "icon",
  className,
}: Props) {
  const t = useSheetCopy();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    tone: InlineStatusTone;
  } | null>(null);
  const [overlay, setOverlay] = useState({
    visible: false,
    phase: "loading" as "loading" | "success" | "error",
    title: "",
    detail: undefined as string | undefined,
  });

  /** shallow hub 농장 전환은 TopBar(SSR)를 갱신하지 않음 → URL epoch로 동기화 */
  const urlEpoch = useSyncExternalStore(
    subscribeFarmUrlEpoch,
    getFarmUrlEpoch,
    getFarmUrlEpochServer,
  );
  const farmKey = resolveReportFarmKey(serverFarmKey);
  void urlEpoch;

  const needsFarm = !farmKey;
  const busyLocked = busy || pending;
  /** 네이티브 disabled면 클릭이 막혀 토스트를 못 띄움 — 농장 미선택만 aria-disabled. */
  const nativeDisabled = busyLocked;

  const dismissToast = useCallback(() => setToast(null), []);

  const run = () => {
    if (busyLocked) return;
    const key = resolveReportFarmKey(serverFarmKey);
    if (!key) {
      setToast({ message: t("report.noFarm"), tone: "warn" });
      return;
    }
    setToast(null);
    setBusy(true);
    setOverlay({
      visible: true,
      phase: "loading",
      title: t("report.building"),
      detail: t("report.collecting"),
    });

    startTransition(() => {
      void (async () => {
        try {
          const payload = await fetchDailyReportPayloadAction(key);
          if (!payload.barns.length) {
            throw new Error(t("report.noBarns"));
          }
          setOverlay((o) => ({
            ...o,
            detail: t("report.composing"),
          }));
          const { buildAndDownloadDailyReportPdf } = await import(
            "@/lib/report/build-daily-report-pdf"
          );
          await buildAndDownloadDailyReportPdf(payload, (p) => {
            setOverlay({
              visible: true,
              phase: "loading",
              title: t("report.building"),
              detail: `${p.message} (${p.current}/${p.total})`,
            });
          });
          setOverlay({
            visible: true,
            phase: "success",
            title: t("report.done"),
            detail: dailyReportPdfFilename(payload),
          });
        } catch (err) {
          const message =
            err instanceof Error ? err.message : t("report.failed");
          setOverlay({
            visible: true,
            phase: "error",
            title: t("report.failed"),
            detail: message,
          });
        } finally {
          setBusy(false);
        }
      })();
    });
  };

  const downloadButton = (
      <button
        type="button"
        className={cn(
          presentation === "tools-card"
            ? cn(
                accountMenuLayout.compactBtn,
                "h-8 w-full justify-center",
                needsFarm && "opacity-40",
              )
            : presentation === "hub-detail"
              ? cn(
                  dashboardUi.hubDetailActionRow,
                  needsFarm && "opacity-40",
                )
              : presentation === "row"
                ? cn(
                    "flex w-full items-center gap-2.5 rounded-lg border px-2.5 py-2 text-left text-sm transition-colors hover:bg-muted/60",
                    dashboardUi.topHeaderActionBtnReport,
                    needsFarm && "opacity-40",
                  )
                : cn(
                    dashboardUi.topHeaderActionBtn,
                    dashboardUi.topHeaderActionBtnReport,
                    needsFarm && "opacity-40",
                  ),
          presentation === "tools-card" ? undefined : className,
        )}
        data-tour-id="header-daily-report"
        aria-label={
          farmKey ? t("tools.reportPdf") : t("tools.reportNeedFarm")
        }
        title={
          farmKey ? t("tools.report") : t("tools.reportNeedFarmHint")
        }
        aria-disabled={needsFarm || undefined}
        disabled={nativeDisabled}
        onClick={run}
      >
        {presentation === "tools-card" ? (
          busy ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : t("tools.pdf")
        ) : presentation === "hub-detail" ? (
          <>
            <span
              className={cn(
                dashboardUi.hubDetailLeadIcon,
                dashboardUi.hubDetailLeadIconReport,
              )}
              aria-hidden
            >
              {busy ? (
                <Loader2 className="size-4 animate-spin md:size-5" />
              ) : (
                <FileText className="size-4 md:size-5" />
              )}
            </span>
            <div className={dashboardUi.hubDetailBody}>
              <div className={dashboardUi.hubDetailTitle}>{t("tools.report")}</div>
              <p className={dashboardUi.hubDetailMeta}>
                {needsFarm ? t("tools.reportAfterFarmShort") : t("tools.pdf")}
              </p>
            </div>
          </>
        ) : (
          <>
            {busy ? (
              <Loader2
                className="size-4 shrink-0 animate-spin md:size-5"
                aria-hidden
              />
            ) : (
              <FileText className="size-4 shrink-0 md:size-5" aria-hidden />
            )}
            {presentation === "row" ? (
              <span className="font-medium">{t("tools.report")}</span>
            ) : null}
          </>
        )}
      </button>
  );

  return (
    <>
      {presentation === "tools-card" ? (
        <div
          className={cn(
            "flex min-w-0 flex-col gap-1.5",
            accountMenuLayout.previewReport,
            className,
          )}
        >
          <div className="flex min-w-0 items-center justify-between gap-2 px-0.5">
            <span className={accountMenuLayout.contextFarm}>{t("tools.report")}</span>
            <span className="shrink-0 text-xs text-muted-foreground">
              {needsFarm ? t("tools.reportAfterFarm") : t("tools.pdf")}
            </span>
          </div>
          <ReportTemplateExample />
          {downloadButton}
        </div>
      ) : (
        downloadButton
      )}
      <InlineStatusToast
        message={toast?.message ?? null}
        tone={toast?.tone ?? "warn"}
        onDismiss={dismissToast}
      />
      <CommandPipelineOverlay
        visible={overlay.visible}
        phase={overlay.phase}
        title={overlay.title}
        detail={overlay.detail}
        autoDismiss={overlay.phase !== "loading"}
        onDismiss={
          overlay.phase === "loading"
            ? undefined
            : () => setOverlay((o) => ({ ...o, visible: false }))
        }
      />
    </>
  );
}
