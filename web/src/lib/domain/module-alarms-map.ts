import type { AlarmRow, AlarmSeverity } from "@/lib/domain/alarms";

/** Row shape from `v_farm_module_alarm_active` */
export type ModuleAlarmDbRow = {
  id: string;
  created_at: string;
  raw_id: number | null;
  lsind_regist_no: string;
  item_code: string | null;
  farm_name: string | null;
  module_uid: number | null;
  topic: string | null;
  wire_ver: number;
  err_code: number;
  err_label: string;
  stall_ty_code: string | null;
  stall_no: string | null;
  eqpmn_no: string | null;
  controller_key: string | null;
  channel: string | null;
  status: string;
  received_at: string;
};

/** High (x1) / power → critical; low (x2) / unknown → warning */
export function severityForModuleErrCode(errCode: number): AlarmSeverity {
  if (errCode === 0x41) return "critical";
  const nibble = errCode & 0x0f;
  if (nibble === 0x01) return "critical";
  return "warning";
}

export function moduleAlarmToAlarmRow(row: ModuleAlarmDbRow): AlarmRow {
  const itemCode = (row.item_code ?? "").trim();
  const stallTyCode = row.stall_ty_code?.trim() || null;
  const stallNo = row.stall_no?.trim() || null;
  const eqpmnNo = row.eqpmn_no?.trim() || "";
  const controllerKey = row.controller_key?.trim() || "";
  const channel = row.channel?.trim();
  const locParts: string[] = [];
  if (stallTyCode && stallNo && eqpmnNo) {
    locParts.push(`${stallTyCode} ${stallNo}번 ${eqpmnNo}번`);
  }
  if (channel) {
    locParts.push(`${channel}라인`);
  }
  const locDetail = locParts.join(" · ");

  return {
    id: row.id,
    occurredAt: row.received_at,
    farmKey: {
      lsindRegistNo: row.lsind_regist_no,
      itemCode: itemCode || "",
    },
    moduleUid: row.module_uid ?? 0,
    controllerKey,
    eqpmnNo,
    stallNo,
    stallTyCode,
    alarmType: row.err_label,
    severity: severityForModuleErrCode(Number(row.err_code)),
    status: row.status === "active" ? "active" : "resolved",
    detail: locDetail || (row.farm_name ?? "").trim(),
    controllerStatus: "normal",
    source: "module",
    farmName: row.farm_name,
    channel: channel || null,
    errCode: Number(row.err_code),
  };
}
