"use client";

import { useCallback, useState, useSyncExternalStore, useTransition } from "react";
import { FileText, Loader2 } from "lucide-react";
import { fetchDailyReportPayloadAction } from "@/app/(dashboard)/farm/actions";
import { CommandPipelineOverlay } from "@/components/farm/command-pipeline-overlay";
import {
  InlineStatusToast,
  type InlineStatusTone,
} from "@/components/common/inline-status-toast";
import { parseFarmKeyFromQuery, type FarmKey } from "@/lib/data/farm-key";
import { dailyReportPdfFilename } from "@/lib/report/daily-report-payload";
import {
  currentFarmSearchParams,
  getFarmUrlEpoch,
  getFarmUrlEpochServer,
  subscribeFarmUrlEpoch,
} from "@/lib/farm/farm-view-url";
import { dashboardUi } from "@/lib/ui/dashboard-page-ui";
import { cn } from "@/lib/utils";

type Props = {
  /** SSR PageShell 값 — shallow 농장 전환 시 stale 할 수 있음 */
  farmKey: FarmKey | null;
  /** icon = 헤더 단독 · row = 간단 행 · tools-card = 헤더 카드 · hub-detail = FAB 상세 */
  presentation?: "icon" | "row" | "tools-card" | "hub-detail";
  className?: string;
};

const NO_FARM_TOAST =
  "농장을 선택한 뒤 오늘의 리포트를 받을 수 있습니다.";

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
      setToast({ message: NO_FARM_TOAST, tone: "warn" });
      return;
    }
    setToast(null);
    setBusy(true);
    setOverlay({
      visible: true,
      phase: "loading",
      title: "보고서 작성 중…",
      detail: "데이터 수집 중",
    });

    startTransition(() => {
      void (async () => {
        try {
          const payload = await fetchDailyReportPayloadAction(key);
          if (!payload.barns.length) {
            throw new Error("출력할 축사 데이터가 없습니다.");
          }
          setOverlay((o) => ({
            ...o,
            detail: `30일 브리핑 PDF 구성 중`,
          }));
          const { buildAndDownloadDailyReportPdf } = await import(
            "@/lib/report/build-daily-report-pdf"
          );
          await buildAndDownloadDailyReportPdf(payload, (p) => {
            setOverlay({
              visible: true,
              phase: "loading",
              title: "보고서 작성 중…",
              detail: `${p.message} (${p.current}/${p.total})`,
            });
          });
          setOverlay({
            visible: true,
            phase: "success",
            title: "PDF 다운로드 완료",
            detail: dailyReportPdfFilename(payload),
          });
        } catch (err) {
          const message =
            err instanceof Error ? err.message : "보고서 생성에 실패했습니다.";
          setOverlay({
            visible: true,
            phase: "error",
            title: "보고서 작성 실패",
            detail: message,
          });
        } finally {
          setBusy(false);
        }
      })();
    });
  };

  return (
    <>
      <button
        type="button"
        className={cn(
          presentation === "tools-card"
            ? cn(
                dashboardUi.headerToolsCard,
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
          className,
        )}
        data-tour-id="header-daily-report"
        aria-label={
          farmKey
            ? "오늘의 리포트 PDF 다운로드"
            : "오늘의 리포트 (농장 선택 필요)"
        }
        title={
          farmKey
            ? "오늘의 리포트"
            : "농장을 선택한 뒤 리포트를 받을 수 있습니다"
        }
        aria-disabled={needsFarm || undefined}
        disabled={nativeDisabled}
        onClick={run}
      >
        {presentation === "tools-card" ? (
          <>
            <span
              className={cn(
                dashboardUi.headerToolsCardIcon,
                dashboardUi.headerToolsCardIconReport,
              )}
              aria-hidden
            >
              {busy ? (
                <Loader2 className="size-4 animate-spin md:size-5" />
              ) : (
                <FileText className="size-4 md:size-5" />
              )}
            </span>
            <div className={dashboardUi.headerToolsCardBody}>
              <div className={dashboardUi.headerToolsCardTitle}>
                오늘의 리포트
              </div>
              <p className={dashboardUi.headerToolsCardMeta}>
                {needsFarm
                  ? "농장 선택 후 받을 수 있습니다"
                  : "PDF 다운로드"}
              </p>
            </div>
          </>
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
              <div className={dashboardUi.hubDetailTitle}>오늘의 리포트</div>
              <p className={dashboardUi.hubDetailMeta}>
                {needsFarm ? "농장 선택 후 다운로드" : "PDF 다운로드"}
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
              <span className="font-medium">오늘의 리포트</span>
            ) : null}
          </>
        )}
      </button>
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
