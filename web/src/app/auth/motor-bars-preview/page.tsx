import { notFound } from "next/navigation";
import { ControllerSummaryGaugeRow } from "@/components/farm/controller-summary-gauge-row";
import type { BarnReading } from "@/lib/domain/iot-types";

const reading: BarnReading = {
  key: "motor-bars-preview", farmKey: { lsindRegistNo: "PREVIEW", itemCode: "P00" },
  moduleUid: 1, controllerKey: "SP07:1:1", stallTyCode: "SP07", stallNo: "1", eqpmnNo: "1", label: "UI 테스트",
  alarmLowTempC: 10, alarmHighTempC: 35, tempC: 25.3, humidityPct: 55,
  fanSupply: null, fanExhaust: null, fanIntake: null,
  fanSupplySeries: [], fanExhaustSeries: [], fanIntakeSeries: [],
  receivedAt: "2026-10-20T00:00:00Z", mesureDt: "2026-10-20T00:00:00Z",
  packetMode: "live", wireVer: 12, status: "normal",
  channels: (["A", "B", "C"] as const).map((channel, index) => ({
    channel, eqpmnCode: `EC0${index + 1}`, tempC: 25.3, humidityPct: 55,
    fanPct: [35, 60, 85][index], fanSeries: [],
    thermo: { setpointTemp: 24 + index, tempDeviation: 2, minVentPct: [10, 25, 40][index], maxVentPct: [60, 80, 100][index] },
  })),
};

export default function MotorBarsPreview() {
  if (process.env.NODE_ENV === "production") notFound();
  return <main className="mx-auto max-w-5xl space-y-6 p-4 sm:p-8">
    <header className="space-y-2">
      <h1 className="text-xl font-bold">컨트롤러 · 차수별 모터바</h1>
      <p className="text-sm text-muted-foreground">샘플 데이터 · 1차 10–60% / 2차 25–80% / 3차 40–100%</p>
      <p className="text-xs text-muted-foreground">fix/controller-stage-motor-bars · 개발 전용 UI 미리보기</p>
    </header>
    <section className="grid gap-6 sm:grid-cols-2">
      <div data-preview="complete"><ControllerSummaryGaugeRow reading={reading} readings={[reading]} thermoSettings={{}} hideGraphToggle /></div>
      <div className="space-y-2" data-preview="missing">
        <ControllerSummaryGaugeRow reading={{ ...reading, key: "missing", channels: reading.channels?.filter(c => c.channel !== "B") }} readings={[reading]} thermoSettings={{}} hideGraphToggle />
        <p className="text-xs text-muted-foreground">2차 미수신 시 다른 차수의 범위를 표시하지 않습니다.</p>
      </div>
    </section>
  </main>;
}
