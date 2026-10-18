"use client";

import { useEffect, useState } from "react";
import type { BarnReading } from "@/lib/domain/iot-types";
import type { AlarmRow } from "@/lib/domain/alarms";
import { ControllerSummaryGaugeRow } from "@/components/farm/controller-summary-gauge-row";
import { publishShellAlarms, clearShellAlarms } from "@/lib/navigation/shell-live-alarms-store";

const reading: BarnReading = {
  key: "debug:SP07:01:01", farmKey: { lsindRegistNo: "DEBUG", itemCode: "P00" }, moduleUid: 1,
  controllerKey: "SP07:01:01", stallTyCode: "SP07", stallNo: "01", eqpmnNo: "01", label: "디버그 컨트롤러",
  tempC: 25, humidityPct: 55, alarmLowTempC: 10, alarmHighTempC: 35,
  fanSupply: 40, fanExhaust: 30, fanIntake: 20, fanSupplySeries: [], fanExhaustSeries: [], fanIntakeSeries: [],
  receivedAt: "2026-10-19T00:00:00Z", mesureDt: "2026-10-19T00:00:00Z", packetMode: "live", wireVer: 12, status: "normal",
};
const labels: Record<number, string> = { 17: "A 라인 고온 경보", 18: "A 라인 저온 경보", 33: "B 라인 고온 경보",
  34: "B 라인 저온 경보", 49: "C 라인 고온 경보", 50: "C 라인 저온 경보", 65: "정전", 254: "미정의 경보" };
function alarm(code: number, legacy = false): AlarmRow {
  return { id: `fixture-${code}-${legacy}`, occurredAt: reading.receivedAt, farmKey: reading.farmKey,
    moduleUid: 1, controllerKey: legacy ? "" : reading.controllerKey, eqpmnNo: "01", stallNo: "01", stallTyCode: "SP07",
    alarmType: labels[code], severity: "critical", status: "active", detail: "합성 테스트 데이터",
    controllerStatus: "normal", source: "module", errCode: code };
}

export function ErrorBinaryFixture() {
  const [scenario, setScenario] = useState("17");
  useEffect(() => {
    const rows = scenario === "none" ? [] : scenario === "multiple" ? [alarm(17), alarm(65)]
      : scenario === "legacy" ? [alarm(17, true)]
      : scenario === "other" ? [{ ...alarm(17), moduleUid: 2 }]
      : [alarm(Number(scenario))];
    publishShellAlarms(rows);
    return clearShellAlarms;
  }, [scenario]);
  return <main className="mx-auto max-w-3xl space-y-5 p-4 sm:p-6">
    <h1 className="text-xl font-semibold">컨트롤러 에러 Binary 테스트</h1>
    <p className="text-sm text-muted-foreground">개발 전용 · 합성 경보 · 운영 DB와 장비 명령을 변경하지 않습니다.</p>
    <label className="flex flex-wrap items-center gap-2 text-sm">테스트 경보
      <select aria-label="테스트 경보" className="rounded-md border bg-background p-2" value={scenario} onChange={e => setScenario(e.target.value)}>
        {Object.entries(labels).map(([code,label]) => <option key={code} value={code}>{`0x${Number(code).toString(16).toUpperCase()} · ${label}`}</option>)}
        <option value="none">수신 경보 없음</option><option value="multiple">동시 경보 · 0x11 + 0x41</option>
        <option value="legacy">위치 없는 5바이트 경보</option><option value="other">다른 모듈 경보 · 표시 제외</option>
      </select>
    </label>
    <div data-debug-panel="" className="max-w-xl">
      <ControllerSummaryGaugeRow reading={reading} readings={[reading]} thermoSettings={{}} showAffiliation />
    </div>
    <p className="text-sm">상태판정 오른쪽 ERR은 원본 코드 8비트입니다. 여러 경보는 합치지 않으며, —는 활성 수신 경보가 없다는 뜻입니다.</p>
    <a className="text-sm underline" href="/farm">실제 대시보드 열기 · 로그인 필요</a>
  </main>;
}
