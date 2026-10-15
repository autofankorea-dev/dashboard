"use client";

/**
 * 스포트라이트 투어 — 툴팁 내부 확장 가이드.
 * - GaugeAnatomy: 컨트롤러 카드 게이지 바 읽는 법(확대 모식도).
 * - PanelPillsGuide: 그래프·설정 아이콘 역할 설명.
 * - ListModeIconsGuide: 목록 상단 보기 모드 아이콘.
 * - HeaderIconsGuide: 상단 헤더 도구·알림·물음표·계정.
 */

import {
  Bell,
  CircleHelp,
  FileText,
  LayoutGrid,
  LineChart,
  Moon,
  Settings,
  UserRound,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { ControllerDeviceIcon } from "@/components/icons/controller-device-icon";
import { useSheetCopy } from "@/components/account/profile-sheet-prefs";
import { dashboardUi } from "@/lib/ui/dashboard-page-ui";
import type { SheetCopyKey } from "@/lib/ui/sheet-copy";

const ANATOMY_ITEMS: { n: number; label: SheetCopyKey; desc: SheetCopyKey }[] = [
  { n: 1, label: "tour.gaugeNow", desc: "tour.gaugeNowDesc" },
  { n: 2, label: "tour.gaugeSet", desc: "tour.gaugeSetDesc" },
  { n: 3, label: "tour.gaugeVent", desc: "tour.gaugeVentDesc" },
  { n: 4, label: "tour.gaugeOut", desc: "tour.gaugeOutDesc" },
];

type GuideProps = {
  /** 모바일 bottom sheet — B 스케일 */
  compact?: boolean;
};

export function GaugeAnatomy({ compact = false }: GuideProps) {
  const t = useSheetCopy();
  return (
    <div className={cnBox(compact)}>
      <p
        className={
          compact
            ? "mb-1.5 text-xs font-semibold text-muted-foreground"
            : "mb-2 text-sm font-semibold text-muted-foreground"
        }
      >
        {t("tour.gaugeTitle")}
      </p>
      <div className={compact ? "relative mb-1.5 select-none pt-0.5" : "relative mb-2 select-none pt-0.5"}>
        <div
          className={
            compact
              ? "relative h-3 w-full overflow-hidden rounded-md border bg-muted/40"
              : "relative h-4 w-full overflow-hidden rounded-md border bg-muted/40"
          }
          role="img"
          aria-label={t("tour.gaugeAria")}
        >
          <div
            className="pointer-events-none absolute inset-y-0 z-[1] rounded-sm bg-[color-mix(in_oklch,var(--channel-temp)_34%,var(--mix-lift))] ring-1 ring-inset ring-[color-mix(in_oklch,var(--channel-temp)_58%,transparent)]"
            style={{ left: "25%", width: "50%" }}
            aria-hidden
          />
          <div
            className="absolute inset-y-0 left-0 z-[0] rounded-md bg-channel-temp"
            style={{ width: "42%" }}
            aria-hidden
          />
          <div
            className="absolute inset-y-0 right-0 bg-muted/20"
            style={{ width: "58%" }}
            aria-hidden
          />
          <div
            className={
              compact
                ? "absolute top-[-1px] z-[2] h-3.5 w-2.5 rounded-full bg-foreground"
                : "absolute top-[-1px] z-[2] h-[1.125rem] w-3 rounded-full bg-foreground"
            }
            style={{ left: "42%", transform: "translateX(-50%)" }}
            aria-hidden
          />
        </div>
        <div
          className={
            compact
              ? "mt-0.5 flex justify-between text-[0.65rem] text-muted-foreground"
              : "mt-1 flex justify-between text-xs text-muted-foreground"
          }
        >
          <span>{t("tour.gaugeLow")}</span>
          <span>{t("tour.gaugeHigh")}</span>
        </div>
      </div>
      <ul className={compact ? "space-y-1" : "space-y-1.5"}>
        {ANATOMY_ITEMS.map((it) => (
          <li
            key={it.n}
            className={
              compact
                ? "flex items-start gap-1.5 text-xs leading-snug"
                : "flex items-start gap-2 text-sm leading-snug"
            }
          >
            <span
              className={
                compact
                  ? "mt-px flex size-3.5 shrink-0 items-center justify-center rounded-full bg-primary text-[0.55rem] font-bold text-primary-foreground"
                  : "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-primary text-[0.65rem] font-bold text-primary-foreground"
              }
            >
              {it.n}
            </span>
            <span>
              <span className="font-semibold">{t(it.label)}</span>
              <span className="text-muted-foreground"> — {t(it.desc)}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

const PILL_ITEMS: {
  key: string;
  name: SheetCopyKey;
  desc: SheetCopyKey;
  Icon: LucideIcon | typeof ControllerDeviceIcon;
}[] = [
  {
    key: "cycle",
    name: "tour.pillCycle",
    desc: "tour.pillCycleDesc",
    Icon: ControllerDeviceIcon,
  },
  {
    key: "graph",
    name: "tour.pillGraph",
    desc: "tour.pillGraphDesc",
    Icon: LineChart,
  },
  {
    key: "settings",
    name: "tour.pillSettings",
    desc: "tour.pillSettingsDesc",
    Icon: Settings,
  },
];

export function PanelPillsGuide({ compact = false }: GuideProps) {
  const t = useSheetCopy();
  return (
    <div className={cnBox(compact)}>
      <ul className={compact ? "space-y-1.5" : "space-y-2"}>
        {PILL_ITEMS.map((p) => (
          <li
            key={p.key}
            className={
              compact
                ? "flex items-start gap-2 text-xs leading-snug"
                : "flex items-start gap-2.5 text-sm leading-snug"
            }
          >
            <span
              className={
                compact
                  ? "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg border bg-background"
                  : "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg border bg-background"
              }
              aria-hidden
            >
              <p.Icon
                className={compact ? "size-3.5" : "size-4"}
                strokeWidth={dashboardUi.iconStroke}
              />
            </span>
            <span>
              <span className="font-semibold">{t(p.name)}</span>
              <span className="text-muted-foreground"> — {t(p.desc)}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

const LIST_MODE_ITEMS: {
  key: string;
  name: SheetCopyKey;
  desc: SheetCopyKey;
  Icon: LucideIcon | typeof ControllerDeviceIcon;
}[] = [
  {
    key: "controller",
    name: "list.controller",
    desc: "tour.listControllerDesc",
    Icon: ControllerDeviceIcon,
  },
  {
    key: "graph",
    name: "tour.pillGraph",
    desc: "tour.listGraphDesc",
    Icon: LineChart,
  },
  {
    key: "settings",
    name: "list.settings",
    desc: "tour.listSettingsDesc",
    Icon: Settings,
  },
  {
    key: "group",
    name: "tour.listGroup",
    desc: "tour.listGroupDesc",
    Icon: LayoutGrid,
  },
];

export function ListModeIconsGuide({ compact = false }: GuideProps) {
  const t = useSheetCopy();
  return (
    <div className={cnBox(compact)}>
      <p
        className={
          compact
            ? "mb-1.5 text-xs font-semibold text-muted-foreground"
            : "mb-2 text-sm font-semibold text-muted-foreground"
        }
      >
        {t("tour.listTitle")}
      </p>
      <ul className={compact ? "space-y-1.5" : "space-y-2"}>
        {LIST_MODE_ITEMS.map((p) => (
          <li
            key={p.key}
            className={
              compact
                ? "flex items-start gap-2 text-xs leading-snug"
                : "flex items-start gap-2.5 text-sm leading-snug"
            }
          >
            <span
              className={
                compact
                  ? "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg border bg-background"
                  : "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg border bg-background"
              }
              aria-hidden
            >
              <p.Icon
                className={compact ? "size-3.5" : "size-4"}
                strokeWidth={dashboardUi.iconStroke}
              />
            </span>
            <span>
              <span className="font-semibold">{t(p.name)}</span>
              <span className="text-muted-foreground"> — {t(p.desc)}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function cnBox(compact: boolean) {
  return compact
    ? "rounded-lg border bg-muted/30 p-2.5"
    : "rounded-lg border bg-muted/30 p-3.5";
}

const HEADER_ICON_ITEMS: {
  key: string;
  label: SheetCopyKey;
  desc: SheetCopyKey;
  Icon: LucideIcon;
}[] = [
  {
    key: "alarms",
    label: "tools.alarm",
    desc: "tour.headerAlarmsDesc",
    Icon: Bell,
  },
  {
    key: "ops-report",
    label: "tour.headerReport",
    desc: "tour.headerReportDesc",
    Icon: FileText,
  },
  {
    key: "style",
    label: "tour.headerTheme",
    desc: "tour.headerThemeDesc",
    Icon: Moon,
  },
  {
    key: "help",
    label: "tools.help",
    desc: "tour.headerHelpDesc",
    Icon: CircleHelp,
  },
  {
    key: "account",
    label: "tour.headerAccount",
    desc: "tour.headerAccountDesc",
    Icon: UserRound,
  },
];

export function HeaderIconsGuide({ compact = false }: GuideProps) {
  const t = useSheetCopy();
  return (
    <div className={cnBox(compact)}>
      <p
        className={
          compact
            ? "mb-1.5 text-xs font-semibold text-muted-foreground"
            : "mb-2 text-sm font-semibold text-muted-foreground"
        }
      >
        {t("tour.headerTitle")}
      </p>
      <ul className={compact ? "space-y-2" : "space-y-2.5"}>
        {HEADER_ICON_ITEMS.map((item) => (
          <li
            key={item.key}
            className={
              compact
                ? "flex items-start gap-2 text-xs leading-snug"
                : "flex items-start gap-2.5 text-sm leading-snug"
            }
          >
            <span
              className={
                compact
                  ? "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg border bg-background"
                  : "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg border bg-background"
              }
              aria-hidden
            >
              <item.Icon
                className={compact ? "size-3.5" : "size-4"}
                strokeWidth={dashboardUi.iconStroke}
              />
            </span>
            <span>
              <span className="font-semibold">{t(item.label)}</span>
              <span className="text-muted-foreground"> — {t(item.desc)}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
