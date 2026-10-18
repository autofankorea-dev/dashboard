"use client";

import type { BarnReading } from "@/lib/domain/iot-types";
import { controllerErrorHex } from "@/lib/domain/controller-error-hex";
import { useProfileSheetPrefs } from "@/components/account/profile-sheet-prefs";

export function ControllerErrorHex({ reading }: { reading: BarnReading }) {
  const en = useProfileSheetPrefs().locale === "en";
  return (
    <span data-controller-error-hex="" className="inline-flex min-w-0 items-center gap-2 text-xs text-muted-foreground"
      aria-label={en ? "Fourth sensor raw error HEX" : "네 번째 센서 원시 에러코드 HEX"}>
      <span className="shrink-0">ERR</span>
      <code className="whitespace-nowrap font-mono tabular-nums text-foreground"
        title={en ? "Raw fourth sensor uint16 · no message mapping" : "네 번째 센서 원시 uint16 · 메시지 미정의"}>
        {controllerErrorHex(reading.errorCodeRaw)}
      </code>
    </span>
  );
}
