"use client";

import type { BarnReading } from "@/lib/domain/iot-types";
import { controllerErrorBytes } from "@/lib/domain/controller-error-binary";
import { EMPTY_SITUATION_ALARMS, useShellAlarms } from "@/lib/navigation/shell-live-alarms-store";
import { useProfileSheetPrefs } from "@/components/account/profile-sheet-prefs";

/** Firmware debug readout beside the panel status. Never synthesize a normal code. */
export function ControllerErrorBinary({ reading }: { reading: BarnReading }) {
  const alarms = useShellAlarms(EMPTY_SITUATION_ALARMS);
  const codes = controllerErrorBytes(reading, alarms);
  const en = useProfileSheetPrefs().locale === "en";
  return (
    <span data-controller-error-binary="" className="inline-flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground"
      aria-label={en ? "Active wire error binary" : "활성 에러코드 Binary"}>
      <span className="shrink-0">ERR</span>
      {codes.length === 0 ? (
        <span title={en ? "No received active error code; this does not confirm recovery" : "수신된 활성 에러코드 없음 · 복구 확인을 의미하지 않음"}>—</span>
      ) : codes.map((code) => (
        <code key={code.key} className="whitespace-nowrap font-mono tabular-nums text-foreground"
          title={`${code.hex} · ${code.label} · ${code.receivedAt}`}>
          {code.scope === "module" ? (en ? "Module " : "모듈 ") : ""}{code.binary}
        </code>
      ))}
    </span>
  );
}
