import { Droplets, Thermometer, Wifi } from "lucide-react";
import type { CoverNotice, CoverNoticeKind } from "@/lib/farm/controller-env-cover";
import { dashboardTypography } from "@/lib/ui/dashboard-page-ui";
import { cn } from "@/lib/utils";

const NOTICE_ICON: Record<CoverNoticeKind, typeof Wifi> = {
  comm: Wifi,
  temp: Thermometer,
  humidity: Droplets,
};

/** 주의·경고·두절만. 아이콘 옆에 항목과 단계를 적는다. */
export function CoverNoticeLines({
  notices,
  onFill = false,
  className,
}: {
  notices: CoverNotice[];
  onFill?: boolean;
  className?: string;
}) {
  if (notices.length === 0) return null;
  return (
    <span className={cn("flex min-w-0 flex-col gap-0.5", className)}>
      {notices.map((notice) => {
        const Icon = NOTICE_ICON[notice.kind];
        return (
          <span
            key={notice.kind}
            data-cover-notice={notice.kind}
            className={cn(
              "inline-flex min-w-0 items-center gap-1",
              dashboardTypography.badge,
              onFill ? "text-current" : "text-foreground",
            )}
          >
            <Icon className="size-[1em] shrink-0" strokeWidth={1.75} aria-hidden />
            <span className="whitespace-nowrap">{notice.label}</span>
          </span>
        );
      })}
    </span>
  );
}
