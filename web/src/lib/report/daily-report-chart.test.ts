/**
 * 일보 PDF 인쇄 다운샘플
 * 실행: npx vitest run src/lib/report/daily-report-chart.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "vitest";
import {
  downsampleDailyReportSeriesForPrint,
  PDF_PRINT_MAX_POINTS,
} from "./daily-report-chart";
import {
  dailyReportPdfFilename,
  type DailyReportPayload,
  type DailyReportSeries,
} from "./daily-report-payload";

function series(len: number, spikeAt: number): DailyReportSeries {
  const categories = Array.from({ length: len }, (_, i) => String(i));
  const temp = Array.from({ length: len }, (_, i) =>
    i === spikeAt ? 40 : 20,
  );
  const empty = () => new Array<number | null>(len).fill(null);
  return {
    categories,
    temp,
    humidity: empty(),
    motorA: empty(),
    motorB: empty(),
    motorC: empty(),
  };
}

describe("downsampleDailyReportSeriesForPrint", () => {
  it("keeps series at or under the print cap", () => {
    const src = series(96, 10);
    const out = downsampleDailyReportSeriesForPrint(src);
    assert.equal(out.categories.length, 96);
    assert.equal(out, src);
  });

  it("LTTB-downsamples 30d hourly to the print cap and keeps the peak", () => {
    const spikeAt = 300;
    const src = series(720, spikeAt);
    const out = downsampleDailyReportSeriesForPrint(src);
    assert.equal(out.categories.length, PDF_PRINT_MAX_POINTS);
    assert.equal(out.categories[0], "0");
    assert.equal(out.categories.at(-1), "719");
    assert.ok(out.temp.includes(40));
  });
});

describe("dailyReportPdfFilename", () => {
  it("uses the display label and strips path characters", () => {
    const payload = {
      farmLabel: "햇살/농장",
      reportDate: "2026-08-19",
    } as DailyReportPayload;
    assert.equal(
      dailyReportPdfFilename(payload),
      "햇살_농장_일보_2026-08-19.pdf",
    );
  });
});
