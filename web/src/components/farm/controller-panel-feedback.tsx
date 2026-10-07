"use client";

import type { CommandPipelineOverlayState } from "@/components/farm/command-pipeline-overlay";

/** Local feedback never creates a portal or blocks another controller panel. */
export function ControllerPanelFeedback({
  visible, phase, title, detail,
}: CommandPipelineOverlayState) {
  if (!visible || phase === "loading" || phase === "info") return null;
  return (
    <div data-controller-panel-feedback="" role={phase === "error" ? "alert" : "status"}
      className="rounded-md border px-3 py-2 text-xs">
      <p className="font-semibold">{title}</p>
      {detail ? <p className="mt-1 text-muted-foreground">{detail}</p> : null}
    </div>
  );
}
