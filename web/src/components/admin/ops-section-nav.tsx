"use client";

import { useSheetCopy } from "@/components/account/profile-sheet-prefs";
import { dashboardTypography } from "@/lib/ui/dashboard-page-ui";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "#scan", key: "ops.jumpHealth" },
  { href: "#directory", key: "ops.jumpUsers" },
  { href: "#commands", key: "ops.jumpCommands" },
  { href: "#presets", key: "ops.jumpPresets" },
] as const;

export function OpsSectionNav() {
  const t = useSheetCopy();
  return (
    <nav
      aria-label={t("ops.jumpLabel")}
      className="sticky top-0 z-20 order-first flex flex-wrap gap-1.5 bg-background/95 py-1 backdrop-blur"
    >
      {LINKS.map((link) => (
        <a
          key={link.href}
          href={link.href}
          className={cn(
            dashboardTypography.badge,
            "rounded-md border px-2 py-1 text-muted-foreground hover:bg-muted/60 hover:text-foreground",
          )}
        >
          {t(link.key)}
        </a>
      ))}
    </nav>
  );
}
