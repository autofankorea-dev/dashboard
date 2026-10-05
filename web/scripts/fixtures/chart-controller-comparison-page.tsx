"use client";

// Synthetic readings only. The smoke runner mounts this fixture temporarily under /auth.
import { useEffect, useState } from "react";
import { FarmChartLabView } from "@/components/farm/farm-chart-lab-view";
import type { BarnReading } from "@/lib/data/iot";
import {
  TREND_PERIODS,
  type TrendControllerPeriodData,
  type TrendPeriodId,
} from "@/lib/data/farm-trend-types";
import { formatTrendBucketLabel } from "@/lib/data/farm-trend-compact";
import {
  applyFarmChartLabSelectionParams,
  resolveFarmChartLabSelection,
  EMPTY_FARM_CHART_LAB_SELECTION,
  type FarmChartLabSelection,
} from "@/lib/farm/farm-chart-scope";

const readings: BarnReading[] = [
  ["SP03", "1", "1"],
  ["SP03", "1", "2"],
  ["SP03", "2", "1"],
  ["SP04", "1", "1"],
].map(([stallTyCode, stallNo, eqpmnNo], index) => ({
  key: `fixture-${index}`,
  farmKey: { lsindRegistNo: "TEST", itemCode: "P00" },
  moduleUid: index + 1,
  controllerKey: `${stallTyCode}:${stallNo}:${eqpmnNo}`,
  eqpmnNo,
  stallNo,
  stallTyCode,
  label: `fixture ${index}`,
  tempC: 24 + index,
  humidityPct: index === 3 ? null : 60 + index,
  fanSupply: 40,
  fanExhaust: 50,
  fanIntake: 30,
  fanSupplySeries: [],
  fanExhaustSeries: [],
  fanIntakeSeries: [],
  mesureDt: "2026-10-06T00:00:00Z",
  receivedAt: "2026-10-06T00:00:00Z",
  status: "normal",
  packetMode: "live",
  wireVer: 12,
}));

function makeTrend(period: TrendPeriodId): TrendControllerPeriodData {
  const { bucketCount, strideMs } = TREND_PERIODS[period];
  const bucketAts = Array.from({ length: bucketCount }, (_, i) =>
    new Date(
      Date.parse("2026-10-06T00:00:00Z") - (bucketCount - 1 - i) * strideMs,
    ).toISOString(),
  );
  return {
    period,
    bucketAts,
    categories: bucketAts.map((at) =>
      formatTrendBucketLabel(new Date(at), period),
    ),
    totalSamples: bucketCount * readings.length,
    sp: ["SP03", "SP04"].map((stallTyCode) => ({
      stallTyCode,
      label: stallTyCode,
      stalls: [
        ...new Set(
          readings
            .filter((r) => r.stallTyCode === stallTyCode)
            .map((r) => r.stallNo!),
        ),
      ].map((stallNo) => ({
        stallNo,
        controllers: readings
          .filter((r) => r.stallTyCode === stallTyCode && r.stallNo === stallNo)
          .map((r) => {
            const index = readings.indexOf(r);
            const values = (base: number) =>
              bucketAts.map((_, i) => base + Math.sin(i / 5) * 2);
            return {
              controllerKey: r.controllerKey,
              eqpmnNo: r.eqpmnNo,
              stallNo,
              temp: values(23 + index * 3),
              humidity:
                index === 3
                  ? bucketAts.map(() => null)
                  : values(60 + index * 4),
              fanA: values(40),
              fanB: values(50),
              fanC: values(30),
              fanSupply: values(40),
              fanExhaust: values(50),
              fanIntake: values(30),
              sampleCount: bucketAts.map(() => 1),
            };
          }),
      })),
    })),
  };
}
const trends = {
  "24h": makeTrend("24h"),
  "7d": makeTrend("7d"),
  "30d": makeTrend("30d"),
};

export default function ChartComparisonFixture() {
  const [selection, setSelection] = useState<FarmChartLabSelection>(
    EMPTY_FARM_CHART_LAB_SELECTION,
  );
  const [mobile, setMobile] = useState(false);
  const [period, setPeriod] = useState<TrendPeriodId>("24h");
  const [empty, setEmpty] = useState(false);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const restore = () =>
      setSelection(
        resolveFarmChartLabSelection(
          new URLSearchParams(window.location.search),
        ),
      );
    restore();
    const mq = window.matchMedia("(max-width: 767px)");
    const resize = () => setMobile(mq.matches);
    resize();
    mq.addEventListener("change", resize);
    setReady(true);
    window.addEventListener("popstate", restore);
    return () => {
      mq.removeEventListener("change", resize);
      window.removeEventListener("popstate", restore);
    };
  }, []);
  const changeSelection = (next: FarmChartLabSelection) => {
    const params = new URLSearchParams(window.location.search);
    applyFarmChartLabSelectionParams(params, next);
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}?${params}`,
    );
    setSelection(next);
  };
  return (
    <main className="flex h-dvh flex-col gap-2 p-3" data-fixture-ready={ready}>
      <div className="flex shrink-0 gap-2">
        <button
          onClick={() => setPeriod((prev) => (prev === "24h" ? "7d" : "24h"))}
        >
          테스트 기간 변경
        </button>
        <button onClick={() => setEmpty((prev) => !prev)}>
          테스트 빈 농장
        </button>
      </div>
      <FarmChartLabView
        readings={empty ? [] : readings}
        controllerTrendByPeriod={trends}
        period={period}
        selection={selection}
        onSelectionChange={changeSelection}
        isMobileStack={mobile}
      />
    </main>
  );
}
