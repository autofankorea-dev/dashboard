import type { BarnReading } from "@/lib/data/iot";

export type FarmGridEmptyReason = "no-readings" | "no-sp-code";

export function resolveFarmGridEmptyReason(
  readings: BarnReading[]
): FarmGridEmptyReason {
  if (readings.length === 0) return "no-readings";
  if (!readings.some((r) => r.stallTyCode?.trim())) return "no-sp-code";
  return "no-sp-code";
}

export function farmGridEmptyCopy(reason: FarmGridEmptyReason): {
  title: string;
  detail: string;
} {
  if (reason === "no-readings") {
    return {
      title: "이 농장의 LIVE 데이터가 아직 없습니다.",
      detail: "통신모듈 수신 후 축사유형 카드가 자동으로 표시됩니다.",
    };
  }
  return {
    title: "LIVE 데이터에 축사유형(stallTyCode)이 없습니다.",
    detail:
      "디코더·시뮬레이터에서 SP 코드가 포함된 uplink가 필요합니다. 수신 후 그리드에 표시됩니다.",
  };
}
