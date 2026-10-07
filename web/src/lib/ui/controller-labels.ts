import type { ControllerThermoSettings } from "@/lib/controllers/controller-settings";
import type { ThermoCommand } from "@/lib/data/commands";
import type { FarmKey } from "@/lib/data/farm-key";
import { getItemCodeName } from "@/lib/data/item-code";
import { formatStallTypeLabel } from "@/lib/data/stall-type";

import { dashboardUi } from "@/lib/ui/dashboard-page-ui";

/** 슬라이더 카드 — 값/비교 영역 고정 높이 (드래그 시 레이아웃 점프 방지) */
export const SLIDER_VALUE_SLOT_MIN_H = dashboardUi.valueSlotMinH;

export function settingsSourceLabel(
  source: ControllerThermoSettings["source"]
): string {
  switch (source) {
    case "live":
      return "장치 실측값";
    case "applied":
      return "적용한 설정값";
    case "sent":
      return "적용한 설정값";
    case "pending":
      return "적용한 설정값";
    default:
      return "설정값";
  }
}

export function pipelineDetailMessage(
  status: ThermoCommand["status"],
  errorMsg?: string | null
): string {
  switch (status) {
    case "applied":
      return "명령을 보냈습니다. 연결된 컨트롤러에 곧 반영됩니다.";
    case "sent":
      return "명령을 보냈습니다. 연결된 컨트롤러에 곧 반영됩니다.";
    case "pending":
      return "명령을 등록했습니다. 연결된 컨트롤러에 곧 반영됩니다.";
    case "failed":
      return errorMsg
        ? formatUserError(errorMsg)
        : "명령 처리에 실패했습니다.";
    case "cancelled":
      return "명령이 취소되었습니다.";
    default:
      return "";
  }
}

/** ACK 배너 — 전송 성공을 적용 완료로 안내 (LIVE 일치는 필수가 아님) */
export function pipelineStatusDetail(
  status: ThermoCommand["status"],
  errorMsg?: string | null,
  liveConfirmed?: boolean
): string {
  if (liveConfirmed) {
    return "명령을 보냈습니다. 패널에 적용한 값이 표시됩니다.";
  }
  if (status === "applied" || status === "sent") {
    return "명령을 보냈습니다. 통신이 연결된 컨트롤러에 곧 반영됩니다.";
  }
  return pipelineDetailMessage(status, errorMsg);
}

export const UNKNOWN_SETTINGS_HINT =
  "컨트롤러 설정값을 아직 받지 못했습니다. 조정 후 적용하면 명령으로 등록됩니다.";

export const COMMAND_REGISTER_SUCCESS =
  "명령을 보냈습니다. 통신이 연결된 컨트롤러에 곧 반영됩니다.";

export function formatUserError(error: string): string {
  if (error === "invalid_vent_range") {
    return "환기 범위를 확인하세요. (0~100%, 최저 ≤ 최고)";
  }
  if (error === "invalid_eqpmn_code") {
    return "장비코드 형식이 올바르지 않습니다.";
  }
  if (error === "unauthorized") return "권한이 없습니다.";
  if (error.includes("row-level security")) {
    return "이 컨트롤러에 대한 명령 권한이 없습니다.";
  }
  return "요청을 처리하지 못했습니다. 관리자에게 문의하세요.";
}

export function isDevDiagnosticsEnabled(): boolean {
  return process.env.NEXT_PUBLIC_DEV_DIAGNOSTICS === "1";
}

export function formatFarmItemLabel(
  farmKey: FarmKey,
  stallTyCode?: string | null
): string {
  const item = stallTyCode
    ? formatStallTypeLabel(stallTyCode)
    : getItemCodeName(farmKey.itemCode);
  return `${farmKey.lsindRegistNo} · ${item}`;
}

/** v0x0A 슬롯 라벨 — 축사 번호 + 장비 번호 */
export function formatControllerSlotLabel(opts: {
  stallNo?: string | null;
  eqpmnNo?: string;
  /** @deprecated legacy v0x09 */
  idx?: number;
}): string {
  const stall = opts.stallNo?.trim();
  const eq = opts.eqpmnNo?.trim();
  if (stall && eq) return `축사 ${stall} · ${eq}번`;
  if (eq) return `컨트롤러 ${eq}`;
  if (opts.idx !== undefined) return `컨트롤러 #${opts.idx + 1}`;
  return "컨트롤러";
}

/** 사용자 지정 이름 뒤에 붙일 짧은 슬롯 표기 (03·02) */
export function formatControllerSlotSuffix(opts: {
  stallNo?: string | null;
  eqpmnNo?: string;
}): string {
  const stall = opts.stallNo?.trim();
  const eq = opts.eqpmnNo?.trim();
  if (stall && eq) return ` (${stall}·${eq})`;
  if (eq) return ` (${eq}번)`;
  return "";
}

/** OpsScopeBar · 컨트롤러 pill 라벨 */
export function formatControllerPillLabel(opts: {
  label?: string;
  stallNo?: string | null;
  stallTyCode?: string | null;
  eqpmnNo?: string;
  displayName?: string | null;
  /** ScopeBar에서 고정된 SP — 빈 문자열이면 전체유형 */
  scopeSpCode?: string;
  /** ScopeBar에서 고정된 stall — 빈 문자열이면 전체번호 */
  scopeStallKey?: string;
}): string {
  const slotLabel =
    opts.label ??
    formatControllerSlotLabel({ stallNo: opts.stallNo, eqpmnNo: opts.eqpmnNo });
  const metaName = opts.displayName?.trim();
  const base = metaName
    ? `${metaName}${formatControllerSlotSuffix({ stallNo: opts.stallNo, eqpmnNo: opts.eqpmnNo })}`
    : slotLabel;

  const prefixParts: string[] = [];
  if (!opts.scopeSpCode?.trim()) {
    prefixParts.push(formatStallTypeLabel(opts.stallTyCode));
  }
  if (!opts.scopeStallKey?.trim()) {
    const stall = opts.stallNo?.trim();
    if (stall) prefixParts.push(`축사 ${stall}`);
  }

  if (prefixParts.length === 0) return base;
  return `${prefixParts.join(" · ")} · ${base}`;
}

/** 모바일 분할 셸 — 컨트롤러 가로 스크롤 칩 (S2) */
export function formatControllerScrollChipLabel(opts: {
  eqpmnNo?: string;
}): string {
  const eq = opts.eqpmnNo?.trim();
  return eq ? `C·${eq}` : "C·—";
}

/** 모바일 레거시 pill — 짧은 라벨 */
export function formatControllerPillLabelShort(opts: {
  label?: string;
  stallNo?: string | null;
  eqpmnNo?: string;
}): string {
  const eq = opts.eqpmnNo?.trim();
  if (eq) return `${eq}번`;
  const stall = opts.stallNo?.trim();
  if (stall) return `${stall}번`;
  const label = opts.label?.trim();
  if (label) {
    const tail = label.split("·").pop()?.trim() ?? label;
    return tail.length > 12 ? `${tail.slice(0, 11)}…` : tail;
  }
  return "—";
}

export function formatControllerRef(opts: {
  farmKey: FarmKey;
  eqpmnNo?: string;
  stallNo?: string | null;
  ctrlIdx?: number;
  stallTyCode?: string | null;
}): string {
  const base = formatFarmItemLabel(opts.farmKey, opts.stallTyCode);
  const slot = formatControllerSlotLabel({
    stallNo: opts.stallNo,
    eqpmnNo: opts.eqpmnNo,
    idx: opts.ctrlIdx,
  });
  return `${base} · ${slot}`;
}

export function formatCommandTarget(cmd: ThermoCommand): string {
  const base = formatControllerRef({
    farmKey: cmd.farmKey,
    stallTyCode: cmd.stallTyCode,
    stallNo: cmd.stallNo,
    eqpmnNo: cmd.eqpmnNo,
  });
  if (cmd.channels?.length) return `${base} · ${cmd.channels.map((ch) => ch.channel).join("/")}`;
  if (cmd.channel) {
    return `${base} · ${cmd.channel}`;
  }
  return base;
}

export function replayPanelTitle(
  controllerKey: string,
  opts?: { stallNo?: string | null; eqpmnNo?: string }
): string {
  const label = opts?.eqpmnNo
    ? formatControllerSlotLabel({ stallNo: opts.stallNo, eqpmnNo: opts.eqpmnNo })
    : controllerKey;
  return `연결 복구 이력 — ${label}`;
}

export const REPLAY_PANEL_DESCRIPTION =
  "통신 재연결 시 백필된 온습도 샘플 · 자세한 기록은 설정 → 연결 복구";

export const REPLAY_EMPTY_HINT =
  "연결 복구 이력 없음 (통신 재연결 시 이전 구간 데이터가 채워집니다)";

export function liveSummaryBadge(wireVer?: number | null): string {
  return wireVer != null ? "LIVE 연결" : "LIVE";
}

export function liveControllerCountLabel(
  total: number,
  maxSlots: number
): string {
  return `${total}대 / 최대 ${maxSlots}대`;
}

export function chartLiveDescription(maxControllers: number): string {
  return `LIVE 컨트롤러 1~${maxControllers}`;
}

export function packetModeLabel(mode: string | null | undefined): string {
  if (!mode) return "--";
  if (mode.toLowerCase() === "live") return "실시간";
  if (mode.toLowerCase() === "replay") return "연결 복구";
  return mode;
}

export function wireDiagnosticsLine(
  wireVer: number,
  packetMode: string | null | undefined
): string {
  return `wire 0x${wireVer.toString(16)} · ${packetMode ?? "--"}`;
}

export function formatCommandDetail(
  errorMsg?: string | null,
  note?: string | null
): string {
  if (errorMsg) return formatUserError(errorMsg);
  if (note?.trim()) return note.trim();
  return "—";
}
