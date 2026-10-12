/**
 * 장비코드(eqpmnCode) — EC/ES 등 UI 표시명
 * MQTT·DB·명령 payload 는 원문 코드 유지.
 */

export const EQPMN_CODE_NAMES: Record<string, string> = {
  EC01: "송풍팬",
  EC02: "배기팬",
  EC05: "쿨링패드",
  EC06: "보온등",
  ES01: "온도센서",
  ES02: "습도센서",
};

export function normalizeEqpmnCode(code: string | null | undefined): string {
  return (code ?? "").trim().toUpperCase();
}

/** 채널 명령에 실을 수 있는 장비코드. 슬롯(A/B/C)과 1:1이 아니다. */
export const EQPMN_CODE_PATTERN = /^EC(0[1-9]|[1-9][0-9])$/;

export function isValidEqpmnCode(code: string | null | undefined): boolean {
  return EQPMN_CODE_PATTERN.test(normalizeEqpmnCode(code));
}

/** UI 표시용 — EC01 → 송풍팬 */
export function formatEqpmnCodeLabel(code: string | null | undefined): string {
  const key = normalizeEqpmnCode(code);
  if (!key) return "—";
  if (EQPMN_CODE_NAMES[key]) return EQPMN_CODE_NAMES[key];
  if (key.startsWith("EC")) return "환기·제어장비";
  if (key.startsWith("ES")) return "환경센서";
  return "장비";
}

export function formatChannelEquipmentLabel(
  _slot: "A" | "B" | "C",
  eqpmnCode?: string | null
): string {
  return formatEqpmnCodeLabel(eqpmnCode);
}
