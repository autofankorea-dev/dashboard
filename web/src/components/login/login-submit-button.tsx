"use client";

import { useFormStatus } from "react-dom";
import { BusyButtonLabel } from "@/components/common/busy-button-label";
import { dashboardAffordance } from "@/lib/ui/dashboard-page-ui";
import { useSheetCopy } from "@/components/account/profile-sheet-prefs";
import { cn } from "@/lib/utils";

export function LoginSubmitButton() {
  const { pending } = useFormStatus();
  const t = useSheetCopy();

  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className={cn(
        "flex w-full items-center justify-center gap-2 rounded-md py-2.5 text-sm font-medium",
        dashboardAffordance.action,
        "disabled:cursor-wait disabled:opacity-90"
      )}
    >
      <BusyButtonLabel
        busy={pending}
        idleLabel={t("login.submit")}
        busyLabel={t("login.submitting")}
      />
    </button>
  );
}
