"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { fetchOpsCommandHistoryAction } from "@/app/(dashboard)/admin/ops/command-history-actions";
import { CommandHistoryDetail } from "@/components/controllers/command-history-detail";
import type { CommandHistoryStatusFilter } from "@/components/controllers/command-history-filter";
import { CommandHistoryTable } from "@/components/controllers/command-history-table";
import { CommandHistoryMobileList } from "@/components/controllers/command-history-mobile-list";
import {
  COMMAND_HISTORY_RANGE_DEFAULT,
  CommandHistoryRangeChips,
  commandHistoryRangeFromIso,
  type CommandHistoryRangeId,
} from "@/components/controllers/command-history-range-chips";
import { CommandHistoryStatusChips } from "@/components/controllers/command-history-status-chips";
import { BarnPanelBottomSheet } from "@/components/farm/barn-panel-bottom-sheet";
import { Input } from "@/components/ui/input";
import { opsControl, opsTypography } from "@/lib/ui/dashboard-page-ui";
import { useMobileLayout } from "@/lib/ui/use-mobile-layout";
import type { ThermoCommand } from "@/lib/data/commands";
import { useSheetCopy } from "@/components/account/profile-sheet-prefs";
import { cn } from "@/lib/utils";

const PREVIEW_LIMIT = 5;
const FULL_FETCH_LIMIT = 200;
const QUERY_DEBOUNCE_MS = 350;
type Props = {
  commands: ThermoCommand[];
};

function EmptyLookupCta({
  kind,
  range,
  pending,
  onResetFilters,
  onWidenRange,
}: {
  kind: "filtered" | "period";
  range: CommandHistoryRangeId;
  pending: boolean;
  onResetFilters: () => void;
  onWidenRange: (range: CommandHistoryRangeId) => void;
}) {
  const t = useSheetCopy();
  return (
    <div className="flex flex-col items-center gap-3 py-6 text-center">
      <p className={opsTypography.meta}>
        {kind === "period" ? t("cmd.nonePeriod") : t("cmd.noneFiltered")}
      </p>
      <div className="flex flex-wrap items-center justify-center gap-1.5">
        {kind === "filtered" ? (
          <button
            type="button"
            disabled={pending}
            onClick={onResetFilters}
            className={cn(opsControl.buttonOutline, "border disabled:opacity-50")}
          >
            {t("cmd.resetFilters")}
          </button>
        ) : null}
        {kind === "period" && range !== "7d" && range !== "all" ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => onWidenRange("7d")}
            className={cn(opsControl.buttonOutline, "border disabled:opacity-50")}
          >
            {t("cmd.days7")}
          </button>
        ) : null}
        {range !== "all" ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => onWidenRange("all")}
            className={cn(opsControl.buttonOutline, "border disabled:opacity-50")}
          >
            {kind === "filtered" ? t("cmd.widenRange") : t("cmd.allPeriod")}
          </button>
        ) : null}
      </div>
    </div>
  );
}

/** 운영 홈 — 접힘 → 5건 · 조회(+기간·상태·서버 검색) · 행 상세. */
export function CommandHistorySlim({ commands: initial }: Props) {
  const isMobile = useMobileLayout();
  const t = useSheetCopy();
  const [previewCommands] = useState(initial);
  const [fullCommands, setFullCommands] = useState<ThermoCommand[]>([]);
  const [sectionOpen, setSectionOpen] = useState(false);
  const [pcFull, setPcFull] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [range, setRange] = useState<CommandHistoryRangeId>(
    COMMAND_HISTORY_RANGE_DEFAULT,
  );
  const [statusFilter, setStatusFilter] =
    useState<CommandHistoryStatusFilter>("all");
  const [query, setQuery] = useState("");
  const [detail, setDetail] = useState<ThermoCommand | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const fetchSeq = useRef(0);
  const lookupActive = useRef(false);
  const skipQueryDebounce = useRef(false);
  const rangeRef = useRef(range);
  const statusRef = useRef(statusFilter);
  const queryRef = useRef(query);
  const isMobileRef = useRef(isMobile);

  useEffect(() => {
    rangeRef.current = range;
    statusRef.current = statusFilter;
    queryRef.current = query;
    isMobileRef.current = isMobile;
  }, [range, statusFilter, query, isMobile]);

  /** `/admin/ops#commands` · 레거시 `/admin/ops/commands` — 섹션 자동 펼침 + 스크롤 */
  useEffect(() => {
    const syncFromHash = () => {
      if (window.location.hash !== "#commands") return;
      setSectionOpen(true);
      requestAnimationFrame(() => {
        document
          .getElementById("commands")
          ?.scrollIntoView({ block: "start", behavior: "smooth" });
      });
    };
    syncFromHash();
    window.addEventListener("hashchange", syncFromHash);
    return () => window.removeEventListener("hashchange", syncFromHash);
  }, []);

  const preview = previewCommands.slice(0, PREVIEW_LIMIT);
  const atCap = fullCommands.length >= FULL_FETCH_LIMIT;
  const lookupOpen = pcFull || sheetOpen;

  const hasActiveLookup =
    Boolean(query.trim()) || statusFilter !== "all";

  const fullTitleCount = `${fullCommands.length}`;

  const previewCount = Math.min(PREVIEW_LIMIT, previewCommands.length);
  const title = !sectionOpen
    ? t("cmd.previewTitle", { count: previewCount })
    : isMobile || !pcFull
      ? t("cmd.recentTitle", { count: previewCount })
      : t("cmd.lookupCount", { count: fullTitleCount });

  const shown = !sectionOpen
    ? []
    : isMobile
      ? preview
      : pcFull
        ? fullCommands
        : preview;

  const fetchLookup = (opts: {
    range: CommandHistoryRangeId;
    status: CommandHistoryStatusFilter;
    query: string;
    openTarget?: "sheet" | "pc";
  }) => {
    const seq = ++fetchSeq.current;
    const hadRows = lookupActive.current;
    startTransition(async () => {
      const fromIso = commandHistoryRangeFromIso(opts.range);
      const result = await fetchOpsCommandHistoryAction({
        limit: FULL_FETCH_LIMIT,
        fromIso,
        status: opts.status,
        q: opts.query.trim() || undefined,
      });
      if (seq !== fetchSeq.current) return;

      if (opts.openTarget === "sheet") setSheetOpen(true);
      if (opts.openTarget === "pc") setPcFull(true);
      setRange(opts.range);
      lookupActive.current = true;

      if (result.error) {
        setLoadError(t("cmd.loadError"));
        if (!hadRows) setFullCommands([]);
        return;
      }

      setLoadError(null);
      setFullCommands(result.commands);
    });
  };

  const openTargetForLayout = (): "sheet" | "pc" =>
    isMobileRef.current ? "sheet" : "pc";

  const retryLookup = () => {
    fetchLookup({
      range: rangeRef.current,
      status: statusRef.current,
      query: queryRef.current,
      openTarget: openTargetForLayout(),
    });
  };

  const openFull = () => {
    skipQueryDebounce.current = true;
    setQuery("");
    setStatusFilter("all");
    setDetail(null);
    setLoadError(null);
    fetchLookup({
      range: COMMAND_HISTORY_RANGE_DEFAULT,
      status: "all",
      query: "",
      openTarget: openTargetForLayout(),
    });
  };

  const onRangeChange = (next: CommandHistoryRangeId) => {
    if (next === range && fullCommands.length > 0 && !loadError) return;
    setDetail(null);
    setLoadError(null);
    fetchLookup({
      range: next,
      status: statusRef.current,
      query: queryRef.current,
      openTarget: openTargetForLayout(),
    });
  };

  const onStatusChange = (next: CommandHistoryStatusFilter) => {
    setStatusFilter(next);
    setDetail(null);
    if (!lookupActive.current && !lookupOpen) return;
    setLoadError(null);
    fetchLookup({
      range: rangeRef.current,
      status: next,
      query: queryRef.current,
      openTarget: openTargetForLayout(),
    });
  };

  const resetFilters = () => {
    skipQueryDebounce.current = true;
    setQuery("");
    setStatusFilter("all");
    setDetail(null);
    setLoadError(null);
    fetchLookup({
      range: rangeRef.current,
      status: "all",
      query: "",
      openTarget: openTargetForLayout(),
    });
  };

  // 검색어만 디바운스 — range/status는 ref로 최신값 사용 (stale closure 방지)
  useEffect(() => {
    if (skipQueryDebounce.current) {
      skipQueryDebounce.current = false;
      return;
    }
    if (!lookupActive.current && !lookupOpen) return;
    const handle = window.setTimeout(() => {
      setLoadError(null);
      fetchLookup({
        range: rangeRef.current,
        status: statusRef.current,
        query: queryRef.current,
        openTarget: openTargetForLayout(),
      });
    }, QUERY_DEBOUNCE_MS);
    return () => window.clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- debounce on query only
  }, [query]);

  const collapse = () => {
    setSectionOpen(false);
    setPcFull(false);
    setSheetOpen(false);
    setDetail(null);
    setLoadError(null);
    lookupActive.current = false;
  };

  const closeSheet = () => {
    setSheetOpen(false);
    setDetail(null);
    if (!pcFull) {
      lookupActive.current = false;
      setLoadError(null);
    }
  };

  const showFullBtn = sectionOpen && (isMobile || !pcFull);

  const emptyKind: "filtered" | "period" | null =
    loadError || fullCommands.length > 0
      ? null
      : hasActiveLookup
        ? "filtered"
        : "period";

  const emptyMessage =
    emptyKind === "filtered" ? t("cmd.noneFiltered") : t("cmd.nonePeriod");

  const lookupToolbar = (
    <div className="flex flex-col gap-2">
      <CommandHistoryRangeChips
        value={range}
        onChange={onRangeChange}
        disabled={pending}
      />
      <CommandHistoryStatusChips
        value={statusFilter}
        onChange={onStatusChange}
        disabled={pending}
      />
      <Input
        uiSize="dashboard"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t("cmd.search")}
        aria-label={t("cmd.searchLabel")}
        className={opsControl.input}
        disabled={pending && fullCommands.length === 0}
      />
      <p className={opsTypography.meta}>
        {pending
          ? t("cmd.loading")
          : `${t("cmd.rangeHint", { count: FULL_FETCH_LIMIT })}${
              atCap ? t("cmd.rangeCap") : ""
            }`}
      </p>
      {loadError && fullCommands.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          <p
            role="alert"
            className={cn(opsTypography.meta, "text-destructive")}
          >
            {loadError}
          </p>
          <button
            type="button"
            disabled={pending}
            onClick={retryLookup}
            className={cn(opsControl.buttonOutline, "border disabled:opacity-50")}
          >
            {t("cmd.retry")}
          </button>
        </div>
      ) : null}
      {lookupOpen && !pending && !loadError ? (
        <p aria-live="polite" className="sr-only">
          {t("cmd.lookupLive", { count: fullCommands.length })}
          {atCap ? t("cmd.lookupCapLive", { count: FULL_FETCH_LIMIT }) : ""}
        </p>
      ) : null}
    </div>
  );

  const emptyCta =
    emptyKind && lookupOpen && !pending ? (
      <EmptyLookupCta
        kind={emptyKind}
        range={range}
        pending={pending}
        onResetFilters={resetFilters}
        onWidenRange={(r) => onRangeChange(r)}
      />
    ) : null;

  const loadErrorEmpty =
    loadError && lookupOpen && fullCommands.length === 0 && !pending ? (
      <div className="flex flex-col items-center gap-3 py-6 text-center">
        <p role="alert" className={cn(opsTypography.meta, "text-destructive")}>
          {loadError}
        </p>
        <button
          type="button"
          disabled={pending}
          onClick={retryLookup}
          className={cn(opsControl.buttonOutline, "border disabled:opacity-50")}
        >
          {t("cmd.retry")}
        </button>
      </div>
    ) : null;

  return (
    <>
      <CommandHistoryTable
        commands={shown}
        title={title}
        bodyHidden={!sectionOpen}
        busy={pcFull && !isMobile && pending && fullCommands.length > 0}
        mobileDensity={isMobile ? "brief" : "default"}
        toolbar={pcFull && !isMobile ? lookupToolbar : undefined}
        onSelect={
          pcFull && !isMobile
            ? (c) => {
                setDetail(c);
              }
            : undefined
        }
        emptyMessage={emptyMessage}
        emptyExtra={
          pcFull && !isMobile
            ? loadErrorEmpty ||
              (emptyKind && !pending ? emptyCta : undefined) ||
              (pending ? (
                <p className={cn("py-6 text-center", opsTypography.meta)}>
                  {t("cmd.loading")}
                </p>
              ) : undefined)
            : undefined
        }
        className="border-border/60 bg-muted/10"
        action={
          <div className="flex flex-wrap items-center gap-1.5">
            {showFullBtn ? (
              <button
                type="button"
                onClick={openFull}
                disabled={pending}
                className={cn(
                  opsControl.buttonOutline,
                  "border disabled:opacity-50",
                )}
              >
                {pending ? t("cmd.loading") : t("cmd.lookup")}
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => {
                if (!sectionOpen) {
                  setSectionOpen(true);
                  return;
                }
                collapse();
              }}
              disabled={pending}
              className={cn(
                opsControl.buttonOutline,
                "border disabled:opacity-50",
              )}
            >
              {!sectionOpen ? t("ui.expand") : t("ui.collapse")}
            </button>
          </div>
        }
      />

      {isMobile ? (
        <BarnPanelBottomSheet
          open={sheetOpen}
          onClose={closeSheet}
          onBack={detail ? () => setDetail(null) : undefined}
          backLabel={t("cmd.list")}
          title={
            detail
              ? t("cmd.detailTitle")
              : t("cmd.lookupCount", { count: fullTitleCount })
          }
          auditRegion="ops-command-history-sheet"
          contentClassName="overflow-y-auto p-3"
        >
          {detail ? (
            <CommandHistoryDetail command={detail} />
          ) : (
            <>
              <div className="mb-3">{lookupToolbar}</div>
              {pending && fullCommands.length === 0 ? (
                <p className={cn("py-6 text-center", opsTypography.meta)}>
                  {t("cmd.loading")}
                </p>
              ) : loadErrorEmpty ? (
                loadErrorEmpty
              ) : emptyKind ? (
                emptyCta
              ) : (
                <div
                  className={cn(
                    pending &&
                      "pointer-events-none opacity-50 transition-opacity",
                  )}
                  aria-busy={pending || undefined}
                >
                  <CommandHistoryMobileList
                    commands={fullCommands}
                    density="default"
                    forceVisible
                    onSelect={setDetail}
                  />
                </div>
              )}
            </>
          )}
        </BarnPanelBottomSheet>
      ) : null}

      {!isMobile ? (
        <BarnPanelBottomSheet
          open={Boolean(detail) && pcFull}
          onClose={() => setDetail(null)}
          title={t("cmd.detailTitle")}
          auditRegion="ops-command-detail-sheet"
          contentClassName="overflow-y-auto p-3"
        >
          {detail ? <CommandHistoryDetail command={detail} /> : null}
        </BarnPanelBottomSheet>
      ) : null}
    </>
  );
}
