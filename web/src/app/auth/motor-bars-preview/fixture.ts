import type { BarnMapSnapshot, BarnReading } from "@/lib/domain/iot-types";
import { barnCatalogKey } from "@/lib/domain/barn-catalog";

export function fieldPreviewSnapshot(revision: number) {
  const farmKey = { lsindRegistNo: "PREVIEW", itemCode: "P00" };
  const receivedAt = new Date().toISOString();
  const readings: BarnReading[] = Array.from({ length: 12 }, (_, index) => {
    const stallTyCode = index < 8 ? "SP07" : "SP06";
    const stallNo = String(Math.floor((index % 8) / 4) + 1);
    const eqpmnNo = String(index % 4 + 1);
    const controllerKey = `${stallTyCode}:${stallNo}:${eqpmnNo}`;
    return {
      key: `preview:${controllerKey}`, farmKey, moduleUid: 1, controllerKey,
      stallTyCode, stallNo, eqpmnNo, label: `컨트롤러 ${eqpmnNo}`,
      alarmLowTempC: 18, alarmHighTempC: 32,
      tempC: Math.round((24 + index * 0.4 + (revision % 3) * 0.2) * 10) / 10,
      humidityPct: 50 + index, fanSupply: null, fanExhaust: null, fanIntake: null,
      fanSupplySeries: [], fanExhaustSeries: [], fanIntakeSeries: [],
      receivedAt, mesureDt: receivedAt, packetMode: "live", wireVer: 12, status: "normal",
      channels: (["A", "B", "C"] as const).map((channel, c) => ({
        channel, eqpmnCode: `EC0${c + 1}`, tempC: 24 + index * 0.4, humidityPct: 50 + index,
        fanPct: [35, 60, 85][c] + (revision % 3), fanSeries: [],
        thermo: { setpointTemp: 24 + c, tempDeviation: 2, minVentPct: [10, 25, 40][c], maxVentPct: [60, 80, 100][c] },
      })),
    };
  });
  const barnSnapshots: BarnMapSnapshot[] = readings.filter((r, i) => i % 4 === 0).map((r, index) => ({
    meta: { id: `${barnCatalogKey(farmKey, 1, r.stallTyCode)}#${r.stallNo}`, farmKey, moduleUid: 1,
      stallNo: r.stallNo!, name: "", grid: { col: 0, row: index } },
    controllerCount: 4, stallCount: 1, tempC: r.tempC, humidityPct: r.humidityPct,
    fanSupply: 35, fanExhaust: 60, fanIntake: 85, status: "normal", receivedAt,
  }));
  return { readings, barnSnapshots, revision, receivedAt };
}
