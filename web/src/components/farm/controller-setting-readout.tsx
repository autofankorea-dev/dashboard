import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Stable hit area: revealing the name never moves the number or mouse target. */
export function ControllerSettingReadout({ label, value, className }: {
  label: string;
  value: ReactNode;
  className?: string;
}) {
  return <span data-setting-readout className={cn("relative block min-w-0", className)} aria-label={label}>
    <span className="controller-setting-value" aria-hidden>{value}</span>
    <span className="controller-setting-name absolute inset-0 flex items-center justify-center text-[9px] font-semibold leading-tight" aria-hidden>{label}</span>
    <span className="sr-only">{value}</span>
  </span>;
}
