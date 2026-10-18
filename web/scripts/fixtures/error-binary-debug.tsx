"use client";

import { useState } from "react";
import type { BarnReading } from "@/lib/domain/iot-types";
import { ControllerSummaryGaugeRow } from "@/components/farm/controller-summary-gauge-row";

const reading: BarnReading = {
  key: "debug:SP07:01:01", farmKey: { lsindRegistNo: "DEBUG", itemCode: "P00" }, moduleUid: 1,
  controllerKey: "SP07:01:01", stallTyCode: "SP07", stallNo: "01", eqpmnNo: "01", label: "디버그 컨트롤러",
  tempC: 25, humidityPct: 55, alarmLowTempC: 10, alarmHighTempC: 35,
  fanSupply: 40, fanExhaust: 30, fanIntake: 20, fanSupplySeries: [], fanExhaustSeries: [], fanIntakeSeries: [],
  receivedAt: "2026-10-19T00:00:00Z", mesureDt: "2026-10-19T00:00:00Z", packetMode: "live", wireVer: 12, status: "normal",
};

export function ErrorBinaryFixture() {
  const [value, setValue] = useState("511");
  const current = { ...reading, errorCodeRaw: value === "missing" ? null : Number(value) };
  return <main className="mx-auto max-w-3xl space-y-5 p-4 sm:p-6">
    <h1 className="text-xl font-semibold">네 번째 센서 에러 HEX 테스트</h1>
    <p className="text-sm text-muted-foreground">개발 전용 · 합성 측정 데이터 · 운영 DB와 장비 명령을 변경하지 않습니다.</p>
    <label className="flex flex-wrap items-center gap-2 text-sm">네 번째 센서 원시값
      <select aria-label="네 번째 센서 원시값" className="rounded-md border bg-background p-2" value={value} onChange={e => setValue(e.target.value)}>
        {[0,1,0x11,0x01ff,0x1234,0xabcd,0xffff].map(code => <option key={code} value={code}>{`0x${code.toString(16).toUpperCase().padStart(4,"0")}`}</option>)}
        <option value="missing">미수신</option>
      </select>
    </label>
    <div data-debug-panel="" className="max-w-xl">
      <ControllerSummaryGaugeRow reading={current} readings={[current]} thermoSettings={{}} showAffiliation />
    </div>
    <p className="text-sm">ERR은 네 번째 센서의 원시 2바이트(LE)를 HEX로 표시합니다. 온도 환산·메시지 매핑은 하지 않습니다.</p>
    <a className="text-sm underline" href="/farm">실제 대시보드 열기 · 로그인 필요</a>
  </main>;
}
