import {
  dashboardAffordance,
  dashboardChroma,
  dashboardUi,
} from "@/lib/ui/dashboard-page-ui";
import { motionClass } from "@/lib/ui/motion-classes";
import { cn } from "@/lib/utils";

const inlineMeta = cn(dashboardUi.tableMeta, "truncate leading-snug");

/** 프로필(계정) Top Sheet — A안 full sheet · 단일 density 규칙 */
export const accountMenuLayout = {
  /** @deprecated dropdown — sheet 전환 후 sheetPanel 사용 */
  panel:
    "flex w-[min(100vw-1.5rem,22rem)] !max-h-none flex-col overflow-y-visible overflow-x-hidden rounded-xl p-0",
  sheetBackdrop: cn(
    "account-menu-sheet-backdrop inset-x-0 bottom-0 z-40 bg-black/15 supports-backdrop-filter:backdrop-blur-[2px]",
  ),
  sheetBackdropFixed: "fixed",
  sheetBackdropAbsolute: "absolute",
  sheetPanel: cn(
    "account-menu-sheet-panel z-50 flex w-full max-w-none flex-col overflow-x-hidden overflow-y-auto overscroll-contain border-b border-border/60 bg-popover text-popover-foreground shadow-md",
  ),
  sheetPanelFixed: cn(
    "fixed inset-x-0",
    "max-h-[min(calc(100dvh-var(--account-menu-sheet-top,3.5rem)-env(safe-area-inset-bottom,0px)),40rem)]",
  ),
  /** 모바일 프리뷰 프레임 내부 portal — 프레임 너비·높이에 맞춤 */
  sheetPanelInFrame: cn(
    "absolute inset-x-0",
    "max-h-[calc(100%-var(--account-menu-sheet-top,0px)-env(safe-area-inset-bottom,0px))]",
  ),
  sheetInner: "account-menu-sheet-inner w-full min-w-0",
  sheetHeader:
    "flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 border-b border-border/60 px-3 py-2 max-md:pt-safe md:gap-x-3 md:px-4 md:py-2.5",
  sheetIdentity: "flex basis-full min-w-0 items-center gap-2",
  sheetFarmCluster: "flex w-full min-w-0 flex-wrap items-start gap-x-2 gap-y-0.5",
  sheetHeaderActions: "ml-auto flex shrink-0 items-center gap-2",
  headerLogout: cn(
    "inline-flex shrink-0 items-center rounded-md px-2 py-1 text-[10px] font-medium text-destructive hover:bg-muted/60 hover:underline",
    motionClass.microInteractive,
  ),
  hubAvatar: cn(
    dashboardUi.headerAccountAvatar,
    "size-8 shrink-0 text-sm md:size-8 md:text-sm",
  ),
  hubName:
    "max-w-[9rem] shrink-0 truncate font-semibold leading-snug text-[length:var(--density-section)] sm:max-w-[14rem] md:text-[length:var(--density-section-md)]",
  hubMeta: inlineMeta,
  /** @deprecated Two-Zone Split — zoneContext 사용 */
  sheetMetaGrid:
    "grid grid-cols-2 gap-x-4 gap-y-1 border-b border-border/60 bg-muted/40 px-4 py-2.5 text-[length:var(--density-meta)] leading-snug text-foreground md:text-[length:var(--density-meta-md)]",
  splitBody: "flex min-w-0 flex-col",
  /** 펼친 도구 카드 높이만큼 행이 미리 잡힘. 표시명·상태는 블록으로 가운데 */
  zoneContext:
    "flex min-w-0 flex-col justify-center px-0 py-0",
  zoneContextStack: "flex min-w-0 flex-col gap-1.5",
  zoneAction: "flex min-w-0 flex-col gap-2",
  sheetTools:
    "flex w-full min-w-0 flex-col gap-2 border-t border-border/60 px-3 py-2.5 md:px-4 md:py-3",
  /** 아이콘 행과 같은 좌우 폭. 열린 카드만 높이를 쓴다. */
  toolsCardWell: "w-full min-w-0",
  /**
   * 열린 도구·예시의 너비. 시트 전체가 아니라 적용되는 컴포넌트를 따른다.
   * 컨트롤러 카드 — 목록 3열(1440)과 5열(2150) 모두 345–346px.
   */
  previewCard: "w-full max-w-[21.625rem]",
  /** 이상상황 카드 — hubDetailPopoverAlarm */
  previewAlarm: "w-full max-w-[18.5rem]",
  /** 일보 첫 장 본문 — (PAGE_W - 2×MARGIN) pt, 96dpi */
  previewReport: "w-full max-w-[44.94rem]",
  /**
   * 상태 줄 옆 주소. 높이는 3.125rem, 너비는 주소 글자만큼.
   * 열어도 줄 높이는 그대로다.
   */
  addressChip: "relative flex h-[3.125rem] w-max max-w-full shrink-0 items-center",
  /**
   * 설정 토글 열. 영어 “Fan % large”·“Setpoint large”가 한 줄에 들어가게 20rem.
   * 언어를 바꿔도 카드 가로 위치가 그대로다.
   */
  settingsToggles:
    "grid w-[20rem] max-w-[20rem] shrink-0 grid-cols-[4.75rem_minmax(0,1fr)] items-start gap-x-3 gap-y-2",
  addressRow:
    "min-w-0 border-b border-border/60 px-3 py-2.5 md:px-4",
  contextFarm:
    "min-w-0 break-words text-left font-semibold leading-snug text-[length:var(--density-meta)] md:text-[length:var(--density-meta-md)]",
  contextFarmBtn: cn(
    "min-w-0 break-words text-left font-semibold leading-snug text-[length:var(--density-meta)] md:text-[length:var(--density-meta-md)]",
    motionClass.microInteractive,
    "hover:text-primary",
  ),
  liveStrip:
    "flex min-w-0 items-center gap-1 text-[length:var(--density-meta)] leading-snug text-muted-foreground md:text-[length:var(--density-meta-md)]",
  hubToneStrip: "flex min-w-0 flex-wrap items-center gap-1",
  hubToneChip:
    "inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[length:var(--density-badge)] tabular-nums md:text-[length:var(--density-badge-md)]",
  liveStatusDot: "size-1.5 shrink-0 rounded-full bg-primary",
  liveStatusDotWarn: "size-1.5 shrink-0 rounded-full bg-[var(--status-warn)]",
  liveStatusDotOffline: "size-1.5 shrink-0 rounded-full bg-muted-foreground/50",
  toolGrid: "flex min-w-0 flex-wrap items-center gap-1.5 md:gap-2",
  toolTile: cn(
    dashboardUi.topHeaderActionBtn,
    "relative size-9 shrink-0 md:size-11",
  ),
  toolTileActive:
    "border-primary/60 bg-primary/5 text-primary hover:bg-primary/10 hover:text-primary",
  activityFooter:
    "flex min-w-0 gap-1.5 overflow-x-auto border-t border-border/60 px-3 py-2 md:px-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
  activityChip: cn(
    "shrink-0 rounded-full border border-border/60 px-2 py-0.5 text-[9px] leading-snug text-muted-foreground",
    motionClass.microInteractive,
    "hover:bg-muted/50 hover:text-foreground",
  ),
  switcherInset: "max-h-[min(40vh,12rem)] overflow-y-auto rounded-md border border-border/60 bg-background/80 p-1",
  /** 시트 하단 농장 격자 — 왼쪽 칸을 밀지 않음 */
  farmMatrix:
    "min-w-0 overflow-x-hidden border-b border-border/60 px-3 py-2.5 md:px-4",
  farmMatrixGrid:
    "grid max-h-[min(40vh,16rem)] min-w-0 grid-cols-2 gap-1.5 overflow-y-auto overscroll-contain sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6",
  farmMatrixCell: cn(
    dashboardAffordance.chipToggleIdle,
    motionClass.microInteractive,
    "flex min-h-16 min-w-0 flex-row items-stretch gap-2 rounded-lg px-2.5 py-2 text-left",
  ),
  farmMatrixCellActive: dashboardChroma.chromeSelected,
  farmMatrixLabel:
    "min-w-0 flex-1 self-center truncate text-left font-semibold leading-tight text-[length:var(--density-section)] md:text-[length:var(--density-section-md)]",
  farmMatrixMeta:
    "flex shrink-0 flex-col items-end justify-between self-stretch py-0.5",
  farmMatrixCount:
    "tabular-nums leading-none text-[length:var(--density-meta)] text-muted-foreground",
  sheetMetaLabel: "text-muted-foreground",
  toolsStrip: "flex items-center gap-2 px-4 py-2.5",
  rowLabel:
    "w-7 shrink-0 text-[10px] font-medium leading-none text-muted-foreground",
  toolsCluster: "flex min-w-0 flex-1 flex-wrap items-center gap-1.5",
  kebabBtn: cn(
    "inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted/60 hover:text-foreground",
    motionClass.microInteractive,
  ),
  section: "border-t border-border/60 px-4 py-2.5",
  sectionMicroHeader: "mb-1 flex min-h-5 items-center justify-between gap-2",
  sectionMicroLabel:
    "text-[10px] font-medium leading-none text-muted-foreground",
  sectionAction: cn(
    "text-[10px] font-medium text-primary",
    motionClass.microInteractive,
  ),
  inlineMeta,
  list: "space-y-0.5",
  listInlineRow: cn(
    "flex w-full min-w-0 items-center rounded-md px-0.5 py-1 text-left",
    inlineMeta,
    motionClass.microInteractive,
    "hover:bg-muted/50",
  ),
  compactInput:
    "min-w-0 flex-1 basis-[min(100%,10rem)] rounded-md border border-border bg-background px-2.5 py-1.5 text-[length:var(--density-meta)] leading-snug md:text-[length:var(--density-meta-md)]",
  compactInputRow:
    "flex min-w-0 items-stretch gap-1.5",
  compactSaveBtn: cn(
    "inline-flex shrink-0 items-center justify-center rounded-md border border-border bg-primary px-2.5 py-1.5 text-[10px] font-medium leading-snug text-primary-foreground hover:bg-primary/90 disabled:opacity-50 md:text-[length:var(--density-meta-md)]",
    motionClass.microInteractive,
  ),
  compactBtnRow: "flex w-full shrink-0 items-center gap-1 sm:w-auto",
  compactBtn: cn(
    "inline-flex h-7 shrink-0 items-center rounded-md border border-border px-2 text-[10px] font-medium text-muted-foreground hover:bg-muted/60 hover:text-foreground disabled:opacity-50",
    motionClass.microInteractive,
  ),
  compactBtnPrimary: cn(
    "inline-flex h-7 shrink-0 items-center rounded-md border border-border bg-primary px-2 text-[10px] font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50",
    motionClass.microInteractive,
  ),
  pinChipSm: "relative size-8 shrink-0 md:size-8",
  editHint: "px-4 pb-2 text-[10px] leading-snug text-muted-foreground",
  footerLogout: cn(
    "text-[10px] font-medium text-destructive hover:underline",
    motionClass.microInteractive,
  ),
} as const;

export const CONTROLLER_STATUS_LABEL: Record<
  "normal" | "caution" | "offline",
  string
> = {
  normal: "정상",
  caution: "주의",
  offline: "오프라인",
};

/**
 * Top Sheet backdrop·panel — `[data-app-header]` 하단.
 * Leaflet pane/control은 400–1000이라 그 위에 둬야 관제 지도에 가리지 않는다.
 */
export const ACCOUNT_MENU_SHEET_Z = 1100;
