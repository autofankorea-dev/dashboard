/**
 * 일보 브리핑 집계
 * 실행: npx tsx src/lib/report/daily-report-briefing.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type {
  DailyReportBarn,
  DailyReportPayload,
  DailyReportSeries,
} from "./daily-report-payload";
import {
  averageBarnsSeries,
  buildDailyReportBriefing,
  farmBriefingFacts,
  typeBriefingFacts,
  worstJudge,
} from "./daily-report-briefing";

function seriesFromTemp(
  categories: string[],
  temp: number[],
  humidity = 55,
): DailyReportSeries {
  const n = categories.length;
  const hum = Array.from({ length: n }, () => humidity);
  const z = () => new Array<number | null>(n).fill(10);
  return {
    categories,
    temp,
    humidity: hum,
    motorA: z(),
    motorB: z(),
    motorC: z(),
  };
}

function barn(partial: {
  stallTyCode: string;
  stallLabel: string;
  stallNo: string;
  judge?: string;
  series7d: DailyReportSeries;
  series30d: DailyReportSeries;
}): DailyReportBarn {
  return {
    stallTyCode: partial.stallTyCode,
    stallLabel: partial.stallLabel,
    stallNo: partial.stallNo,
    kpi: {
      tempNow: 24,
      humNow: 55,
      motorA: 10,
      motorB: 10,
      motorC: 10,
      tMin24: 20,
      tMax24: 26,
      online: 2,
      total: 2,
      judge: partial.judge ?? "정상",
    },
    controllers: [],
    periods: {
      "24h": partial.series7d,
      "7d": partial.series7d,
      "30d": partial.series30d,
    },
    detailRows: [],
  };
}

describe("worstJudge", () => {
  it("picks the worst judge", () => {
    assert.equal(worstJudge(["정상", "수신 지연"]), "수신 지연");
    assert.equal(worstJudge(["수신 지연", "통신 두절"]), "통신 두절");
  });
});

describe("buildDailyReportBriefing", () => {
  const cats7 = ["1일 00시", "1일 01시", "1일 02시", "1일 03시"];
  const cats30 = Array.from({ length: 12 }, (_, i) => `8/${10 + i} 00시`);

  it("groups measured data without a recommendation or historical alarm judgment", () => {
    const preg7 = seriesFromTemp(cats7, [24, 25, 24, 23]);
    const farrow7 = seriesFromTemp(cats7, [26, 26, 25, 25]);
    const preg30 = seriesFromTemp(
      cats30,
      [19, 19, 22, 23, 24, 22, 19, 19, 19, 19, 19, 19],
    );
    const farrow30 = seriesFromTemp(
      cats30,
      [20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20],
    );

    const payload = {
      farmLabel: "햇살농장",
      reportDate: "2026-08-19",
      overview: {
        barnCount: 3,
        controllerCount: 6,
        onlineCount: 6,
        offlineCount: 0,
        alarmCount: 0,
      },
      barns: [
        barn({
          stallTyCode: "SP02",
          stallLabel: "임신사",
          stallNo: "1",
          series7d: preg7,
          series30d: preg30,
        }),
        barn({
          stallTyCode: "SP02",
          stallLabel: "임신사",
          stallNo: "2",
          series7d: preg7,
          series30d: preg30,
        }),
        barn({
          stallTyCode: "SP03",
          stallLabel: "분만사",
          stallNo: "1",
          series7d: farrow7,
          series30d: farrow30,
        }),
      ],
    } as DailyReportPayload;

    const briefing = buildDailyReportBriefing(payload);
    assert.equal(briefing.types.length, 2);
    assert.equal(briefing.types[0]?.stallLabel, "임신사");
    assert.equal(briefing.types[0]?.barnCount, 2);
    assert.equal(briefing.types[0]?.avgTemp30d, 20.25);
    assert.ok(!("risk" in briefing));
    assert.ok(!("recommendTemp" in briefing.types[0]!));
    assert.ok(!("hoursOutsideTemp30d" in briefing.types[0]!));

    const farmFacts = farmBriefingFacts(briefing, payload).join(" ");
    assert.match(farmFacts, /30일 농장 평균 온도/);
    assert.doesNotMatch(farmFacts, /SP0/);
    assert.doesNotMatch(farmFacts, /farmKey/);

    const typeFacts = typeBriefingFacts(briefing.types[0]!).join(" ");
    assert.match(typeFacts, /임신사 30일 평균/);
    assert.doesNotMatch(farmFacts + typeFacts, /권장|이탈|SP0|farmKey/);

  });

  it("reports measured averages for an in-range series", () => {
    const inside = seriesFromTemp(cats7, [18, 19, 18, 19]);
    const payload = {
      farmLabel: "햇살농장",
      reportDate: "2026-08-19",
      overview: {
        barnCount: 1,
        controllerCount: 1,
        onlineCount: 1,
        offlineCount: 0,
        alarmCount: 0,
      },
      barns: [
        barn({
          stallTyCode: "SP02",
          stallLabel: "임신사",
          stallNo: "1",
          series7d: inside,
          series30d: seriesFromTemp(cats30, Array.from({ length: 12 }, () => 18)),
        }),
      ],
    } as DailyReportPayload;
    const briefing = buildDailyReportBriefing(payload);
    assert.equal(briefing.farmAvgTemp30d, 18);
    assert.equal(briefing.farmAvgHum30d, 55);
    assert.ok(!("risk" in briefing));
  });

  it("averages matching slots across barns", () => {
    const a = seriesFromTemp(["a", "b"], [10, 20]);
    const b = seriesFromTemp(["a", "b"], [30, 40]);
    const out = averageBarnsSeries(
      [
        barn({
          stallTyCode: "SP02",
          stallLabel: "임신사",
          stallNo: "1",
          series7d: a,
          series30d: a,
        }),
        barn({
          stallTyCode: "SP02",
          stallLabel: "임신사",
          stallNo: "2",
          series7d: b,
          series30d: b,
        }),
      ],
      "7d",
    );
    assert.deepEqual(out.temp, [20, 30]);
  });
});
