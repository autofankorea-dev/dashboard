"use client";

import {
  useEffect,
  useState,
  useSyncExternalStore,
  type ComponentProps,
  type CSSProperties,
  type ReactNode,
} from "react";
import {
  Bell,
  ChevronDown,
  ChevronUp,
  FileText,
  Monitor,
  Moon,
  ShieldCheck,
  Smartphone,
  Sun,
  type LucideIcon,
} from "lucide-react";
import { usePathname } from "next/navigation";
import { useAppNavigate } from "@/components/layout/use-app-navigate";
import { AppNavLink } from "@/components/layout/app-nav-link";
import { DailyReportButton } from "@/components/layout/daily-report-button";
import {
  ProfilePinHeaderDropZone,
  ProfilePinToolChip,
} from "@/components/account/profile-pin-tool-chip";
import {
  RAIL_GROUP_GAP_DEFAULT,
  RAIL_PITCH_BASE,
  hubRailToolDistances,
  railOffset,
} from "@/components/layout/hub-rail-layout";
import { Badge } from "@/components/ui/badge";
import type { AlarmRow } from "@/lib/domain/alarms";
import {
  alarmChartHref,
  isModuleAlarmRow,
  isSituationLiveStateRow,
  situationAlarmMetaLine,
} from "@/lib/domain/alarms";
import { useShellAlarms } from "@/lib/navigation/shell-live-alarms-store";
import type { FarmKey } from "@/lib/domain/farm-key";
import type { FarmOverview } from "@/lib/data/iot";
import { formatKst } from "@/lib/datetime/kst";
import { isAdminOpsNavPath } from "@/lib/dashboard-sections";
import { ModuleAlarmAckButton } from "@/components/layout/module-alarm-ack-button";
import { dashboardUi } from "@/lib/ui/dashboard-page-ui";
import { motionClass } from "@/lib/ui/motion-classes";
import {
  getViewportPreference,
  getViewportPreviewMode,
  setViewportPreviewMode,
  subscribeViewportPreview,
  VIEWPORT_MOBILE_MEDIA_QUERY,
  type ViewportPreviewMode,
} from "@/lib/ui/viewport-preview-store";
import { useHydrationSafeDashboardCompact } from "@/components/layout/dashboard-viewport-context";
import {
  getDashboardTheme,
  subscribeDashboardTheme,
  syncDashboardThemeFromDom,
  toggleDashboardTheme,
} from "@/lib/ui/dashboard-theme";
import {
  DEFAULT_PROFILE_PINNED_TOOLS,
  type ProfilePinToolId,
} from "@/lib/ui/profile-pin-tools";
import {
  getProfileAccountMenuOpen,
  getProfilePinEditMode,
  getProfilePinnedTools,
  subscribeProfilePinStore,
  unpinProfileTool,
} from "@/lib/ui/profile-pin-tools-store";
import { FARM_TOUR_ACTION_EVENT } from "@/lib/onboarding/tour-steps";
import {
  afterFrames,
  dispatchTourGridActionDone,
  waitForTourTarget,
} from "@/lib/onboarding/tour-timing";
import { cn } from "@/lib/utils";

const emptySubscribe = () => () => {};

/** 미리보기가 Tailwind `md`를 꺼도, 실제 창 너비로 토글 노출 여부 판단 */
function subscribeRealDesktopWidth(onChange: () => void) {
  if (typeof window === "undefined") return () => {};
  const mq = window.matchMedia(VIEWPORT_MOBILE_MEDIA_QUERY);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

function getRealDesktopWidth(): boolean {
  if (typeof window === "undefined") return true;
  return !window.matchMedia(VIEWPORT_MOBILE_MEDIA_QUERY).matches;
}

export type HubWidgetPattern = "design" | "function" | "mode" | "all";

type Props = {
  overview?: FarmOverview;
  alarms?: AlarmRow[];
  isAdmin?: boolean;
  farmKey?: FarmKey | null;
  /** header: TopBar 상시 아이콘 · hub-panel: (레거시) 통합 FAB 본문 */
  variant?: "header" | "hub-panel";
  /** hub-panel 전용 — 디자인/기능/모드/전체 */
  hubPattern?: HubWidgetPattern;
  /** hub-panel 레이아웃 */
  hubLayout?: "list" | "rail" | "radial3";
  /** rail 펼침 방향 */
  hubRailDir?: "up" | "down" | "left" | "right";
  /** rail 애니 단계 */
  hubRailPhase?: "enter" | "exit";
  /** rail — 아이콘 중심 간 간격(px) */
  hubRailPitch?: number;
  /** rail — 그룹 사이 추가 간격(px) */
  hubRailGroupGap?: number;
  /** radial3 — 디자인/기능/알람 각도(deg, 0=오른쪽·시계방향+) */
  hubFanDegs?: [number, number, number];
  /** radial3 — 링 반지름(px) */
  hubOrbitRadii?: number[];
  /** 상세 캡슐을 FAB 왼쪽(여유 공간 쪽)으로 */
  hubDetailOpenLeft?: boolean;
};

type DetailId = "alarms" | "report";

type HeaderPinVis = "hidden" | "drop" | "draggable" | "normal";

function headerPinVisibility(
  id: ProfilePinToolId,
  pinned: ProfilePinToolId[],
  pinDnDActive: boolean,
): HeaderPinVis {
  if (!pinDnDActive) {
    return pinned.includes(id) ? "hidden" : "normal";
  }
  return pinned.includes(id) ? "drop" : "draggable";
}

function connectivityMessage(overview?: FarmOverview): string {
  const registered = overview?.controllerCount;
  if (registered === undefined) {
    return "컨트롤러 연결 정보를 불러올 수 없습니다.";
  }
  const offline = overview?.offlineCount ?? 0;
  const connected =
    overview?.connectedCount ?? Math.max(registered - offline, 0);
  return `${registered}개 중 ${connected}개 연결`;
}

function toolsIconStyle(toolsI: number): CSSProperties {
  return { ["--tools-i" as string]: toolsI } as CSSProperties;
}

function ToolsIconWrap({
  toolsI,
  children,
  ...rest
}: {
  toolsI: number;
  children: ReactNode;
} & ComponentProps<"span">) {
  return (
    <span
      className="header-tools-icon inline-flex"
      style={toolsIconStyle(toolsI)}
      {...rest}
    >
      {children}
    </span>
  );
}

function ToolsIconBtn({
  Icon,
  alert = false,
  active = false,
  badge,
  className,
  ...rest
}: {
  Icon: LucideIcon;
  alert?: boolean;
  active?: boolean;
  badge?: number;
  className?: string;
} & ComponentProps<"button">) {
  return (
    <button
      type="button"
      className={cn(
        dashboardUi.topHeaderActionBtn,
        alert && dashboardUi.topHeaderActionBtnAlert,
        active &&
          "border-primary/60 bg-primary/5 text-primary hover:bg-primary/10 hover:text-primary",
        className,
      )}
      {...rest}
    >
      <Icon className="size-4 md:size-5" aria-hidden />
      {badge != null && badge > 0 ? (
        <span
          className={cn(
            dashboardUi.topHeaderCountBadge,
            dashboardUi.topHeaderCountBadgeAlert,
          )}
        >
          {badge > 99 ? "99+" : badge}
        </span>
      ) : null}
    </button>
  );
}

/**
 * 헤더 도구 — 아이콘 캐스케이드 + 클릭 시 상세 카드(펼침 유지).
 */
export function HeaderToolsMenu({
  overview,
  alarms = [],
  isAdmin = false,
  farmKey = null,
  variant = "header",
  hubPattern = "function",
  hubLayout = "list",
  hubRailDir = "up",
  hubRailPhase = "enter",
  hubRailPitch = RAIL_PITCH_BASE,
  hubRailGroupGap = RAIL_GROUP_GAP_DEFAULT,
  hubFanDegs = [210, 270, 330],
  hubOrbitRadii = [96, 168, 240],
  hubDetailOpenLeft = true,
}: Props) {
  const isHub = variant === "hub-panel";
  const liveAlarms = useShellAlarms(alarms);
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);
  const viewportCompact = useHydrationSafeDashboardCompact();
  const { navigate } = useAppNavigate();
  const pathname = usePathname();

  const offline = overview?.offlineCount ?? 0;
  const activeAlarms = liveAlarms.filter((a) => a.status === "active");
  const alarmCount = activeAlarms.length;
  const alarmList = activeAlarms.slice(0, 12);
  /** 배지 = 종 이상상황 건수 */
  const alert = alarmCount > 0 || offline > 0;

  const onOps = isAdminOpsNavPath(pathname);
  const opsHref = onOps ? "/farm" : "/admin/ops";

  const viewportMode = useSyncExternalStore(
    subscribeViewportPreview,
    getViewportPreviewMode,
    () => "desktop" as ViewportPreviewMode,
  );
  const viewportPref = useSyncExternalStore(
    subscribeViewportPreview,
    getViewportPreference,
    () => "auto" as const,
  );
  /** 실기기 좁은 폭에서는 숨김. 모바일 *미리보기* 중에도 PC 창이면 유지 */
  const showViewportToggle = useSyncExternalStore(
    subscribeRealDesktopWidth,
    getRealDesktopWidth,
    () => true,
  );
  const viewportIsMobile = viewportMode === "mobile";
  const ViewportIcon = viewportIsMobile ? Monitor : Smartphone;
  const nextViewport: ViewportPreviewMode = viewportIsMobile
    ? "desktop"
    : "mobile";

  const [detail, setDetail] = useState<DetailId | null>(null);
  const [alarmListOpen, setAlarmListOpen] = useState(false);

  const pinnedTools = useSyncExternalStore(
    subscribeProfilePinStore,
    getProfilePinnedTools,
    () => DEFAULT_PROFILE_PINNED_TOOLS,
  );
  const pinEditMode = useSyncExternalStore(
    subscribeProfilePinStore,
    getProfilePinEditMode,
    () => false,
  );
  const accountMenuOpen = useSyncExternalStore(
    subscribeProfilePinStore,
    getProfileAccountMenuOpen,
    () => false,
  );
  const pinDnDActive = pinEditMode && accountMenuOpen && !isHub;

  const themeIsDark = useSyncExternalStore(
    subscribeDashboardTheme,
    () => getDashboardTheme() === "dark",
    () => false,
  );

  useEffect(() => {
    syncDashboardThemeFromDom();
  }, []);

  useEffect(() => {
    const onTourAction = (e: Event) => {
      const action = (e as CustomEvent<{ action?: string }>).detail?.action;
      if (action === "open-header-tools") {
        // 상시 노출 툴바 — 패널 타깃만 확인
        void (async () => {
          await afterFrames(2);
          await waitForTourTarget('[data-tour-id="header-tools-panel"]');
          dispatchTourGridActionDone("open-header-tools");
        })();
        return;
      }
      if (action === "close-header-tools") {
        setDetail(null);
        setAlarmListOpen(false);
        dispatchTourGridActionDone("close-header-tools");
      }
    };
    window.addEventListener(FARM_TOUR_ACTION_EVENT, onTourAction);
    return () =>
      window.removeEventListener(FARM_TOUR_ACTION_EVENT, onTourAction);
  }, []);

  const connTitle = connectivityMessage(overview);
  const viewportTitle =
    viewportMode === "mobile"
      ? `모바일 레이아웃${viewportPref === "auto" ? " (자동)" : ""} → PC`
      : `PC 레이아웃${viewportPref === "auto" ? " (자동)" : ""} → 모바일`;

  const iBell = 0;
  const iOps = 1;
  const iReport = 2;
  const iTheme = 3;
  const iViewport = 4;

  const toggleDetail = (id: DetailId) => {
    setDetail((prev) => (prev === id ? null : id));
    /* 이상상황 상세를 닫거나 다른 상세로 바꿀 때 리스트 접기 */
    if (id !== "alarms" || detail === id) {
      setAlarmListOpen(false);
    }
  };

  const closePanels = () => {
    setDetail(null);
    setAlarmListOpen(false);
  };

  const toggleTheme = () => {
    toggleDashboardTheme();
  };

  const toolbarIcons = (opts: {
    vertical: boolean;
    /** hub radial — 래퍼 없이 노드 배열만 */
    asNodes?: boolean;
    /** hub 그룹 필터 */
    group?: "design" | "function" | "alarm" | "all";
  }): ReactNode => {
    const { vertical, asNodes, group = "all" } = opts;
    const themeBtn = (
      <ToolsIconBtn
        Icon={themeIsDark ? Sun : Moon}
        data-tour-id="header-theme"
        data-theme-ready={mounted || undefined}
        aria-label={themeIsDark ? "라이트 모드" : "다크 모드"}
        title={themeIsDark ? "라이트 모드" : "다크 모드"}
        onClick={toggleTheme}
      />
    );

    const viewportBtn = (
      <ToolsIconBtn
        Icon={ViewportIcon}
        active={viewportIsMobile}
        data-tour-id="viewport-preview-toggle"
        aria-label={viewportTitle}
        title={viewportTitle}
        onClick={() => setViewportPreviewMode(nextViewport)}
      />
    );

    const bellVis = headerPinVisibility("alarm", pinnedTools, pinDnDActive);
    const bell =
      bellVis === "hidden" ? null : bellVis === "drop" ? (
        <ToolsIconWrap key="bell" toolsI={iBell}>
          <ProfilePinHeaderDropZone
            visible
            onUnpinTool={unpinProfileTool}
          />
        </ToolsIconWrap>
      ) : bellVis === "draggable" ? (
        <ToolsIconWrap key="bell" toolsI={iBell}>
          <ProfilePinToolChip
            toolId="alarm"
            draggable
            badge={alarmCount > 0 ? alarmCount : undefined}
            alert={alert}
            active={detail === "alarms"}
            data-tour-id="header-alarms"
            onClick={() => toggleDetail("alarms")}
          />
        </ToolsIconWrap>
      ) : (
        <ToolsIconWrap key="bell" toolsI={iBell}>
          <ToolsIconBtn
            Icon={Bell}
            alert={alert}
            active={detail === "alarms"}
            badge={alarmCount > 0 ? alarmCount : undefined}
            data-tour-id="header-alarms"
            aria-label={
              alarmCount > 0 ? `이상상황 ${alarmCount}건` : "이상상황"
            }
            aria-pressed={detail === "alarms"}
            title="이상상황"
            onClick={() => toggleDetail("alarms")}
          />
        </ToolsIconWrap>
      );
    const ops = isAdmin ? (
      <ToolsIconWrap key="ops" toolsI={iOps}>
        <AppNavLink
          href={opsHref}
          message={onOps ? "모니터링으로 이동 중…" : "운영으로 이동 중…"}
          className={cn(
            dashboardUi.topHeaderActionBtn,
            "no-underline",
            onOps &&
              "border-emerald-600/60 bg-emerald-50 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-950/40 dark:text-emerald-300",
          )}
          aria-label={onOps ? "운영 종료 — 모니터링으로" : "운영"}
          title={onOps ? "운영 → 모니터링" : "모니터링 → 운영"}
          data-tour-id="header-ops"
        >
          <ShieldCheck className="size-4 md:size-5" aria-hidden />
        </AppNavLink>
      </ToolsIconWrap>
    ) : null;
    const reportVis = headerPinVisibility("pdf", pinnedTools, pinDnDActive);
    const report =
      reportVis === "hidden" ? null : reportVis === "drop" ? (
        <ToolsIconWrap key="report" toolsI={iReport}>
          <ProfilePinHeaderDropZone
            visible
            onUnpinTool={unpinProfileTool}
          />
        </ToolsIconWrap>
      ) : reportVis === "draggable" ? (
        <ToolsIconWrap key="report" toolsI={iReport}>
          <ProfilePinToolChip
            toolId="pdf"
            draggable
            active={detail === "report"}
            data-tour-id="header-daily-report"
            onClick={() => toggleDetail("report")}
          />
        </ToolsIconWrap>
      ) : (
        <ToolsIconWrap key="report" toolsI={iReport}>
          <ToolsIconBtn
            Icon={FileText}
            active={detail === "report"}
            data-tour-id="header-daily-report"
            aria-label="오늘의 리포트"
            aria-pressed={detail === "report"}
            title="오늘의 리포트"
            onClick={() => toggleDetail("report")}
          />
        </ToolsIconWrap>
      );
    const viewport =
      isHub || showViewportToggle ? (
        <ToolsIconWrap key="viewport" toolsI={iViewport}>
          {viewportBtn}
        </ToolsIconWrap>
      ) : null;
    const themeVis = headerPinVisibility("theme", pinnedTools, pinDnDActive);
    const themeEl =
      themeVis === "hidden" ? null : themeVis === "drop" ? (
        <ToolsIconWrap key="theme" toolsI={iTheme}>
          <ProfilePinHeaderDropZone
            visible
            onUnpinTool={unpinProfileTool}
          />
        </ToolsIconWrap>
      ) : themeVis === "draggable" ? (
        <ToolsIconWrap key="theme" toolsI={iTheme}>
          <ProfilePinToolChip
            toolId="theme"
            draggable
            data-tour-id="header-theme"
            onClick={toggleTheme}
          />
        </ToolsIconWrap>
      ) : (
        <ToolsIconWrap key="theme" toolsI={iTheme}>
          {themeBtn}
        </ToolsIconWrap>
      );

    /* hub: 그룹별 · header: 이상상황 → 운영 → 리포트 → 테마 → (md+) 뷰포트 */
    const hubItems =
      group === "design"
        ? [themeEl, viewport]
        : group === "function"
          ? [report, ops]
          : group === "alarm"
            ? [bell]
            : hubPattern === "design"
              ? [themeEl, viewport]
              : hubPattern === "mode"
                ? [ops]
                : hubPattern === "all"
                  ? [themeEl, viewport, report, ops, bell]
                  : [report, bell];
    const items = (
      isHub
        ? hubItems
        : [bell, ops, report, themeEl, viewport]
    ).filter(Boolean);

    if (asNodes) return items;

    const headerPinnedHint =
      !isHub && items.length === 0 && pinnedTools.length > 0 ? (
        <span
          className="max-w-[5.5rem] truncate px-1 text-[10px] leading-tight text-muted-foreground"
          title="알람·리포트·테마가 프로필에 고정되어 있습니다"
        >
          도구 → 프로필
        </span>
      ) : null;

    return (
      <div
        className={cn(
          "flex flex-nowrap items-center justify-end gap-1.5",
          vertical ? "flex-col" : "flex-row",
        )}
        role="toolbar"
        aria-label="헤더 도구"
        aria-orientation={vertical ? "vertical" : "horizontal"}
      >
        {items}
        {headerPinnedHint}
      </div>
    );
  };

  const railAxis =
    hubRailDir === "left" || hubRailDir === "right"
      ? ({ dx: hubRailDir === "left" ? 1 : -1, dy: 0 } as const)
      : ({ dx: 0, dy: hubRailDir === "up" ? 1 : -1 } as const);

  const detailAlert = detail === "alarms" && alert;
  const isAlarmDetail = detail === "alarms";

  /** 캡슐이 FAB 왼쪽이면 노치=오른쪽(end), FAB 오른쪽이면 노치=왼쪽(start) */
  const capsuleNotchEnd =
    hubLayout === "list" || hubDetailOpenLeft;

  /** 이상상황 카드는 FAB에 붙여 화면 안쪽으로 성장 (중앙 정렬 → top 잘림 방지) */
  const hubDetailSideClass = (() => {
    const side = hubDetailOpenLeft
      ? "right-[calc(100%+14px)]"
      : "left-[calc(100%+14px)]";
    if (isAlarmDetail) {
      const fromBottom =
        hubRailDir === "up" ||
        hubRailDir === "left" ||
        hubRailDir === "right";
      return cn("z-[8]", side, fromBottom ? "bottom-0" : "top-0");
    }
    return hubDetailOpenLeft
      ? "left-1/2 top-1/2 z-[8] -translate-x-[calc(100%+14px)] -translate-y-1/2"
      : "left-1/2 top-1/2 z-[8] translate-x-[14px] -translate-y-1/2";
  })();

  const detailPanel = detail ? (
    <div
      className={cn(
        isHub
          ? cn(
              isAlarmDetail
                ? dashboardUi.hubDetailPopoverAlarm
                : dashboardUi.hubDetailPopover,
              detailAlert && dashboardUi.hubDetailPopoverAlert,
              motionClass.hubWidgetDetailIn,
            )
          : cn(
              "w-[min(100vw-2rem,20rem)] overflow-hidden",
              viewportCompact
                ? "rounded-lg border border-border/80 bg-background"
                : "rounded-lg border bg-popover text-popover-foreground shadow-md ring-1 ring-foreground/10",
              motionClass.enterFade,
            ),
      )}
      data-tour-id={`header-tools-detail-${detail}`}
      data-hub-detail-capsule={isHub ? "" : undefined}
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {isHub && !isAlarmDetail ? (
        <span
          className={cn(
            dashboardUi.hubDetailNotch,
            capsuleNotchEnd
              ? dashboardUi.hubDetailNotchEnd
              : dashboardUi.hubDetailNotchStart,
            detailAlert && dashboardUi.hubDetailNotchAlert,
          )}
          aria-hidden
        />
      ) : null}

      {detail === "alarms" ? (
        <div
          className={cn(
            isHub
              ? dashboardUi.hubDetailRowList
              : cn(
                  dashboardUi.headerToolsCard,
                  "mx-0 mb-0 w-full",
                  alert && dashboardUi.headerToolsCardAlert,
                ),
          )}
        >
          <span
            className={cn(
              isHub
                ? dashboardUi.hubDetailLeadIcon
                : dashboardUi.headerToolsCardIcon,
              alert &&
                (isHub
                  ? dashboardUi.hubDetailLeadIconAlert
                  : dashboardUi.headerToolsCardIconAlert),
            )}
            aria-hidden
          >
            <Bell className="size-4 md:size-5" />
          </span>
          <div
            className={
              isHub
                ? dashboardUi.hubDetailBodyList
                : dashboardUi.headerToolsCardBody
            }
          >
            <div
              className={
                isHub
                  ? dashboardUi.hubDetailTitle
                  : dashboardUi.headerToolsCardTitle
              }
            >
              <span>이상상황</span>
              {alarmCount > 0 ? (
                <Badge
                  variant="destructive"
                  className="ml-auto h-5 min-h-0 px-1.5 text-[0.65rem]"
                >
                  {alarmCount}건
                </Badge>
              ) : null}
            </div>
            <p
              className={cn(
                isHub
                  ? dashboardUi.hubDetailMeta
                  : dashboardUi.headerToolsCardMeta,
                offline > 0 &&
                  "font-medium text-red-600 dark:text-red-400",
              )}
            >
              {offline > 0
                ? `${connTitle} · 오프라인 ${offline}`
                : connTitle}
            </p>
            {alarmCount > 0 ? (
              <button
                type="button"
                className={cn(
                  isHub
                    ? dashboardUi.hubDetailAlarmToggle
                    : "mt-1.5 flex w-full items-center justify-center gap-1 rounded-lg border px-2 py-1.5 text-xs font-medium",
                  !isHub && "text-emerald-700 dark:text-emerald-400",
                )}
                aria-expanded={alarmListOpen}
                onClick={() => setAlarmListOpen((v) => !v)}
              >
                {alarmListOpen ? (
                  <>
                    접기
                    <ChevronUp className="size-3.5 shrink-0" aria-hidden />
                  </>
                ) : (
                  <>
                    상세 보기
                    <ChevronDown className="size-3.5 shrink-0" aria-hidden />
                  </>
                )}
              </button>
            ) : (
              <p
                className={
                  isHub
                    ? dashboardUi.hubDetailMeta
                    : dashboardUi.headerToolsCardMeta
                }
              >
                활성 이상상황 없음
              </p>
            )}
            {alarmListOpen && alarmList.length > 0 ? (
              <ul
                className={cn(
                  "min-h-0 space-y-1 overflow-y-auto overscroll-contain",
                  isHub
                    ? "mt-1 flex-1 border-t border-border/50 pt-1.5 pr-0.5"
                    : "mt-1.5 max-h-[min(50dvh,16rem)]",
                )}
                aria-label="이상상황 목록"
              >
                {alarmList.map((a) => (
                  <li key={a.id}>
                    <div
                      className={cn(
                        "w-full rounded-xl border border-border/60 bg-muted/20 px-1.5 py-1.5",
                      )}
                    >
                      <button
                        type="button"
                        className={cn(
                          "w-full text-left hover:bg-muted/80 rounded-lg px-0.5 py-0.5",
                          motionClass.microInteractive,
                        )}
                        onClick={() => {
                          closePanels();
                          navigate(alarmChartHref(a), {
                            message: isModuleAlarmRow(a)
                              ? "농장 차트로 이동 중…"
                              : "그래프로 이동 중…",
                          });
                        }}
                      >
                        <span className="flex items-center justify-between gap-2 text-xs font-medium">
                          <span className="truncate">{a.alarmType}</span>
                          <span className="shrink-0 text-[0.65rem] text-muted-foreground">
                            {a.severity === "critical" ? "심각" : "주의"}
                          </span>
                        </span>
                        <span className="block truncate text-[0.65rem] text-muted-foreground">
                          {situationAlarmMetaLine(a)}
                        </span>
                        {isSituationLiveStateRow(a) ? null : (
                          <span className="block text-[0.65rem] text-muted-foreground">
                            {formatKst(a.occurredAt, "short")}
                          </span>
                        )}
                      </button>
                      {isModuleAlarmRow(a) ? (
                        <div className="mt-1 flex justify-end">
                          <ModuleAlarmAckButton alarm={a} list={activeAlarms} />
                        </div>
                      ) : null}
                    </div>
                  </li>
                ))}
                {alarmCount > alarmList.length ? (
                  <li className="px-1 py-1 text-[0.65rem] text-muted-foreground">
                    외 {alarmCount - alarmList.length}건 — 행을 눌러 차트로
                    이동합니다
                  </li>
                ) : null}
              </ul>
            ) : null}
          </div>
        </div>
      ) : null}

      {detail === "report" ? (
        isHub ? (
          <DailyReportButton
            farmKey={farmKey}
            presentation="hub-detail"
          />
        ) : (
          <div className="p-1">
            <DailyReportButton
              farmKey={farmKey}
              presentation="tools-card"
            />
          </div>
        )
      ) : null}
    </div>
  ) : null;

  if (isHub) {
    if (hubLayout === "radial3") {
      const rays: {
        id: "design" | "function" | "alarm";
        label: string;
        deg: number;
        rayI: number;
      }[] = [
        { id: "design", label: "디자인", deg: hubFanDegs[0], rayI: 0 },
        { id: "function", label: "기능", deg: hubFanDegs[1], rayI: 1 },
        { id: "alarm", label: "알람", deg: hubFanDegs[2], rayI: 2 },
      ];
      const itemMotion =
        hubRailPhase === "exit"
          ? motionClass.hubWidgetOrbitItemExit
          : motionClass.hubWidgetOrbitItemEnter;

      const detailSide = hubDetailSideClass;

      return (
        <>
          {rays.map((ray) => {
            const nodes = (
              toolbarIcons({
                vertical: true,
                asNodes: true,
                group: ray.id,
              }) as ReactNode[]
            ).filter(Boolean);
            const rad = (ray.deg * Math.PI) / 180;
            return nodes.map((node, ringI) => {
              const radius =
                hubOrbitRadii[Math.min(ringI, hubOrbitRadii.length - 1)] ?? 96;
              const ox = Math.cos(rad) * radius;
              const oy = Math.sin(rad) * radius;
              return (
                <div
                  key={`hub-orbit-${ray.id}-${ringI}`}
                  className={cn(
                    "pointer-events-auto absolute z-[7] flex size-11 items-center justify-center",
                    "[&_button]:rounded-full [&_a]:rounded-full",
                    "[&_.header-tools-icon]:contents",
                    itemMotion,
                  )}
                  style={
                    {
                      left: ox,
                      top: oy,
                      ["--hub-ox" as string]: `${ox}px`,
                      ["--hub-oy" as string]: `${oy}px`,
                      ["--hub-orbit-ray" as string]: ray.rayI,
                      ["--hub-orbit-ring" as string]: ringI,
                    } as CSSProperties
                  }
                  data-hub-orbit-tool=""
                  data-hub-orbit-group={ray.id}
                  aria-label={ray.label}
                >
                  {node}
                </div>
              );
            });
          })}
          {detailPanel ? (
            <div
              className={cn("pointer-events-auto absolute", detailSide)}
              data-hub-rail-detail=""
            >
              {detailPanel}
            </div>
          ) : null}
        </>
      );
    }

    if (hubLayout === "rail") {
      const nodes = (
        toolbarIcons({ vertical: true, asNodes: true }) as ReactNode[]
      ).filter(Boolean);
      const n = nodes.length;
      const distances = hubRailToolDistances(
        n,
        hubRailPitch,
        isAdmin,
        hubRailGroupGap,
      );
      const itemMotion =
        hubRailPhase === "exit"
          ? motionClass.hubWidgetRailItemExit
          : motionClass.hubWidgetRailItemEnter;
      const detailSide = hubDetailSideClass;
      return (
        <>
          {nodes.map((node, i) => {
            const { ox, oy } = railOffset(
              hubRailDir,
              distances[i] ?? (i + 1) * hubRailPitch,
            );
            return (
              <div
                key={`hub-rail-${hubPattern}-${i}`}
                className={cn(
                  "pointer-events-auto absolute z-[7] flex size-11 items-center justify-center",
                  "[&_button]:rounded-full [&_a]:rounded-full",
                  "[&_.header-tools-icon]:contents",
                  itemMotion,
                )}
                style={
                  {
                    left: ox,
                    top: oy,
                    ["--hub-rail-i" as string]: i,
                    ["--hub-rail-n" as string]: String(n),
                    ["--hub-rail-dx" as string]: railAxis.dx,
                    ["--hub-rail-dy" as string]: railAxis.dy,
                  } as CSSProperties
                }
                data-hub-rail-tool=""
              >
                {node}
              </div>
            );
          })}
          {detailPanel ? (
            <div
              className={cn("pointer-events-auto absolute", detailSide)}
              data-hub-rail-detail=""
            >
              {detailPanel}
            </div>
          ) : null}
        </>
      );
    }

    return (
      <div className="flex flex-col items-stretch gap-2">
        {toolbarIcons({ vertical: true })}
        {detailPanel}
      </div>
    );
  }

  if (!mounted) {
    return (
      <div
        className="flex h-9 shrink-0 items-center gap-1.5 md:h-11"
        data-tour-id="header-tools"
        aria-hidden
      />
    );
  }

  /* TopBar 상시 가로 아이콘 — ⋯ / FAB 레일 없음 */
  return (
    <div
      className="relative flex shrink-0 items-center"
      data-tour-id="header-tools"
    >
      {detail ? (
        <button
          type="button"
          className="fixed inset-0 z-40 cursor-default bg-transparent"
          aria-label="도구 패널 닫기"
          onClick={closePanels}
        />
      ) : null}
      <div
        className="relative z-[45] flex items-center gap-1.5"
        data-tour-id="header-tools-panel"
      >
        {toolbarIcons({ vertical: false })}
      </div>
      {detailPanel ? (
        <div
          className="absolute right-0 top-[calc(100%+8px)] z-[45] min-w-[12rem]"
          data-tour-id="header-tools-detail-panel"
        >
          {detailPanel}
        </div>
      ) : null}
    </div>
  );
}
