"use client";

import { useEffect, useRef, useState } from "react";
import { useSheetCopy } from "@/components/account/profile-sheet-prefs";
import { dashboardTypography, opsStatus } from "@/lib/ui/dashboard-page-ui";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "#scan", id: "scan", key: "ops.jumpHealth" },
  { href: "#directory", id: "directory", key: "ops.jumpUsers" },
  { href: "#commands", id: "commands", key: "ops.jumpCommands" },
  { href: "#presets", id: "presets", key: "ops.jumpPresets" },
] as const;

type SectionHref = (typeof LINKS)[number]["href"];

/** 스크롤 위치에 맞춰 점프 칩을 강조한다. 기준은 고정 막대 아래쪽이다. */
export function OpsSectionNav() {
  const t = useSheetCopy();
  const navRef = useRef<HTMLElement>(null);
  const [active, setActive] = useState<SectionHref>("#scan");

  useEffect(() => {
    const nav = navRef.current;
    const scroller = nav?.parentElement;
    if (!nav || !scroller) return;

    const update = () => {
      const scrollerTop = scroller.getBoundingClientRect().top;
      const sample = document.getElementById("scan");
      const margin = sample
        ? Number.parseFloat(getComputedStyle(sample).scrollMarginTop) || 0
        : nav.getBoundingClientRect().height;
      const limit = scrollerTop + margin + 16;
      const atBottom =
        scroller.scrollTop > 8 &&
        scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 8;
      let current: SectionHref = "#scan";
      if (atBottom) {
        for (let i = LINKS.length - 1; i >= 0; i -= 1) {
          if (document.getElementById(LINKS[i].id)) {
            current = LINKS[i].href;
            break;
          }
        }
      } else {
        for (const link of LINKS) {
          const el = document.getElementById(link.id);
          if (!el) continue;
          if (el.getBoundingClientRect().top <= limit) current = link.href;
        }
      }
      setActive(current);
    };

    update();
    scroller.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    const mo = new MutationObserver(update);
    mo.observe(scroller, { childList: true });
    return () => {
      scroller.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      mo.disconnect();
    };
  }, []);

  return (
    <nav
      ref={navRef}
      aria-label={t("ops.jumpLabel")}
      className="sticky top-0 z-20 order-first flex flex-wrap gap-1.5 bg-background/95 py-1 backdrop-blur"
    >
      {LINKS.map((link) => {
        const on = active === link.href;
        return (
          <a
            key={link.href}
            href={link.href}
            aria-current={on ? "location" : undefined}
            onClick={() => setActive(link.href)}
            className={cn(
              dashboardTypography.badge,
              "rounded-md border px-2 py-1",
              on
                ? opsStatus.selected
                : "border-border text-muted-foreground hover:bg-muted/60 hover:text-foreground",
            )}
          >
            {t(link.key)}
          </a>
        );
      })}
    </nav>
  );
}
