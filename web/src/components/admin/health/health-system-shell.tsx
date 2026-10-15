"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { HealthSnapshot, HealthNodeId, HealthStatus } from "@/lib/admin/health/types";
import {
  countHealthStatuses,
  worstHealthStatus,
} from "@/lib/admin/health/health-ui-labels";
import { healthUiText } from "@/lib/admin/health/health-locale";
import { useProfileSheetPrefs } from "@/components/account/profile-sheet-prefs";
import { parseHealthNodeId } from "@/lib/admin/health/health-routes";
import { farmKeyUrlSlug } from "@/lib/domain/farm-key";
import type { HealthDagNodeSelectPayload } from "@/lib/admin/health/health-node-peek-content";
import { fetchHealthSnapshotAction } from "@/app/(dashboard)/admin/ops/health-actions";
import { HealthDagGraph } from "@/components/admin/health/health-dag-graph";
import { HealthDataPathStrip } from "@/components/admin/health/health-data-path-strip";
import { HealthFarmModulePanel } from "@/components/admin/health/health-farm-module-panel";
import { HealthNodeInspector } from "@/components/admin/health/health-node-inspector";
import { useOpsInspectorOptional } from "@/components/admin/ops-inspector-context";
import { HealthOverallStatus } from "@/components/admin/health/health-overall-status";
import { HealthRefreshBar } from "@/components/admin/health/health-refresh-bar";
import { opsControl, opsTypography } from "@/lib/ui/dashboard-page-ui";
import { useMobileLayout } from "@/lib/ui/use-mobile-layout";
import { cn } from "@/lib/utils";

type Props = {
  snapshot: HealthSnapshot;
};

function needsAttention(status: HealthStatus): boolean {
  return status === "warn" || status === "critical" || status === "unknown";
}

const SUPPRESS_AUTO_KEY = "ops-health-suppress-auto";

function readSuppressKey(): string | null {
  try {
    return sessionStorage.getItem(SUPPRESS_AUTO_KEY);
  } catch {
    return null;
  }
}

function writeSuppressKey(key: string | null) {
  try {
    if (key) sessionStorage.setItem(SUPPRESS_AUTO_KEY, key);
    else sessionStorage.removeItem(SUPPRESS_AUTO_KEY);
  } catch {
    /* ignore quota / private mode */
  }
}

export function HealthSystemShell({ snapshot }: Props) {
  const isMobileLayout = useMobileLayout();
  const locale = useProfileSheetPrefs().locale;
  const searchParams = useSearchParams();
  const queryNodeId = parseHealthNodeId(searchParams.get("node"));
  const queryFarmId = searchParams.get("farm")?.trim() || null;
  const queryModulesOpen = searchParams.get("modules") === "1";
  const pageInspector = useOpsInspectorOptional();
  const [liveSnapshot, setLiveSnapshot] = useState(snapshot);
  const [localNodeId, setLocalNodeId] = useState<HealthNodeId | null>(null);
  const [urlDialogDismissed, setUrlDialogDismissed] = useState(false);
  const [seenQueryNode, setSeenQueryNode] = useState(queryNodeId);
  const [userDetailOpen, setUserDetailOpen] = useState(false);
  /** SSR·hydration은 null — sessionStorage는 mount 후 동기화 */
  const [suppressAutoKey, setSuppressAutoKey] = useState<string | null>(null);
  const [snapshotProp, setSnapshotProp] = useState(snapshot);

  if (snapshot !== snapshotProp) {
    setSnapshotProp(snapshot);
    setLiveSnapshot(snapshot);
  }

  const liveRef = useRef(liveSnapshot);
  useEffect(() => {
    liveRef.current = liveSnapshot;
  }, [liveSnapshot]);

  useEffect(() => {
    queueMicrotask(() => setSuppressAutoKey(readSuppressKey()));
  }, []);

  const patchSnapshot = useCallback(async () => {
    const next = await fetchHealthSnapshotAction();
    setLiveSnapshot(next);
    pageInspector?.setSnapshot(next);
  }, [pageInspector]);

  const moduleCounts = useMemo(
    () => countHealthStatuses(liveSnapshot.modules),
    [liveSnapshot.modules],
  );
  const overallStatus = worstHealthStatus(moduleCounts);
  const pipelineBad = liveSnapshot.pipeline.some((n) => needsAttention(n.status));
  const autoDetail =
    queryModulesOpen || Boolean(queryFarmId) || pipelineBad || needsAttention(overallStatus);
  const autoKey = `${queryFarmId ?? ""}|${queryModulesOpen}|${overallStatus}|${pipelineBad}`;
  const detailOpen =
    userDetailOpen || (autoDetail && suppressAutoKey !== autoKey);

  if (queryNodeId !== seenQueryNode) {
    setSeenQueryNode(queryNodeId);
    setUrlDialogDismissed(false);
    setLocalNodeId(null);
  }

  const inspectorNodeId = pageInspector
    ? pageInspector.nodeId
    : localNodeId ?? (urlDialogDismissed ? null : queryNodeId);

  useEffect(() => {
    if (!queryNodeId || urlDialogDismissed || !pageInspector) return;
    pageInspector.openNode(queryNodeId, liveRef.current);
  }, [queryNodeId, urlDialogDismissed, pageInspector]);

  const capWarn = liveSnapshot.liveRowCount >= liveSnapshot.liveRowLimit * 0.9;
  const showAlert = needsAttention(overallStatus) || pipelineBad;
  const mobileQuiet = isMobileLayout && !showAlert && !detailOpen;

  const handleNodeSelect = useCallback(
    (payload: HealthDagNodeSelectPayload) => {
      if (pageInspector) pageInspector.openNode(payload.drillId, liveSnapshot);
      else setLocalNodeId(payload.drillId);
      setUserDetailOpen(true);
      setSuppressAutoKey(null);
      writeSuppressKey(null);
    },
    [pageInspector, liveSnapshot],
  );

  const closeInspector = useCallback(() => {
    pageInspector?.close();
    setLocalNodeId(null);
    if (queryNodeId) setUrlDialogDismissed(true);
  }, [pageInspector, queryNodeId]);

  const toggleDetail = useCallback(() => {
    if (detailOpen) {
      setUserDetailOpen(false);
      if (autoDetail) {
        setSuppressAutoKey(autoKey);
        writeSuppressKey(autoKey);
      }
    } else {
      setUserDetailOpen(true);
      setSuppressAutoKey(null);
      writeSuppressKey(null);
    }
  }, [detailOpen, autoDetail, autoKey]);

  useEffect(() => {
    if (!queryFarmId || !detailOpen) return;
    const slug = farmKeyUrlSlug(queryFarmId);
    const timer = window.setTimeout(() => {
      document
        .querySelector(`[data-health-farm-id="${slug}"]`)
        ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }, 150);
    return () => window.clearTimeout(timer);
  }, [queryFarmId, detailOpen, liveSnapshot.modules.length]);

  const activeDrillId = inspectorNodeId;

  const detailPanel = detailOpen ? (
    <div className="mt-3 flex flex-col gap-3 border-t pt-3">
      <HealthDagGraph
        snapshot={liveSnapshot}
        onNodeSelect={handleNodeSelect}
        activeDrillId={activeDrillId}
      />
      <div>
        <p className={cn("mb-2 font-semibold", opsTypography.meta)}>
          {healthUiText("farmModules", locale)}
        </p>
        <HealthFarmModulePanel
          modules={liveSnapshot.modules}
          highlightFarmId={queryFarmId}
        />
      </div>
    </div>
  ) : null;

  const dbWarn = !liveSnapshot.dbOk ? (
    <div
      className={cn(
        "rounded-lg border border-amber-300/50 bg-amber-50 px-4 py-2 text-amber-900",
        opsTypography.alert,
        isMobileLayout ? "mt-2" : "mt-2",
      )}
    >
      {locale === "en"
        ? "SUPABASE_SERVICE_ROLE_KEY or a database connection is required."
        : "SUPABASE_SERVICE_ROLE_KEY 또는 DB 연결이 필요합니다."}
    </div>
  ) : null;

  return (
    <div className="flex flex-col gap-2 md:gap-3">
      <div
        className={cn(
          "w-full shrink-0 rounded-xl border",
          showAlert
            ? "border-amber-400/70 bg-amber-50/40 dark:bg-amber-950/20"
            : "border-border/70 bg-muted/15",
          mobileQuiet && "border-transparent bg-transparent",
        )}
      >
        <div
          className={cn(
            "flex flex-wrap items-center gap-2 px-3",
            mobileQuiet ? "px-0 py-0.5" : showAlert || detailOpen ? "py-2" : "py-1.5",
          )}
        >
          <div className="min-w-0 flex-1">
            <HealthOverallStatus
              overallStatus={overallStatus}
              compact
              barOnly={mobileQuiet}
              liveUsed={liveSnapshot.liveRowCount}
              liveTotal={liveSnapshot.liveRowLimit}
              liveWarn={capWarn}
            />
          </div>
          <HealthRefreshBar
            key={liveSnapshot.fetchedAt}
            fetchedAt={liveSnapshot.fetchedAt}
            compact
            className="shrink-0"
            onRefresh={patchSnapshot}
          />
          <button
            type="button"
            onClick={toggleDetail}
            className={cn(opsControl.buttonOutline, "shrink-0 border")}
          >
            {detailOpen ? (locale === "en" ? "Collapse" : "접기") : (locale === "en" ? "Detail" : "상세")}
          </button>
        </div>
        {!showAlert && !detailOpen ? null : (
          <div className="px-3 pb-2">
            <HealthDataPathStrip
              snapshot={liveSnapshot}
              onNodeSelect={handleNodeSelect}
              activeDrillId={activeDrillId}
              compactCollectors={!detailOpen}
            />
          </div>
        )}
        {showAlert ? (
          <p
            className={cn(
              "border-t border-amber-300/40 px-3 py-1.5 font-medium text-amber-950 dark:text-amber-100",
              opsTypography.meta,
            )}
          >
            {locale === "en"
              ? "Something needs attention — open detail to check the graph and modules."
              : "이상 감지 — 상세에서 DAG·모듈을 확인하세요."}
          </p>
        ) : null}
        {dbWarn ? <div className="px-3 pb-2">{dbWarn}</div> : null}
        {detailOpen ? <div className="px-3 pb-3">{detailPanel}</div> : null}
      </div>

      {isMobileLayout ? (
        <HealthNodeInspector
          nodeId={inspectorNodeId}
          snapshot={liveSnapshot}
          placement="sheet"
          onClose={closeInspector}
        />
      ) : null}
    </div>
  );
}
